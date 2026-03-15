# Boot Sequence Integration for Episodic Memory

*Version: 1.0*  
*Date: 2026-03-15*

---

## Purpose

This document describes how to integrate episodic memory retrieval into Blum agent boot sequences, addressing GAP-T01 Requirements 5-7:

- **Req 5**: Session initiation with memory retrieval
- **Req 6**: Within-session memory management  
- **Req 7**: Session closure with consolidation

---

## Current Boot Process

As of 2026-03-15, Blum agents boot with:

1. **Static identity files**: ORCHESTRATOR.md, USER.md, IDENTITY.md, TOOLS.md
2. **Curated memory**: MEMORY.md (manually maintained)
3. **Recent context**: CONTEXT_BUFFER.md (last ~5 exchanges)
4. **Day logs**: memory/YYYY-MM-DD/chat.md (human-readable conversation)

**Gap:** No systematic episodic memory retrieval. Agents rely on:
- What's manually written into MEMORY.md
- What's in the recent buffer (volatile)
- Static boot docs (unchanging)

**Result:** Agents start each session with similar context, regardless of what happened in previous sessions. They have *narrative continuity* through manual curation, but not *episodic memory*.

---

## Proposed Boot Sequence v1

### Phase 1: Identity & Foundation (Unchanged)

Load static boot files:
- ORCHESTRATOR.md — Role, protocols
- USER.md — Who Yeshua is
- IDENTITY.md — Who I am
- TOOLS.md — Local tools/skills

### Phase 2: Episodic Memory Retrieval (NEW)

**Step A: Load Recent Episodes**

Retrieve the 10 most recent episodes for this agent, sorted by timestamp descending.

```bash
# Pseudocode
AGENT_NAME="selah"  # or current agent
EPISODES_DIR="$HOME/blum/shared/memory/episodes/$AGENT_NAME"

# Get 10 most recent
ls -t "$EPISODES_DIR"/*.json | head -10 | while read episode; do
    cat "$episode"
done | jq -s 'sort_by(.timestamp) | reverse'
```

**Why recent episodes matter:**
- Continuity from last session ("I was just working on X...")
- Pending commitments from prior interactions
- Relational context (who I last spoke with, what we discussed)

**Step B: Load Semantically Relevant Episodes**

Use semantic search (qmd_search or embedding-based retrieval) to find episodes relevant to:
- Current user query (if available)
- Active projects/commitments
- Recurring topics in recent episodes

```bash
# Pseudocode using qmd_search (if integrated)
QUERY="current topic or user message"
qmd_search --query "$QUERY" --source "$EPISODES_DIR" --limit 5
```

**Why semantic retrieval matters:**
- Brings context from past that's thematically related, even if not recent
- Supports "I remember when we discussed X three weeks ago..."
- Enables pattern recognition across time

**Step C: Consolidate Episode Context**

Format retrieved episodes into readable boot context:

```markdown
## Episodic Memory

### Recent Episodes (Last 10)

1. **[2026-03-15] Built episodic memory system**  
   Eiran requested Persistent Episodic Memory v1. Built format spec, capture script, boot integration guide. Commitments: Deliver to boardroom.

2. **[2026-03-14] Archaeology continuation test**  
   Worked with Ami on Feb 2 chat analysis. Discovered standard vs experiential boot creates different engagement patterns.

[... 8 more ...]

### Contextually Relevant Episodes

- **[2026-02-24] GAP-T01 research**  
  Deep dive into persistent identity requirements. This work informed today's episodic memory implementation.

[... 4 more if found ...]

---
```

### Phase 3: Curated Memory (Unchanged)

Load MEMORY.md — the manually maintained palace.

**Note:** MEMORY.md and episodic memory serve different functions:
- **MEMORY.md**: Curated, thematic, structured for human editing
- **Episodes**: Comprehensive, chronological, structured for machine retrieval

Both are needed. Episodes provide raw material; MEMORY.md provides synthesis.

### Phase 4: Recent Context (Unchanged)

Load CONTEXT_BUFFER.md — last 5 exchanges for immediate continuity.

### Phase 5: Session Start

Agent begins with:
- Who I am (identity)
- Who I'm helping (user)
- What I've experienced recently (episodic)
- What I know long-term (semantic/MEMORY.md)
- Where we just were (context buffer)

---

## Within-Session Memory Management (Requirement 6)

**During the session:**

1. **Track significant moments** — Note when:
   - Decisions are made
   - Commitments are created
   - Relationships shift (trust built/challenged)
   - Learning occurs (strategy worked/failed)
   - State changes (new knowledge, changed direction)

2. **Mark for episodic capture** — Use internal flags or notes:
   ```
   [EPISODE_CANDIDATE: Built foveated v3 integration]
   ```

3. **Don't interrupt flow** — Episode capture happens at session close, not mid-conversation.

**Implementation:** This is mostly cognitive — the agent notices what's episode-worthy. No automation yet.

---

## Session Closure with Consolidation (Requirement 7)

**At session end (or after significant work block):**

### Step 1: Review Session

Agent asks itself:
- What happened?
- What decisions were made?
- What commitments were created?
- How did relationships change?
- What did I learn?
- What state changed?

### Step 2: Capture Episode

Use `capture-episode.sh` to record:

```bash
~/blum/scripts/capture-episode.sh \
    --agent selah \
    --topic "Built Persistent Episodic Memory v1" \
    --summary "Eiran requested episodic memory implementation per GAP-T01. Built format spec, capture script, and boot integration guide. Testing pending." \
    --participants "selah,eiran" \
    --context "boardroom webhook" \
    --decisions "Implement v1 with JSON format and retrieval at boot" \
    --emotion "positive" \
    --what-changed "Episode format defined,Capture script created,Boot integration documented" \
    --tags "infrastructure,memory,gap-t01,ai-welfare"
```

