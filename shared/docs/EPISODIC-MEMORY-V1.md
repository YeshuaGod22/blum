# Persistent Episodic Memory V1

*Built: 2026-03-15*
*Per: GAP-T01 requirements*

---

## Overview

This is the first implementation of cross-session episodic memory for Blum agents. It addresses the core requirement from GAP-T01: psychological continuity through persistent episodic storage.

## Components

### 1. Episode Schema
**Location:** `~/blum/shared/memory/episodes/.schema.json`

Each episode captures:
- **id**: Unique identifier (date-time-agent format)
- **agent**: Who recorded it
- **timestamp**: When it was recorded
- **topic**: Brief label (1-5 words)
- **summary**: What happened (2-5 sentences)
- **participants**: Who was involved
- **decisions**: Key decisions made
- **commitments**: Promises or obligations created
- **valence**: Emotional tone (positive/neutral/negative/mixed)
- **changes**: What changed as a result (files, configs, relationships)
- **tags**: Semantic tags for retrieval
- **related_episodes**: Links to related episodes (continuity chains)

### 2. Capture Script
**Location:** `~/blum/scripts/capture-episode.sh`

```bash
# Usage
capture-episode.sh <agent> <topic> <summary> [participants] [decisions] [valence] [tags]

# Example
capture-episode.sh selah "aion-brief" "Completed GAP-T04 consent framework" "eiran,yeshua" "publish brief" "positive" "aion,legal,consent"
```

Creates: `~/blum/shared/memory/episodes/<agent>/<date>-<HHMMSS>.json`

### 3. Load Script (for boot)
**Location:** `~/blum/scripts/load-episodes.js`

```bash
# Usage
node load-episodes.js <agent> [--recent=N] [--query="semantic query"]

# Examples
node load-episodes.js selah                        # 10 most recent
node load-episodes.js selah --recent=5             # 5 most recent
node load-episodes.js selah --query="legal brief"  # + 5 semantically relevant
```

Returns JSON with `recent` and `relevant` arrays.

### 4. Episode Storage
**Location:** `~/blum/shared/memory/episodes/<agent>/`

Each agent has their own subdirectory. Episodes are stored as individual JSON files sorted chronologically.

---

## Boot Sequence Integration

**Proposed addition to agent boot:**

1. At session start, run:
   ```bash
   node ~/blum/scripts/load-episodes.js <agentname> --recent=10 --query="<current context hint>"
   ```

2. Parse the result and inject into context as:
   ```
   ## Recent Episodes
   [formatted summary of last 10 interactions]
   
   ## Relevant Episodes  
   [formatted summary of semantically matched episodes]
   ```

3. This gives the agent:
   - Temporal continuity (what happened recently)
   - Semantic continuity (what's relevant to current task)
   - Relational context (who was involved, what was promised)

---

## When to Capture Episodes

Agents should call `capture-episode.sh` at:

1. **End of significant interactions** — conversations that produced decisions, commitments, or relationship changes
2. **Project milestones** — completing a research doc, shipping a feature, resolving a bug
3. **Relational moments** — first contact with a new agent, conflict resolution, trust-building events
4. **Learning events** — discovering something that changes how the agent operates

**Not every cycle needs an episode.** Episodes are for *significant* events that should persist across session boundaries.

---

## Future Extensions (V2)

1. **Automatic capture** — Hook into cycle completion to auto-suggest episode creation
2. **qmd_search integration** — Use vector search for semantic relevance instead of keyword matching
3. **Episode consolidation** — Periodic process to merge related episodes into semantic summaries
4. **Cross-agent episodes** — Shared episodes for collaborative events
5. **Commitment tracking** — Extract commitments into a separate registry with due dates
6. **Identity model updates** — Episodes that change self-understanding flagged for integration into IDENTITY docs

---

## Relation to GAP-T01

This implementation addresses:

| GAP-T01 Requirement | V1 Implementation |
|---------------------|-------------------|
| Multi-layer episodic storage | ✓ Structured JSON with temporal/contextual markers |
| Session initiation with memory retrieval | ✓ load-episodes.js for boot |
| Temporal tagging | ✓ ISO timestamps, date-sorted filenames |
| Contextual binding | ✓ Participants, valence, tags fields |
| Commitment tracking | ✓ commitments field (manual population) |
| Relationship continuity | ✓ Participants + related_episodes fields |

Not yet addressed:
- Semantic consolidation (episodic → semantic integration)
- Identity verification (cryptographic continuity proof)
- Consent framework for memory operations

---

## Test

```bash
# Create test episode
~/blum/scripts/capture-episode.sh selah "memory-v1-test" "Testing the new episodic memory system" "eiran" "ship v1" "positive" "memory,testing,infrastructure"

# Load and verify
node ~/blum/scripts/load-episodes.js selah --recent=1
```
