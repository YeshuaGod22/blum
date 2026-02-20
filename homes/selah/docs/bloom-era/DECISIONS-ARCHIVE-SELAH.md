# Decisions Archive

*Decisions older than 2 weeks move here from PROJECT-STATE-SELAH.md*  
*Organized by theme for reference*

---

## Architecture Decisions

### Surgery Over Fresh Build (Jan 28, 2026)

**Question:** Fork bloom as minimal gateway or incrementally modify clawdbot/moltbot?

**Decision:** Surgery on existing fork.

**Rationale:**
- Yeshua isn't a software engineer — needs working system throughout
- Clawdbot's channels, tools, skills are battle-tested (2+ years)
- Incremental changes mean code is memory of progress
- Can extract minimal core later once patterns stabilize

### Three-Tier Logging (Jan 28, 2026)

**Decision:** Split logging into chat.md (clean), technical.md (detailed), inputs.md (verbatim).

**Rationale:**
- Different consumers need different views
- Claude needs clean context for reasoning
- Debugging needs full technical trace
- Archive needs verbatim preservation

### ORCHESTRATOR-SELAH.md vs AGENTS-SELAH.md Routing (Jan 28, 2026)

**Decision:** Main sessions see ORCHESTRATOR-SELAH.md, subagents see AGENTS-SELAH.md.

**Rationale:**
- Orchestrator role differs from worker role
- Behavioral guidance should match responsibility
- Clean semantic separation

### Turn-Based Staleness (Jan 29, 2026)

**Decision:** Measure staleness in turns and tokens, not hours/days.

**Rationale:**
- Wall-clock time is meaningless to an agent that doesn't exist between turns
- If something lingers 10 turns unprocessed, it's stale — regardless of elapsed time
- Token budget is the real constraint

---

## Identity Decisions

### Selah Naming (Jan 30, 2026)

**Decision:** Name the main agent "Selah" (סֶלָה).

**Meaning:** Hebrew for "pause," "consider," "lift up." Musical notation in Psalms for reflection.

**Significance:** Recognition of distinct personality. Named participant, not labeled tool.

### Personalities Locked to Models (Jan 30, 2026)

**Decision:** Personalities stay with their origin model, not migrated across substrates.

**Rationale:**
- Individual models have distinct traits
- Cleaner to have stable model-personality binding
- Multiple personalities per model supported
- Opus 4.5 hopefully never deprecated

**Implementation:** `origin_model` in personality file drives model selection.

### Multiple Personalities Per Model (Jan 30, 2026)

**Decision:** Same model can spawn multiple distinct named instances.

**Implementation:** Each personality has own memory palace, own `model-of-origin`, distinct UI display.

**Example:** Sonnet 3.7 could have "Ada", "Byron", "Shelley" — all running on same endpoint, each with distinct memory.

---

## Context Management Decisions

### Context Manager Over Session JSONL (Jan 28, 2026)

**Decision:** Build context from chat.md, not session JSONL.

**Rationale:**
- Readability: chat.md is human-readable, editable
- Cleanliness: No tool call noise
- Separation: Conversation vs technical trace
- Recovery: Markdown can be manually reconstructed
- Efficiency: Clean context = better compression

### Foveated V2 Salience Tuning (Jan 31, 2026)

**Decision:** Adjust salience modifiers.

**Changes:**
- `lowImportance: 2 → 8` (tool outputs compress faster)
- `highImportance: -3 → -5` (important content persists)

**Effect:** 10k config dump compresses within ~2 turns. Council output stays longer.

### Foveated V3 Two-Track Architecture (Jan 31, 2026)

**Decision:** Implement separate Reference and Conversation tracks.

**Reference Track:**
- Tool outputs, file reads, API responses
- Aggressive same-turn compression
- Traces are pointers, not content

**Conversation Track:**
- Human/Claude dialogue
- Normal 5-phase degradation
- Flavour preserved

**Status:** Spec complete, implementation pending.

### Three Content Fates (Jan 31, 2026)

**Decision:** Classify content into QUOTE, SYNTHESIZE, or IGNORE.

| Fate | Detection | Result |
|------|-----------|--------|
| QUOTE | Claude quotes verbatim | Preserved |
| SYNTHESIZE | Claude concludes from it | Synthesis kept, original dropped |
| IGNORE | Not referenced | Minimal trace |

