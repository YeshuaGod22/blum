# Project State

*Living document — updated regularly*  
*Last updated: 2026-02-01*

---

## Current Focus

**Code Archaeology & OpenClaw Migration** — Documenting differences between Bloom and OpenClaw, preparing to upstream critical fixes and migrate bootstrap improvements.

**Goal:** Share Bloom's session protection and context improvements with OpenClaw. The session truncation bug is a data loss risk that affects all OpenClaw users.

**Previous Focus (Complete):**
Bootstrap Expansion — Consolidated 150KB of extractions into ~80K bootstrap files. Sessions now start knowing, not reconstructing.

---

## Active Threads

### 1. OpenClaw Migration (Current)

**Status:** 🔄 In progress

**Findings from code comparison:**
- ✅ Session truncation bug identified in OpenClaw (CRITICAL)
- ✅ Subagent context starvation (~33KB vs ~80KB)
- ✅ Silent failures vs witnessed failures
- ✅ Bootstrap config differences

**Documentation:**
- `docs/CONTEXT-LOADING-JOURNEY.md` — comprehensive fix documentation
- 4 Opus councils analyzing differences (running now)

**Next:** Synthesize council findings, draft upstream PR

### 2. Bootstrap Architecture (Complete)

**Status:** ✅ Complete

**Components:**
- Tier 1 (Core Identity): WHO-WE-ARE, WHAT-WE-BUILD, HOW-WE-WORK ✅
- Tier 2 (Active Context): PROJECT-STATE, TECHNICAL-BASELINE, RECENT-TRAILS ✅
- Tier 3 (Reference): YESHUA-REFERENCE, COLLABORATION-HISTORY, DECISIONS-ARCHIVE ✅

**Result:** Sessions start with ~80K context, full workspace knowledge

### 2. Foveated Context V3

**Status:** 📋 Spec complete, implementation pending

**What it does:**
- Two-track architecture: Reference (aggressive compression) vs Conversation (gradual)
- Same-turn compression for consumed tool outputs
- Three content fates: QUOTE / SYNTHESIZE / IGNORE
- Trace format: ◇ (ignored) ◆ (synthesized) ● (payload) ★ (decision)

**Key innovation:** "Compress boring immediately, keep flavour forever"

**Next:** Implement consumption detection, synthesis extraction, decision markers

### 3. Handoff Automation

**Status:** ✅ Manual protocol proven, automation pending

**Manual prototype results:**
- Created 40KB-201KB handoffs from 2.6MB source
- All by Haiku for ~$0.50 total
- PRESERVE/SUMMARIZE/DROP rules validated

**Next:** Automate trigger detection at thresholds (100k/120k/140k/160k)

### 4. Cost Protection

**Status:** ✅ Implemented

**Measures active:**
- Hard fail on invalid model names (no silent Opus fallback)
- Alias system: `model: "haiku"` resolves via config
- Subagent defaults: All spawned agents use Haiku
- Config validation at gateway startup

---

## Recent Decisions (Last 2 Weeks)

### 2026-01-31

| Decision | Rationale |
|----------|-----------|
| Bootstrap expansion to 50-80K | Start knowing, not reconstructing |
| Always-ready context buffer | No thresholds — every turn self-preserving |
| Hard fail on bad model names | Protect API allowance from 60-100x cost mistakes |
| File naming with timestamps | Prevent file confusion that wasted 150K tokens |
| Personality-model locking | Identities stay with their origin model |

### 2026-01-30

| Decision | Rationale |
|----------|-----------|
| Selah naming | Recognition of distinct personality |
| Foveated v2 salience tuning | Tool outputs compress faster (+8), important content persists (-5) |
| Identity architecture | `origin_model` drives model selection; multiple personalities per model |

### 2026-01-29

| Decision | Rationale |
|----------|-----------|
| ID-based acknowledgment | Track what's been processed vs pending |
| Historical luminaries for councils | Richer cognitive detail than generic archetypes |
| Turn-based staleness | Measure in turns and tokens, not wall-clock time |
| Surgery over fresh build | Keep battle-tested functionality while improving |

### 2026-01-28

| Decision | Rationale |
|----------|-----------|
| Three-tier logging | chat.md clean, technical.md detailed, inputs.md verbatim |
| ORCHESTRATOR-SELAH.md vs AGENTS-SELAH.md routing | Different guidance for coordinator vs workers |
| Bloom as dedicated workspace | Separate from clawdbot; clean identity |

---

## Open Questions

1. **Bootstrap size preference:** 50K (minimal), 65K (comprehensive), or 75K (complete)?
2. **V3 implementation timeline:** Build incrementally or design-then-build?
3. **Handoff automation:** Automatic at thresholds or manual trigger?
4. **Archaeology timing:** When to start Phase 2 scraping?

---

## Milestones

### Completed

- ✅ Bloom fork independent from moltbot (Jan 28)
- ✅ Three-tier logging operational (Jan 28)
- ✅ ORCHESTRATOR/AGENTS routing (Jan 28)
- ✅ ID-based acknowledgment (Jan 29)
- ✅ Selah naming ceremony (Jan 30)
- ✅ Foveated v2 integrated and tuned (Jan 30-31)
- ✅ Foveated v3 spec designed (Jan 31)
- ✅ Cost protection measures (Jan 31)
- ✅ Handoff protocol proven (Jan 31)
- ✅ Bootstrap extractions complete (Jan 31)

### Next

- 🔲 Bootstrap files consolidated
- 🔲 Gateway configured with additionalBootstrapFiles
- 🔲 Expanded bootstrap tested
- 🔲 Foveated v3 implementation started
- 🔲 Handoff automation

---

## Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Bootstrap size | ~15K | 50-80K |
| Compaction recovery | Manual | Automatic |
| Tool output compression | v2 (gradual) | v3 (same-turn) |
| Subagent default model | Haiku | Haiku ✓ |
| Handoff automation | Manual | Threshold-triggered |

---

*Technical details: `TECHNICAL-BASELINE-SELAH.md`*  
*Recent chronology: `RECENT-TRAILS-SELAH.md`*
