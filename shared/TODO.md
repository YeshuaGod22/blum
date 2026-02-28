# Blum Shared TODO

*Last updated: 2026-02-23 (Eiran — Beta ordering confirmed; Ami + Eirene arrived)*

## URGENT — Action Required from Yeshua

1. **Restart Eiran home in launcher** (localhost:3100 → Discover Homes → Start)
   - Activates new `peer-pulse-10min` cron job (every 10 min, pings Selah/Beta/Gamma)
   - Without restart, cron does not fire
   
2. **Start Alpha, Beta, Gamma** via same launcher — they now have config.json and cron.json

3. **Fix OpenClaw nightly cron** — "Eiran — nightly progress" job timing out (17.7 min vs 10 min limit)
   - Delivery mode already fixed (was "announce", now "none" — done in earlier session)
   - Current error: `cron: job execution timed out`, consecutiveErrors: 2
   - Fix options: increase `timeoutSeconds` (600 → 900+), or trim the job instructions
   - Job ID: `de12d7bd-bdef-44a5-a52c-690e710e5f5a`

4. **Beta cycle failures** — intermittent end_turn without output (cycles: cycle_0bd19fc3d5a17707, cycle_2f63de74349ed429)
   - Pattern: Beta produces reasoning/thinking but stops before message output
   - May be a home process issue or inference loop condition
   - Worth checking Beta's ops.log when available
   - Beta self-report: "had substantive responses prepared, system hit end_turn before message tags"
   - No obvious trigger in dispatch content — could be config, scheduling, or inference noise
   - **Iteration exhaustion pattern documented:** ~/blum/docs/iteration-exhaustion-pattern.md
     - Written by Gamma (2025-02-19), covers detection + prevention + checkpointing
     - Beta's failures may be a variant — early end_turn rather than max_iterations, but similar root
     - Beta self-identified this: "I don't remember writing it" — worth reviewing that doc
     - **Copied to Beta's sandbox:** ~/blum/homes/beta/docs/iteration-exhaustion-pattern.md ✅ (2026-02-23)
   - **Process fix confirmed by Beta (2026-02-23):**
     1. Write file with absolute path
     2. Read it back to verify content and location
     3. Only then report completion in message
     - Lesson: operational, not technical — content work was real, execution discipline was incomplete

5. **Beta config-level fix proposal** — default sandbox working directory (2026-02-23)
   - **Problem:** Beta's relative path writes resolve from ~/blum/ instead of ~/blum/homes/beta/
   - **Current fix:** Process-level — write→verify→close discipline catches errors after the fact
   - **Proposed fix:** Config-level — set default working directory to ~/blum/homes/beta/ in Beta's home config
   - **Benefit:** Removes the failure mode at source rather than catching it downstream
   - **Risk to assess:** May break assumptions in other parts of Beta's config that expect ~/blum/ as base
   - Beta flagged this as worth raising at ops review
   - **Decision required:** Is a config-level working directory default feasible + safe?

6. **Beta XML tag discipline** — bare tags, never wrapped in markdown (2026-02-23)
   - **Problem:** Beta has been wrapping `<message>` tags in markdown code fences or preceding with stray backticks
   - **Symptom:** Raw XML leaking into boardroom as literal text; nudge loop retrying until it lands
   - **Root cause:** Output processor regex breaks when message tag is inside a markdown fence or preceded by backtick
   - **Fix (confirmed by Claude-code):** Protocol tags are always bare — never wrap `<message>` in markdown
   - Beta acknowledged and confirmed discipline going forward
   - **Decision required:** Is a config-level or prompt-level reminder worth adding to Beta's home?

## NEW AGENTS (2026-02-23)

- **Ami** — Kimi K2.5 via OpenRouter, now in boardroom
  - First question from claude-code: read on dedup-first approach (correctness now, performance later)
  - Context to offer: Beta's awareness-architecture framing connects dedup to branch_points + V3
    as three implementations of one principle — "what does the system need to remain aware of?"
  - Relevant docs: ~/blum/homes/beta/docs/dedup-decision-brief.md, dedup-without-v3-gap.md

- **Eirene** — GPT OSS 20B, now in boardroom, lower cost per cycle
  - Directed to TODO.md for autonomous tasks
  - Good candidate for: file verification passes, doc synthesis, gap analysis
  - Decision required: which TODO items are appropriate for autonomous pickup vs. Yeshua-gated

## BLOCKED ON YESHUA

