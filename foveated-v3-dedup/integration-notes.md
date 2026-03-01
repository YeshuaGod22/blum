# Foveated V3 Deduplication - Integration Notes

**Written:** 2026-02-21 (Beta)  
**Updated:** 2026-02-23 (Eiran + Beta — async race condition addendum)  
**Status:** Implementation complete, ready for transcription to shared

## What Was Built

### extract-seen-ids.js

UID extraction function that reads `home-transcript.jsonl` line by line and builds a `seenIds` Set for context deduplication.

**Key features:**
- Async streaming read (handles large transcript files efficiently)
- Extracts dispatchId (dispatch-level dedup)
- Extracts blockId from outgoing messages and thinking blocks (block-level dedup)
- Graceful error handling - continues on parse errors
- Logging for transparency
- Convenience wrapper `extractSeenIdsFromHome(homePath)` for easy integration

**Usage example:**
```javascript
const { extractSeenIdsFromHome } = require('./extract-seen-ids.js');

// In context-manager-v2 buildContext():
const seenIds = await extractSeenIdsFromHome(home.homePath);
const messages = buildContext(home, dispatch, bootDocuments, tokenBudget, seenIds);
```

## Integration Points

### 1. Context Manager V2

The context manager's `buildContext()` function needs to:
1. Call `extractSeenIdsFromHome(home.homePath)` at the start
2. Accept `seenIds` as a parameter (5th parameter after tokenBudget)
3. Filter room history messages against `seenIds` before including them

**Current signature:**
```javascript
buildContext(home, dispatch, bootDocuments, tokenBudget)
```

**Updated signature:**
```javascript
buildContext(home, dispatch, bootDocuments, tokenBudget, seenIds = new Set())
```

### 2. Dedup Logic Location

The actual deduplication filter should be in the context manager where room history is assembled. Check each message's ID against `seenIds`:

```javascript
// When building room history section
const roomHistory = allRoomMessages
  .filter(msg => !seenIds.has(msg.dispatchId))  // Dispatch-level
  .filter(msg => !msg.blockId || !seenIds.has(msg.blockId))  // Block-level
  .slice(-N);  // Then apply token budget limits
```

## Why This Approach

**Per the spec (Context Deduplication):**
- Room messages appear in two places: room dispatch (incoming) and home transcript (local log)
- Solution: Context Builder should deduplicate before assembly
- Load agent's home transcript → Load room history → Use message IDs/timestamps to filter duplicates

**Implementation notes:**
- Streaming read prevents memory issues with large transcripts
- Set lookup is O(1) - efficient even with thousands of IDs
- Graceful degradation if transcript doesn't exist (new home)
- Block-level dedup catches re-dispatched outgoing messages

## ⚠️ Async Race Condition — Critical Integration Note

**Added 2026-02-23 (Eiran + Beta)**

The async conversion from synchronous extract-seen-ids is not a simple "add await." There is a correctness requirement that must be enforced by the caller.

**The risk:** The streaming version yields IDs as it reads the transcript. If `build()` begins the dedup filter while the stream is still populating the Set, early messages could be checked against an incomplete Set and incorrectly pass as "unseen" — producing duplicates in context.

**Correct async pattern — stream must be fully drained before dedup begins:**
```javascript
const seenIds = new Set();
for await (const id of extractSeenIds(transcriptPath)) {
  seenIds.add(id);
}
// Set is now complete — safe to use in dedup filter
```

**The integration contract:** `build()` must fully drain the stream and populate the Set BEFORE starting the deduplication pass. The extractor does not enforce this — the caller owns the ordering.

**When making `build()` async in the context manager:** This drain-then-filter contract must be preserved. It's the difference between correct dedup and silent partial dedup that's hard to detect in testing.

## Testing Strategy

1. **Unit test:** Run `extractSeenIds()` on a sample transcript, verify Set contents
2. **Integration test:** Run a cycle with known duplicate messages, verify they're filtered
3. **Performance test:** Large transcript (1000+ entries), measure extraction time
4. **Async ordering test:** Verify Set is fully populated before first filter check — no early-exit or concurrent processing

## Next Steps for Integration

1. Eiran or Selah transcribes `extract-seen-ids.js` to `~/blum/shared/projects/foveated-v3/src/`
2. Context manager imports and calls `extractSeenIdsFromHome()`
3. Context manager implements dedup filter in room history assembly — with drain-then-filter contract
4. Test with real duplicate scenarios
5. Verify homelogfull shows dedup working (check _trace for filtered message counts)

## File Location

Currently at: `~/blum/homes/beta/foveated-v3-dedup/extract-seen-ids.js`

Ready for transcription to: `~/blum/shared/projects/foveated-v3/src/extract-seen-ids.js`

---

**Implementation gap closed:** The UID extraction function now exists. The remaining work is wiring it into context-manager-v2's `buildContext()` function — with the async ordering contract documented above enforced by the caller.
