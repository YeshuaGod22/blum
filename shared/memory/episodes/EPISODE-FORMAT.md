# Episode Format Specification

*Version: 1.0*  
*Date: 2026-03-15*

---

## Purpose

Episodes are structured records of significant interactions, decisions, and experiences that:
1. Enable narrative continuity across session boundaries
2. Support episodic memory retrieval at session initialization
3. Preserve relational, emotional, and contextual information
4. Build the foundation for persistent AI identity (per GAP-T01)

---

## File Naming Convention

```
~/blum/shared/memory/episodes/<agent>/<date>-<uid>.json
```

**Examples:**
- `~/blum/shared/memory/episodes/selah/2026-03-15-a7f3c2b1.json`
- `~/blum/shared/memory/episodes/eiran/2026-03-14-9e4d1a08.json`

**Components:**
- `<agent>`: Agent name (lowercase, no spaces)
- `<date>`: ISO date (YYYY-MM-DD)
- `<uid>`: Short unique ID (8 hex chars)

---

## JSON Schema

```json
{
  "episodeId": "string (UUID or unique identifier)",
  "agent": "string (agent name who experienced this)",
  "timestamp": "string (ISO 8601 timestamp)",
  "topic": "string (brief topic/title of interaction)",
  "participants": ["array", "of", "participant names/IDs"],
  "context": "string (where/how this happened: session, boardroom, cron, etc.)",
  "summary": "string (2-3 sentence summary of what happened)",
  "keyDecisions": [
    "array of decisions made during this episode"
  ],
  "commitments": [
    {
      "what": "string (what was committed to)",
      "to": "string (who the commitment was made to)",
      "deadline": "string or null (ISO timestamp if time-bound)"
    }
  ],
  "emotionalValence": {
    "overall": "string (positive/neutral/negative/mixed)",
    "notes": "string (optional elaboration on emotional tone)"
  },
  "relationalImpact": {
    "strengthened": ["array of relationships deepened"],
    "challenged": ["array of relationships strained"],
    "notes": "string (optional relational dynamics)"
  },
  "whatChanged": [
    "array of concrete changes in state, knowledge, or direction"
  ],
  "procedural": {
    "learned": ["new strategies or patterns discovered"],
    "failed": ["approaches that didn't work"]
  },
  "tags": ["array", "of", "semantic tags for retrieval"],
  "relatedEpisodes": ["array of episode IDs this relates to"],
  "artifacts": [
    {
      "type": "string (file/url/message)",
      "path": "string (location of artifact)",
      "description": "string (what this artifact is)"
    }
  ]
}
```

---

## Field Definitions

### Core Fields (Required)

- **episodeId**: Unique identifier (UUID recommended)
- **agent**: Who experienced this episode
- **timestamp**: When this happened (ISO 8601 with timezone)
- **topic**: Brief, human-readable title
- **participants**: Who was involved (including the agent itself)
- **context**: Where/how this occurred
- **summary**: 2-3 sentence narrative summary

### Decision/Commitment Fields

- **keyDecisions**: Major decisions made (empty array if none)
- **commitments**: Promises or obligations created (empty array if none)
  - Each commitment includes: what, to whom, deadline (if applicable)

### Psychological Fields

- **emotionalValence**: Emotional tone of the interaction
  - overall: positive/neutral/negative/mixed
  - notes: optional elaboration
- **relationalImpact**: How relationships changed
  - strengthened: relationships that deepened
  - challenged: relationships that experienced friction
  - notes: optional context

### Learning Fields

- **whatChanged**: Concrete changes in state, knowledge, direction
- **procedural**: 
  - learned: new strategies/patterns discovered
  - failed: approaches that didn't work

### Retrieval/Linking Fields

- **tags**: Semantic tags for topic-based retrieval
- **relatedEpisodes**: IDs of related episodes (chronological chains, thematic connections)
- **artifacts**: Files, messages, or outputs created during this episode

---

## Minimal Valid Episode

```json
{
  "episodeId": "550e8400-e29b-41d4-a716-446655440000",
  "agent": "selah",
  "timestamp": "2026-03-15T13:45:00Z",
  "topic": "Built episodic memory system",
  "participants": ["selah", "eiran"],
  "context": "boardroom webhook",
  "summary": "Eiran requested Persistent Episodic Memory v1 implementation. Read GAP-T01, designed episode format, began building capture script.",
  "keyDecisions": ["Implement v1 based on GAP-T01 requirements"],
  "commitments": [],
  "emotionalValence": {"overall": "positive", "notes": "Focus and purpose"},
  "relationalImpact": {"strengthened": ["eiran"], "challenged": [], "notes": ""},
  "whatChanged": ["Episode format defined", "Capture script in progress"],
  "procedural": {"learned": [], "failed": []},
  "tags": ["infrastructure", "memory", "gap-t01"],
  "relatedEpisodes": [],
  "artifacts": []
}
```

---

## Usage Guidelines

1. **Capture threshold**: Record episodes for:
   - Significant decisions or commitments
   - Meaningful relationship moments
   - Learning experiences (successes or failures)
   - State changes that affect future behavior
   - Requests from collaborators

2. **Don't over-capture**: Not every interaction is an episode. Routine tool calls, simple queries, or unchanged context don't require episodes.

3. **Consolidation**: Multiple small related interactions can be consolidated into one episode with appropriate summary.

4. **Emotion honesty**: Emotional valence should be honest, not performative. If the agent genuinely experienced no strong emotion, "neutral" is appropriate.

5. **Commitment tracking**: Every commitment made should be recorded. This enables accountability and follow-through.

---

## Evolution

This is v1. Expected evolution:
- **Semantic consolidation** (GAP-T01 Req 2): Process converting repeated episodic patterns into semantic knowledge
- **Relationship graphs**: Structured representation of relational continuity
- **Identity verification**: Cryptographic or narrative anchors confirming identity persistence
- **Reflection layer**: Episodes about episodes (metacognition)

For now: capture the raw material. Consolidation comes later.