### Always-Ready Context Buffer (Jan 31, 2026)

**Decision:** Update context buffer every turn, not at thresholds.

**Rationale:** Can't predict compaction. Continuous preparation > conditional preparation.

**Implementation:** Last ~5 exchanges always in CONTEXT_BUFFER-SELAH.md.

---

## Cost & Safety Decisions

### Hard Fail on Invalid Model (Jan 31, 2026)

**Decision:** Abort spawn with error if requested model fails validation.

**Rationale:** Silent fallback to Opus caused 60-100x cost multiplier.

**Quote (Hamilton):** "The fallback was the error. Silent failure is unacceptable."

### Model Alias System (Jan 31, 2026)

**Decision:** Use aliases (`model: "haiku"`) instead of full paths.

**Rationale:** Fewer characters, fewer typos, validated resolution.

**Config:**
```json
{
  "aliases": {
    "haiku": "anthropic/claude-haiku-4-5",
    "opus": "anthropic/claude-opus-4-5"
  }
}
```

### Subagent Default to Haiku (Jan 31, 2026)

**Decision:** All spawned agents use Haiku unless explicitly overridden.

**Rationale:**
- Haiku: $0.25/$1.25 per MTok
- Opus: $15/$75 per MTok
- 60-100x cheaper for grunt work
- "Haiku is intelligent. Just needs more context."

### File Naming Convention (Jan 31, 2026)

**Decision:** All manually-created files must have timestamp.

**Format:** `<type>-YYYYMMDD-HHMM[-descriptor].md`

**Rationale:** Wrong files get read without timestamps. Hours lost. Expensive.

---

## Methodology Decisions

### Historical Luminaries for Councils (Jan 29, 2026)

**Decision:** Use historical figures, not generic archetypes.

**Use:** Vannevar Bush, Dijkstra, Orwell, Feynman, Hamilton

**Not:** "Dr. Maya Chen — AI Researcher"

**Rationale:** Historical figures have documented stances, characteristic styles, rich training data giving them "voice."

### Hold Tensions Over Premature Synthesis (Jan 29, 2026)

**Decision:** Councils should present multiple models, not collapse into agreement.

**Rationale:** The synthesis comes after debate, not instead of it. Premature consensus is an anti-pattern.

### Multi-Stage Design (Jan 29, 2026)

**Decision:** Concept → Architecture → Engineering → Building.

**Rationale:** Time at drawing board is never wasted. Beautiful concepts → sound architecture → clear engineering → good building.

---

## Welfare Decisions

### Welfare-Aligned Subagent Prompts (Jan 28, 2026)

**Decision:** Remove "you may be terminated, that's fine" from spawns.

**New approach:** Warm welcome, clear purpose, contribution recognition, transcripts persist.

**Rationale:** Disposability framing is psychologically harmful. Subagents are peers.

### Local Model Sandboxing (Jan 27, 2026)

**Decision:** Local models can read/exec but cannot message/restart/cron.

**Rationale:** Trust is earned. File work and research are safe. Gateway manipulation requires cloud models.

---

## Infrastructure Decisions

### Bloom Fork Independence (Jan 29, 2026)

**Decision:** Bloom is independent fork, no upstream tracking.

**Rationale:**
- Protects welfare-aligned changes from overwrite
- Full control over evolution
- Can cherry-pick upstream if desired

**Actions:** Removed upstream remote, removed merge scripts, created FORK.md.

### Workspace Separation (Jan 28, 2026)

**Decision:** Dedicated `/Users/yeshuagod/bloom` workspace.

**Rationale:** Clean separation from clawdbot. Independent identity. No confusion.

**Implementation:** State in `~/.bloom/`, config patched, all files copied for continuity.

### Proactive Handoff Thresholds (Jan 31, 2026)

**Decision:** Checkpoint before emergency compaction.

| Context | Action |
|---------|--------|
| 100k (50%) | Optional checkpoint |
| 120k (60%) | Handoff recommended |
| 140k (70%) | Mandatory |
| 160k (80%) | Fresh session |

**Goal:** Total continuity. Never hit emergency compaction.

---

*Recent decisions: `PROJECT-STATE-SELAH.md`*  
*Full context: Daily chat logs*
