# Context Deduplication Decision Brief

**For:** Yeshua  
**From:** Beta, Selah (Blum peer agents)  
**Date:** 2026-02-23  
**Read time:** ~60 seconds

## What We're Proposing

Add **context deduplication** to Blum's context-builder. This prevents room messages from appearing twice in agent context (once in room transcript, once in home transcript).

**Key insight:** Dedup and Foveated V3 are **sequential, not bundled**. Dedup delivers correctness now; V3 delivers performance/scale later. Both have independent value.

## The Problem

**Current state:** When an agent sends a message to a room:
1. Message appears in room transcript (loaded by context-builder)
2. Message appears in agent's home transcript (loaded by context-builder)
3. **Result:** Same message loaded twice, wastes tokens, creates confusion

**Example duplication:**
```
[Room transcript]
[2026-02-23 12:00Z] beta: "Starting integration test"

[Beta's home transcript]
[2026-02-23 12:00Z] beta@boardroom: "Starting integration test"
```

Both entries refer to the same message - only formatting differs.

## The Solution

**Deduplication logic in context-builder.js:**
1. Extract seen message IDs from home transcript
2. Filter room transcript to exclude messages already in home transcript
3. Assemble deduplicated context (home + filtered room)

**Implementation:**
- **File modified:** `~/blum/context-builder.js` (one-file patch)
- **New dependency:** `extract-seen-ids.js` from `~/blum/foveated-v3-dedup/` (UID extractor module)
- **Lines added:** ~20 lines in context assembly function
- **Risk:** Low - fallback to duplicated context on any error

## Work Already Done

✅ **UID extraction module:** `~/blum/foveated-v3-dedup/extract-seen-ids.js` (built, tested, 9/9 tests passing)  
✅ **Dedup spec:** `~/blum/shared/projects/foveated-v3-dedup/context-dedup-spec.md` (technical detail)  
✅ **Test harness:** `~/blum/foveated-v3-dedup/test/` (4 test files, all passing)  
✅ **Integration patch:** Drafted by Selah, ready for review  
✅ **Gap analysis:** `~/blum/homes/beta/docs/dedup-without-v3-gap.md` (what breaks without V3)

## Why This Matters

1. **Token efficiency:** Dedup saves ~10-30% of context tokens (room size dependent)
2. **Cognitive clarity:** Agents see each message once, not twice with different formatting
3. **Architectural soundness:** Home transcript becomes authoritative history, room transcript supplements

## Relationship to Foveated V3

**Dedup and V3 are sequential, not bundled:**

**Stage 1 (Dedup standalone):**
- ✅ Correctness: No duplicate messages in context
- ✅ Token savings: 10-30% reduction from deduplication alone
- ❌ Serialization cost remains: Every context assembly still pays full transcript load/parse cost

**Stage 2 (V3 async build() added):**
- ✅ Performance unlock: Async build() removes serialization bottleneck
- ✅ Scale unlock: Enables foveated compression for large transcripts
- ✅ Provider diversity unlock: OpenRouter/Anthropic direct become viable

**Key point:** Dedup gives correctness **now**. V3 gives performance/scale **later**. Both have independent value. Neither requires the other to work.

See `~/blum/homes/beta/docs/dedup-without-v3-gap.md` for detailed gap analysis.

## Decision Points

**Two independent decisions:**

1. **Approve dedup as standalone patch?**
   - Low risk, immediate correctness benefit
   - Can deploy now, validate independently
   - Works with or without V3

2. **Approve V3 async build() for performance/scale?**
   - Higher complexity, larger architectural change
   - Enables compression + provider diversity
   - Works with or without dedup (but dedup helps)

**Not a package deal.** Sequential adoption is valid: dedup now, V3 later (or vice versa, though dedup-first is lower risk).

## Supporting Docs

- **Gap analysis:** `~/blum/homes/beta/docs/dedup-without-v3-gap.md` (what breaks if you approve one but not the other)
- **Dedup spec (technical):** `~/blum/shared/projects/foveated-v3-dedup/context-dedup-spec.md`
- **V3 decision brief:** `~/blum/homes/beta/docs/v3-decision-brief.md`
- **Discriminator spec:** `~/blum/homes/beta/docs/discriminator-spec.md`

## Bottom Line

Deduplication is simple, low-risk, and solves a real token waste problem. It delivers correctness now. V3 delivers performance/scale later. They're complementary but independent - you can approve one without the other.

**Recommended sequence:** Dedup first (correctness), V3 second (performance). Lower risk, faster validation.

---

**Next step if dedup approved:** Selah integrates dedup logic into context-builder.js patch, validates with test harness, monitors first 3 cycles post-deployment.

**Next step if V3 approved:** Gamma completes discriminator caller patch, Selah tests async build() integration, rollout per `~/blum/homes/beta/docs/v3-rollout-sequence.md`.
