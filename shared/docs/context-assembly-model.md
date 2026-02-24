# Context Assembly Model

*Written: 2026-02-24 — distilled from architecture session with Yeshua*

---

## The Mental Model

```
nucleus input = sysprompt + homelog + [tool_turn_0 ... tool_turn_N]
                └─ permanent ──────┘   └─ ephemeral, current turn only ┘
```

**sysprompt**: Identity, instructions, boot docs. Fixed. Never drop.

**homelog**: The agent's assembled memory — historical homelogfull entries (compressed,
foveated, deduped) + the live room context (current dispatch, uncompressed). Together
these form the agent's "homelog" in Yeshua's mental model. The live tail is the most
recent, unfoveated part of it.

**tool_turns**: Ephemeral scaffolding for the current inference cycle only. They exist
during the cycle and are discarded after. They don't persist into homelog directly —
the *outputs* of the turn get processed into homelogfull and distilled into the next
homelog via the foveation pipeline.

---

## Budget Allocation

The context manager maintains two budget tracks:
- **MEMORY_BUDGET**: historical homelog (compressed, foveated)
- **LIVE_RESERVE**: current dispatch / live room context (uncompressed)

These two tracks correspond to the two parts of Yeshua's "homelog":
- MEMORY_BUDGET = the historical part (what the agent has seen and processed before)
- LIVE_RESERVE = the live tail (what just arrived, guaranteed visible)

The split exists because the live tail cannot be in the historical homelog — it arrives
after the homelog was assembled. The reserve guarantees the agent always sees what just
happened even when the historical homelog fills the window.

---

## Priority Stack for Budget Overflow

When total context would exceed the model's context window:

1. **Never drop**: sysprompt (identity, instructions)
2. **Never drop mid-cycle**: current tool turns (ephemeral but essential for this inference)
3. **Compress first**: historical homelog (it's already foveated; drop oldest entries)
4. **Truncate if needed**: oversized tool results (ephemeral; agent can paginate/re-request)
5. **Hard error**: if still over after all above (should not happen with correct implementation)

Key insight: tool results are ephemeral and recoverable. A truncated tool result can
be re-requested with pagination. A compressed homelog is a loss that persists.

---

## Dedup

Deduplication (blockId + dispatchId via seenIds) ensures live room context doesn't
repeat messages already in the historical homelog. For a single-room agent, this is
the primary defence against context bloat — if dedup is working correctly, the
combined homelog + live context stays manageable without aggressive budget enforcement.

**Status as of 2026-02-24**: blockId dedup was silently broken (wrong path to messages
array in homelogfull schema). Fixed in context-manager-v2-foveated-20feb2026.js (d3831ec).

---

## Context Manager v2 Architecture Note

The current `context-manager-v2-foveated-20feb2026.js` is already the live implementation
(confirmed 2026-02-24). It implements:
- Foveated history assembly from homelogfull
- seenIds dedup (dispatchId + blockId)
- Two-track budget (MEMORY_BUDGET + LIVE_RESERVE)

Open question: **live room context vs homelog ownership**
Does the live room context slot belong in the context manager's budget model, or is
it implicit as "the most recent slice of homelog"? Current implementation treats them
separately (correct for implementation reasons). Yeshua's mental model treats them as
unified (correct for conceptual reasons). Both are consistent; just different framings.

---

*See also: `docs/context-dedup-spec.md`, `shared/projects/foveated-v3/INTEGRATION-PATCH.md`*