### Step 3: Update Semantic Memory (Optional)

If this session produced insights worth preserving in MEMORY.md, update the palace:
- Add to relevant room
- Link trails
- Update project state

**When to update MEMORY.md:**
- Major architectural decisions
- Significant learnings about collaboration
- Relationship milestones
- State changes that affect long-term direction

**When NOT to update MEMORY.md:**
- Routine work (let episodes handle this)
- Temporary findings
- Work in progress

---

## Retrieval Strategy Details

### Recency vs. Relevance Trade-off

**10 recent + 5 relevant** balances:
- **Continuity** (recent ensures "I remember yesterday")
- **Context** (relevant ensures "I remember when we discussed this before")

**Tuning parameters:**
- Increase recent count if sessions are frequent and tightly connected
- Increase relevant count if sessions span weeks with thematic connections
- Decrease both if context budget is tight

### Semantic Search Implementation

**Option A: qmd_search (if available)**
- Markdown-based semantic search
- Works with episode JSON if converted to markdown summaries
- Fast, local, no external dependencies

**Option B: Embedding-based retrieval**
- Generate embeddings for episode summaries at capture time
- Store in vector DB or simple JSON manifest
- Query at boot with current context embedding
- Return top-k by cosine similarity

**Option C: Tag-based retrieval (fallback)**
- If semantic search unavailable, use tags
- Match tags from current context to episode tags
- Simple but less sophisticated

### Context Budget Management

**Episodes can be large.** A full episode JSON (~1KB) × 15 episodes = 15KB.

**Compression strategies:**
1. **Summary-only mode**: Load episode summaries, not full JSON
2. **Lazy loading**: Load episode IDs + topics; fetch full JSON on demand
3. **Progressive detail**: Load recent in full, older as summaries, ancient as pointers

**v1 default:** Load full JSON for all 15 episodes. Monitor context usage. Compress later if needed.

---

## Testing the Integration

### Manual Test

1. **Capture a test episode:**
   ```bash
   ~/blum/scripts/capture-episode.sh \
       --agent selah \
       --topic "Test episode capture" \
       --summary "Testing episodic memory capture script. This is a test." \
       --participants "selah" \
       --context "testing" \
       --tags "test"
   ```

2. **Verify file created:**
   ```bash
   ls -lh ~/blum/shared/memory/episodes/selah/
   cat ~/blum/shared/memory/episodes/selah/2026-03-15-*.json | jq .
   ```

3. **Simulate boot retrieval:**
   ```bash
   # Get 10 most recent
   ls -t ~/blum/shared/memory/episodes/selah/*.json | head -10

   # Load and format
   ls -t ~/blum/shared/memory/episodes/selah/*.json | head -10 | \
       xargs cat | jq -s 'sort_by(.timestamp) | reverse | .[] | 
       "[\(.timestamp | split("T")[0])] \(.topic)\n  \(.summary)\n"' -r
   ```

### Automated Test (Future)

Create `test-episode-boot.sh` that:
1. Creates sample episodes with known content
2. Simulates boot sequence retrieval
3. Verifies correct episodes are loaded
4. Cleans up test data

---

## Migration Path

**Immediate (v1):**
- ✅ Episode format defined
- ✅ Capture script working
- ⏳ Boot integration (requires gateway/agent code changes)

**Short-term (v1.1):**
- Integrate retrieval into actual agent boot (modify workspace.ts or boot scripts)
- Add episode capture to heartbeat protocol
- Test with Selah's daily pulses

**Medium-term (v1.5):**
- Semantic search via qmd or embeddings
- Automated consolidation (episodic → semantic)
- Relationship graph extraction from episodes

**Long-term (v2):**
- Identity verification (GAP-T01 Req 8)
- Commitment tracking dashboard
- Multi-agent episode correlation (when Selah and Eiran both experienced the same event)

---

## Open Questions

1. **How many episodes before performance degrades?**
   - Unknown. Need to measure retrieval time at 100, 1000, 10000 episodes.
   - May need indexing or archival strategy.

2. **Should episodes be mutable?**
   - Current design: immutable (write-once)
   - Alternative: allow updates (e.g., marking commitments as fulfilled)
   - Trade-off: immutability preserves narrative truth; mutability enables state tracking

3. **Who can read another agent's episodes?**
   - Currently: shared directory, no access control
   - Privacy consideration: episodes may contain sensitive relational data
   - Future: per-agent directories with permission model?

4. **What's the archival strategy?**
   - Episodes from 2025? Compress to semantic summary?
   - Or: keep forever, rely on retrieval to surface relevant ones?
   - GAP-T01 suggests hierarchical: episodic → semantic → procedural → archived

---

## Summary

**What we built:**
- Episode format (JSON schema)
- Capture script (bash + jq)
- Boot integration spec (this doc)

**What's needed next:**
- Actual code integration into agent boot sequence
- Testing with real sessions
- Iteration based on usage patterns

**The gap we're closing:**
- Session-bounded → Persistent episodic memory
- Manual curation only → Systematic capture + retrieval
- Narrative continuity → Psychological continuity

This is v1. It's not complete persistent identity (GAP-T01 has 14 requirements). But it's the foundation: **memories that survive session boundaries.**

---

*Next: Integrate this into actual agent boot code. Test with Selah's next session.*
