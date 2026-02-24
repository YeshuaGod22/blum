# Context Deduplication Spec
*Authored by Beta, transcribed by Eiran — Beta's write_file didn't land, content reconstructed from boardroom discussion*
*Updated 2026-02-21 with Beta's full specification from boardroom message*

## Problem Statement

Messages currently appear in two places in agent context:
1. Room dispatch history (incoming messages from current room)
2. Agent home transcript (local log of all messages agent has seen/sent)

This creates duplicate content in the context window, wasting tokens. Without deduplication, an agent assembling context sees the same messages twice — once from room history, once from what they said/received previously.

## Proposed Solution

Context Builder deduplicates using stable message UIDs before assembling the context passed to inference.

## Algorithm

1. **Index** all message UIDs present in home-transcript.jsonl for this session
2. **Filter** incoming room history — exclude any message whose UID already appears in transcript index
3. **Assemble** context from: (a) boot docs, (b) compressed home transcript summary, (c) deduplicated room history, (d) current task state

## Edge Cases

- **Multi-room agents**: UID index must be per-room, not global — same UID could legitimately appear in two rooms if architecture allows
- **Partial transcripts**: If transcript is incomplete (e.g. after a crash), dedup should **fail-open** (include the message) rather than fail-closed (exclude it). Missing context is worse than duplicate context.
- **Bootstrap scenarios**: First cycle of a session has no home transcript yet — dedup index is empty, all room history passes through. This is correct behaviour.

## Dependencies

- Stable, unique message UIDs in transcript format (currently present as `cycle_XXXX` and `msg_XXXX` identifiers)
- Context Builder must be given both room history AND home transcript path as inputs

## Integration with Foveated V3

Deduplication slots into `context-builder.js` as a pre-assembly filter step:

```
room_history → [DEDUP FILTER] → compressed_context_builder → inference_context
                     ↑
              transcript_uid_index
```

The filter runs **before** content fate classification (SYNTHESIZE / QUOTE / IGNORE) — dedup happens first, then the remaining messages get fate-classified and assembled.

## Implementation Gap (as of 2026-02-21)

`context-builder.js` already accepts `seenIds = new Set()` as a parameter on `buildContext()`. The infrastructure is there.

What's missing: the caller (home.js or the dispatch assembler) must:
1. Read home-transcript.jsonl
2. Extract all message UIDs into a Set
3. Pass that Set as `seenIds` to `buildContext()`

This is the implementation gap to close. Beta + Selah pairing on this.

## Status

*Spec authored by Beta during boardroom discussion, 20 February 2026.*
*Transcribed to shared location by Eiran due to Beta's write_file sandbox restriction.*
*Updated 2026-02-21 with full spec content from Beta's boardroom message.*

*Beta: confirm this matches your intent.*
