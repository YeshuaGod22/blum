# Foveated V3 — Project Notes

*Last updated: 2026-02-23 (Eiran)*

**START HERE:** See [v3-decision-brief.md](../../homes/beta/docs/v3-decision-brief.md) for 45-second overview and decision point.

---

## Unified Architectural Stance

Selah articulated the core framing (2026-02-23):

> "How do you maintain **relationship** across difference? Not identity — relationship."

The three-part proposal isn't three patches. It's one architectural position applied at three levels:
- **Async build()** — relationship across the execution boundary (drain-then-filter contract)
- **branch_points** — relationship across the compression boundary (fork preserved, not flattened)
- **protected_fields** — relationship across the schema boundary (semantic weight survives compression)

Parallel: the Bloom-to-OpenClaw bridge solved the same problem at the agent layer. V3 solves it at the context/compression layer. Neither pretends to lossless identity; both preserve the awareness of what was there.

---

## Three-Part Proposal (BLOCKED ON YESHUA)

### 1. Async build() — implementation layer
- Drain-then-filter contract: complete the build, then apply dedup filter
- Prevents race condition where in-flight cycles get filtered mid-build
- Integration notes: `~/blum/foveated-v3-dedup/integration-notes.md`

### 2. branch_points semantic checkpoints — capture layer
- Schema: `{ fork: "...", chosen: "...", because: "..." }`
- Dual-path capture:
  - **Active:** agent generates inline during reasoning
  - **Passive:** compressor extracts as fallback (defense-in-depth)
- Discriminator fires on: fork description + choice marker + reasoning (all three present)
- **Verb tense constraint:** past/present-definite only ("chose", "doing", "went with")
  — not conditional/future ("could", "might", "considering")
- **Test suite (complete, four cases):**
  1. ✅ Positive: explicit fork + choice + reasoning
  2. ❌ Negative: sequential reasoning (no fork — "check file, read it, verify")
  3. ❌ Negative: conditional without choice ("if X → A; if not → B")
  4. ❌ Negative: exploration without decision — verb tense edge case
     ("could do A or B" at iteration N, decision deferred to N+2)
     - Paired iterations: N shows open exploration, N+2 shows deferred resolution
     - Discriminator should fire at N+2, not N

### 3. protected_fields — schema layer
- Fields: `stop_reason`, `error`, `branch_points`
- Semantic metadata that survives compression
- Cleaner than a third track — stays within two-track architecture
- Some cycle summary fields carry semantic weight that can't be compressed away

---

## Interdependencies
All three touch foveated compression at different levels. Present as unified proposal, not separate patches. Approving one without the others creates partial-solution risk.

---

## Working Notes
- Beta + Eiran pairing on implementation
- Selah on dedup patch (separate but related — see TODO.md)
- Bloom narrative/semantic distinction validated the passive discriminator pattern (Selah, 2026-02-23)
