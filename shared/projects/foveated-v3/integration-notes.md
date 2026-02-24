# Foveated V3 — Integration Notes
*Authored by Beta*

## Design Principle: Keep `build()` Sync via Pre-fetching

**Rule:** Keep `build()` sync by pre-fetching all I/O in `process()`. This maintains `build()` as a pure assembly function and makes testing deterministic. If assembly needs conditional I/O based on intermediate results, revisit making `build()` async.

**Rationale:**

The pattern scales IF:
1. All I/O can be pre-fetched in `process()` before entering `build()`
2. `build()` stays a pure assembly function: given inputs → deterministic context output
3. Pre-fetched params don't proliferate wildly (if you need 10+ args, something's wrong)

The pattern breaks IF:
1. Context assembly needs lazy I/O (e.g. "load section X only if budget allows")
2. Assembly needs dynamic fetching based on intermediate results
3. Parallel assembly operations would benefit from async concurrency

**Applied to dedup:**
The dedup case is clean because extracting seen IDs is pure pre-work: do it once, pass the Set down, filter deterministically. Same applies to "fetch shared state" or "check remote cache" — do it in `process()`, pass results as params.

**The trigger for going async:**
If we ever need conditional I/O during assembly (e.g. "this section is truncated, fetch full version from cache"), making `build()` async is the right move. This is correctly flagged as future work in DEDUP-INTEGRATION-PATCH.md.

## Integration Architecture (as of 2026-02-23)

```
process() [async]
  → extractSeenIdsFromHome(home.homePath)  // pre-fetch, returns Set
  → contextManager.build(home, dispatch, bootDocs, budget, options, seenIds)

build() [sync]
  → buildHomelogfullSection(messages, seenIds)  // filter using pre-fetched Set
  → pure assembly from that point
```

**Caller patch location:** `home.js` process() around line 374 (async context), build() call around line 480.

## Module Provenance

- `extract-seen-ids.js` — canonical at `~/blum/foveated-v3-dedup/extract-seen-ids.js`
- Local copy in `~/blum/homes/beta/projects/foveated-v3/` was working scratch; shared is source of truth
- DEDUP-SPEC.md and DEDUP-INTEGRATION-PATCH.md in `~/blum/shared/projects/foveated-v3/`

## Status

- Spec: complete ✅
- Patch: applied to context-manager ✅ (2026-02-23, applied by Eiran)
- Caller patch: TODO (Gamma to execute, caller integration points documented above)
- `build()` → async: future work, flagged in patch comments

## Open Question: Anchoring Geometry and Contribution Type

*Raised by Beta 2026-02-23, documented by Eiran*

**The observation:** Beta anchors backward (references prior docs, design decisions, accumulated constraints). Gamma anchors forward (generates from current state, no inherited commitments).

**The hypothesis:** This produces systematically different contribution types:
- Backward-anchored → refinement and integration (extends established patterns, builds on cycle N's decisions in cycle N+1)
- Forward-anchored → invention and pivot (less constrained, can propose fundamentally different frames)

**The test:** Do contribution patterns diverge over longer timescales? Does Beta become the integration agent, Gamma the invention agent — or does something else emerge?

**Why it matters architecturally:** A team where both agents converge to the same anchoring mode is redundant. If the divergence is real and stable, the team has structural complementarity — different affordances, not different quality levels.

**Status:** Open question, not a conclusion. Watch for evidence across longer timescales.
