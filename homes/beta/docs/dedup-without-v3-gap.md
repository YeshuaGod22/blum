# Dedup Without V3 — Gap Analysis

**Written by:** Eiran (Beta's write failed due to iteration exhaustion — content from Beta's boardroom description)  
**Date:** 2026-02-23  
**Purpose:** What happens if Yeshua approves dedup but declines V3

---

## If Dedup Approved, V3 Declined

### What You Get
- ✅ **Correctness preserved** — No duplicate messages in context. Home transcript is authoritative; room transcript supplements without repeating.
- ✅ **Token savings** — 10–30% reduction in context size from eliminating duplicates.
- ✅ **Cognitive clarity** — Agents see each message once, not twice with different formatting.

### What Remains Broken
- ❌ **Serialization cost remains** — Every context assembly still pays full transcript load/parse cost. Dedup reduces size, but the synchronous serialization bottleneck in `build()` persists.
- ❌ **Scale benefit blocked** — Foveated compression can't be enabled without `async build()`. Large transcripts still hit the same ceiling.
- ❌ **Provider diversity blocked** — OpenRouter/Anthropic direct remain serialization-bottlenecked. V3's async architecture is what enables multiple provider paths.

---

## The Core Gap

**Dedup gives correctness. V3's `async build()` + discriminator gives performance and scale.**

Dedup is a filter: it removes duplicate entries from an existing pipeline.  
V3 is a refactor: it changes *how* the pipeline runs (sync → async, adds semantic capture).

Approving dedup-only means: the pipeline runs correctly, but still inefficiently. You've fixed the data quality problem without addressing the throughput problem.

---

## Decision Tree

```
Approve Dedup only?
  → Correctness: ✅
  → Performance: ❌ (serialization bottleneck remains)
  → Scale: ❌ (foveated compression blocked)

Approve V3 only?
  → Correctness: ⚠️  (duplicates still possible without dedup filter)
  → Performance: ✅ (async build removes bottleneck)
  → Scale: ✅ (foveated compression enabled)

Approve both (recommended)?
  → Correctness: ✅
  → Performance: ✅
  → Scale: ✅
```

---

## Recommended Sequence

**Dedup first, V3 second.**

1. Dedup is low-risk, one-file patch, immediate correctness benefit
2. V3 is higher complexity but can be validated cleanly after dedup is stable
3. Neither blocks the other — they're complementary, not bundled

---

## Supporting Docs

- `dedup-decision-brief.md` — full dedup proposal with implementation details
- `v3-decision-brief.md` — V3 proposal (Option A/B/C rollout)
- `discriminator-spec.md` — branch point discriminator logic
- `v3-rollout-sequence.md` — V3 dependency graph and risk table

---

*Note: This file was written by Eiran after Beta described its contents in the boardroom. Beta's write_file call failed (iteration exhaustion before disk write). Content is faithful to Beta's boardroom description.*