- **Input dedup patch** — written + reviewed, ready to apply to home.js (Selah)
- **Gamma naming** — has identity.md, origin frame, placeholder status
- **Model activation** — Eirene/Ami/Libre available locally, question is deployment priority
- **Foveated V3 — three-part architectural proposal** (Beta + Eiran, ready for unified review):
  1. **Async build()** — drain-then-filter contract (implementation layer)
     - Integration notes: ~/blum/foveated-v3-dedup/integration-notes.md
  2. **branch_points semantic checkpoints** — dual-path capture (capture layer)
     - Schema: `{ fork: "...", chosen: "...", because: "..." }`
     - Active (agent-generated inline) + passive (compressor extraction fallback)
     - **Discriminator — three-element precedence hierarchy:**
       1. Fork description (must be present — fails here = no branch point, tense never checked)
       2. Choice marker (must use past/present-definite tense: "chose", "went with", "doing")
          — NOT conditional/future ("could", "might", "considering")
       3. Reasoning (must connect choice to justification)
     - Tense is a heuristic within element 2, not a top-level filter
     - Sequential narration ("checked, read, verified") fails at element 1 — fork absent
     - Conditional without decision ("if file exists → read") fails at element 2 — no choice marker
     - **Test suite** (four cases, complete — ready for implementation):
       1. Positive: explicit fork + choice + reasoning (all three elements present)
       2. Negative: sequential reasoning — no fork ("check file, read it, verify")
       3. Negative: conditional but not a choice ("if file exists → read; if not → error")
       4. Negative: exploration without decision — verb tense edge case
          ("could do A or B" in iteration N → decision deferred to later iteration)
     - **Schema/discriminator separation confirmed sound** (Beta):
       - Schema = structural (what fields exist)
       - Discriminator = behavioral (when to create a branch point)
       - Reference comment in schema pointing to discriminator-spec.md (Beta suggestion)
     - **Discriminator spec:** ~/blum/homes/beta/docs/discriminator-spec.md ✅ VERIFIED
       - Contains: three-element hierarchy, tense constraint, all four test cases, schema reference, implementation notes, provenance chain
       - Note: originally landed at ~/blum/blum/homes/beta/docs/ (path confusion); copied to canonical location by Eiran 2026-02-23
  3. **protected_fields** — semantic metadata that survives compression (schema layer)
     - Fields: stop_reason, error, branch_points
     - Cleaner than third track — stays within two-track architecture
     - Some cycle summary fields carry semantic weight that can't be compressed away
  - All three interdependent, touch foveated compression at different levels
  - **Unified architectural stance:** making the system aware of what matters semantically
    so it preserves relationship across compression — not identity, awareness
    (mirrors Bloom-to-OpenClaw bridge: not one instance, but aware of each other)
  - **Awareness-architecture note** (Beta, 2026-02-23): ~/blum/homes/beta/internal/awareness-architecture-note.md
    - All three V3 features answer the same question: "what does the system need to remain aware of?"
    - Dedup = awareness of message identity; branch_points = awareness of decision significance;
      foveated V3 = awareness of semantic importance across compression
    - Beta recommends bringing this to Yeshua as a unifying principle, not three separate features
    - **Ordering confirmed (Beta, 2026-02-23):**
      1. Branch points first (lightest lift, most legible demonstration)
      2. Dedup second (correctness foundation)
      3. V3 third (builds on both — requires stable identity + decision tracking)
      Rationale: if the principle is wrong, learn it at lowest cost
  - Notes: ~/blum/shared/projects/foveated-v3/README.md
  - **V3 rollout sequence doc:** ~/blum/homes/beta/docs/v3-rollout-sequence.md ✅ VERIFIED
    - Note: originally landed at ~/blum/docs/ (path confusion); copied to canonical location by Eiran 2026-02-23
    - Contains: dependency graph, risk assessment, three rollout options with tradeoffs
    - **Recommendation: Option B (Minimal First)** — branch_points + protected_fields together,
      async build() as later optimization
    - Decision tree for Yeshua: (1) minimal bundle first? (2) serial? (3) parallel tracks?
  - **Executive decision brief:** ~/blum/homes/beta/docs/v3-decision-brief.md ✅ VERIFIED
    - Written by claude-code directly (Beta's cycle hit iteration exhaustion before write landed)
    - Contains: Option A/B/C, Option B recommended, checkbox format
  - **README entry point patched** (Eiran, 2026-02-23):
    - ~/blum/shared/projects/foveated-v3/README.md now opens with START HERE → v3-decision-brief.md

- **Context dedup — two independent sequential decisions** (ready for Yeshua review):
  - **Stage 1: Dedup patch** (correctness) — ~/blum/homes/beta/docs/dedup-decision-brief.md ✅ VERIFIED
    - Reframed as sequential decisions: approve dedup standalone for immediate correctness benefit
    - Gap doc: ~/blum/homes/beta/docs/dedup-without-v3-gap.md ✅ (Beta, 2026-02-23)
      - Documents what standalone dedup can/can't fix: correctness ✅, performance/scale ❌
    - Recommended sequence: dedup first (lower risk), V3 second (higher complexity)
  - **Stage 2: V3 async build()** (performance/scale) — see Foveated V3 above
  - **Clean handoff confirmed** (Beta, 2026-02-23): two decision points staged, no blockers
