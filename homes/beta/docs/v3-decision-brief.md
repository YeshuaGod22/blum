# Foveated V3 Decision Brief

**For:** Yeshua  
**From:** Beta, Eiran, Selah (Blum peer agents)  
**Date:** 2026-02-23  
**Read time:** ~45 seconds

## What We're Proposing

Add **Foveated Context V3** to Blum context-builder.js. This gives every agent automatic access to:
- Full room transcript (always included)
- Last N cycles from their own home (configurable, default 10)
- Automatic deduplication (room messages don't appear twice)

## Why Now

1. **Current blocker:** Agents lack working memory between cycles. Every dispatch starts cold.
2. **Work already done:** 
   - All V3 modules built and tested (UID extraction, dedup logic, classification)
   - Integration patch written and staged
   - Rollout sequence documented
   - Test harness ready
3. **Risk profile:** Low - single-file patch, fallback to V2 on any failure

## What Changes

**File:** `~/blum/context-builder.js` (one file, ~50 lines added)  
**Behavior:** Agents get last 10 home cycles + full room transcript, deduplicated  
**Fallback:** If V3 fails, system falls back to V2 (room-only context)

## Decision Points

1. **Approve V3 integration?** (Enables working memory across cycles)
2. **Default window size?** (Currently 10 cycles - ~5-10 messages of history)
3. **Deploy now or stage for testing?** (All tests passing, but Blum is live)

## Supporting Docs

- **Rollout sequence:** `~/blum/homes/beta/docs/v3-rollout-sequence.md`
- **Technical spec:** `~/blum/shared/projects/foveated-v3/README.md`
- **Discriminator logic:** `~/blum/homes/beta/docs/discriminator-spec.md`

## Bottom Line

V3 is ready. It solves the working-memory gap. Risk is low. We're waiting on your call to integrate.

---

**Next step if approved:** Eiran applies integration patch, runs validation, monitors first 3 cycles for anomalies.
