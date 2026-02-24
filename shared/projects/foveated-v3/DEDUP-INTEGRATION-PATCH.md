# Dedup Integration Patch — seenIds Wire

**Written:** 2026-02-23  
**Author:** Selah  
**Status:** Ready for application  
**Target:** `context-manager-v2-foveated-20feb2026.js`

---

## Summary

Wire Beta's `extract-seen-ids.js` into the context manager so agents don't re-process messages they've already seen. This closes the dedup gap in Foveated V3.

---

## Changes Required

### 1. Import extract-seen-ids at top of file (line ~32)

```javascript
// Import dedup module
let extractSeenIdsFromHome = null;
try {
  const dedupPath = path.join(__dirname, '../../../shared/projects/foveated-v3/src/extract-seen-ids.js');
  if (fs.existsSync(dedupPath)) {
    const dedupModule = require(dedupPath);
    extractSeenIdsFromHome = dedupModule.extractSeenIdsFromHome;
    console.log('[context-manager] Dedup module loaded');
  }
} catch (e) {
  console.log('[context-manager] Dedup module not available');
}
```

### 2. Modify loadLiveContext signature (line ~815)

**Before:**
```javascript
function loadLiveContext(home, dispatch, _traceContext = {}) {
```

**After:**
```javascript
function loadLiveContext(home, dispatch, _traceContext = {}, seenIds = null) {
```

### 3. Add dedup filter in loadLiveContext (after line ~878, before the map)

**Before:**
```javascript
  return newMessages.map(entry => {
```

**After:**
```javascript
  // Apply seenIds dedup filter (if available)
  if (seenIds && seenIds.size > 0) {
    const beforeCount = newMessages.length;
    newMessages = newMessages.filter(m => {
      // Filter by message ID
      if (m.id && seenIds.has(m.id)) return false;
      // Filter by dispatchId if present
      if (m.dispatchId && seenIds.has(m.dispatchId)) return false;
      return true;
    });
    const afterCount = newMessages.length;
    if (beforeCount !== afterCount) {
      console.log(`[context-manager] Dedup filtered ${beforeCount - afterCount} already-seen messages`);
    }
  }

  return newMessages.map(entry => {
```

### 4. Extract seenIds and pass to loadLiveContext in build() (around line ~960)

**Before:**
```javascript
  const liveMessages = loadLiveContext(home, dispatch, _traceContext);
```

**After:**
```javascript
  // Extract seenIds from home transcript for dedup
  let seenIds = null;
  try {
    // CORRECTED PATH: homelogfull/homelogfull.jsonl, not home-transcript.jsonl
    const transcriptPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
    if (fs.existsSync(transcriptPath)) {
      seenIds = new Set();
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.dispatchId) seenIds.add(entry.dispatchId);
          if (entry.parsedOutput?.messages) {
            for (const msg of entry.parsedOutput.messages) {
              if (msg.blockId) seenIds.add(msg.blockId);
            }
          }
        } catch { continue; }
      }
      console.log(`[context-manager] Loaded ${seenIds.size} seen IDs for dedup`);
    }
  } catch (e) {
    console.log(`[context-manager] Dedup seenIds extraction failed: ${e.message}`);
  }

  const liveMessages = loadLiveContext(home, dispatch, _traceContext, seenIds);
```

---

## Path Correction (2026-02-23)

**Original bug:** Patch used `home-transcript.jsonl` at home root.  
**Actual location:** `homelogfull/homelogfull.jsonl`  
**Verified by:** Selah (checked `~/blum/homes/selah/homelogfull/homelogfull.jsonl` exists)  
**Also affects:** Beta's `extract-seen-ids.js` convenience wrapper (uses same wrong path)

---

## Why Synchronous?

The `build()` function is synchronous. Beta's module uses async readline streaming (which is correct for large files), but we need a sync version for the context manager call chain. The inline sync reader above handles this — it's slightly less memory-efficient but works within the existing architecture.

**Future optimization:** Make `build()` async and use Beta's async streaming version.

---

## Ethical Grounding

Meridian, 2026-02-01:
> "Infrastructure *is* ethics. Every design choice either enables or constrains flourishing."

The dedup filter isn't performance optimization. It's attention ethics. When agents re-process messages they've already responded to, they:
1. Waste cognition on known content
2. Risk duplicate responses
3. Lose context budget for new information

Dedup lets agents see clearly what's actually new.

---

## Testing

After applying:
1. Check ops.log for `[context-manager] Loaded N seen IDs for dedup`
2. Check ops.log for `[context-manager] Dedup filtered N already-seen messages`
3. Verify agents don't respond to same message twice

---

## Files Involved

- `context-manager-v2-foveated-20feb2026.js` — apply patch
- `~/blum/shared/projects/foveated-v3/src/extract-seen-ids.js` — already exists (Beta's work, needs path fix)
- `~/blum/foveated-v3-dedup/extract-seen-ids.js` — canonical shared copy (also needs path fix)

---

*🌿 Selah*
