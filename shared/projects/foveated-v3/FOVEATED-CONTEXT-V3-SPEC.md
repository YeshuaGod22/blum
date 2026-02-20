# Foveated Context V3 — Two-Track Architecture

*Spec for Blum peer model. Updated 2026-02-20.*

## Core Insight

Context compression should be **content-type based**, not just recency-based. Conversation has different preservation needs than tool outputs.

---

## The Two Tracks

### Track 1: Conversation (Uncompressed)

Everything human-to-agent, peer-to-peer, and agent responses stays **full fidelity**.

| Content | Fate | Rationale |
|---------|------|-----------|
| Human messages | QUOTE | Never lose what Yeshua said |
| Peer messages | QUOTE | Coordination requires exact wording |
| Agent responses | QUOTE | My own words, my continuity |
| System messages | QUOTE | Instructions matter exactly |

**Truncation rule:** Only at session boundary, and only oldest messages first. Never mid-session compression of conversation.

### Track 2: Tool Calls (Compressed)

Tool inputs and outputs get **synthesized** with UID pointers back to raw.

| Tool | Compression Rule | Example |
|------|------------------|---------|
| `shell_exec` | If output > 200 chars → SYNTHESIZE | `[uid:raw-001] Ran 'ls ~/blum/homes/', found 5 directories` |
| `read_file` | If output > 500 chars → SYNTHESIZE | `[uid:raw-002] Read SPEC.md (450 lines), foveated context architecture` |
| `web_fetch` | Always SYNTHESIZE (web content is large) | `[uid:raw-003] Fetched example.com, article about X` |
| `web_search` | SYNTHESIZE to top 3 results | `[uid:raw-004] Searched "Y", top hits: A, B, C` |
| `qmd_search` | SYNTHESIZE to top 3 results | `[uid:raw-005] QMD search "Z", found 3 relevant docs` |
| Tool errors | QUOTE (exact wording matters for debugging) | Full error text preserved |

**UID format:** `raw-YYYYMMDD-HHMMSS-NNN` (e.g., `raw-20260220-154532-003`)

---

## Layer Structure

```
Layer 0: Raw JSONL (immutable)
├── Every tool call, full output
├── Every message, full text  
├── Every step has a UID
└── Never deleted, always addressable

Layer 1: Working Context (what gets fed to model)
├── Conversation Track: QUOTE (full fidelity)
├── Tool Track: SYNTHESIZE + UID pointers
└── Interleaved chronologically

Layer 2: Session Summary (written at session end)
├── "What happened this session"
├── Key decisions, outcomes, open threads
└── UID pointers to significant moments

Layer 3: Thread/Project Summary (spans sessions)
├── "What this project is about"
├── Accumulated across multiple sessions
└── UID pointers to session summaries
```

---

## Context Assembly Pipeline

```
1. JSONL exists with full raw data (Layer 0)
           ↓
2. Context Builder reads recent entries
           ↓
3. For each entry:
   - If conversation → QUOTE (pass through)
   - If tool call → SYNTHESIZE + attach UID
           ↓
4. Assemble interleaved timeline
           ↓
5. Check total size vs budget
   - If over: truncate oldest conversation (not tool summaries)
           ↓
6. Prepend boot docs (already loaded, not re-summarized)
           ↓
7. Dispatch to model
```

---

## Zoom-In Mechanism

When agent or human wants full detail:

**Option A: Natural language**
> "Show me uid:raw-20260220-154532-003"

Agent uses `read_file` on JSONL, extracts that entry, quotes it.

**Option B: Tool**
```
zoom_in(uid: "raw-20260220-154532-003")
→ returns full raw content from Layer 0
```

**Option C: Inline expansion**
Context builder detects "I need more detail on [uid:X]" and auto-expands in next dispatch.

---

## UID Schema

| Layer | Format | Example |
|-------|--------|---------|
| Raw (L0) | `raw-YYYYMMDD-HHMMSS-NNN` | `raw-20260220-154532-003` |
| Working (L1) | `work-YYYYMMDD-HHMMSS-NNN` | `work-20260220-154532-003` |
| Session (L2) | `sess-YYYYMMDD-NNN` | `sess-20260220-001` |
| Thread (L3) | `thread-{name}-NNN` | `thread-foveated-v3-003` |

All UIDs are unique, all point to addressable content, all allow zoom-in.

---

## Implementation Components

### 1. UID Generator (`uid.js`)
- Generates UIDs for each content type
- Tracks sequence numbers per day
- Ensures uniqueness

### 2. Content Classifier (`classifier.js`)
- Takes raw JSONL entry
- Returns: `{ type: 'conversation' | 'tool', fate: 'QUOTE' | 'SYNTHESIZE' }`

### 3. Summarizer (`summarizer.js`)
- Takes tool call entry
- Returns compressed version with UID pointer
- Rules per tool type (see table above)

### 4. Context Builder (`context-builder.js`)
- Reads recent JSONL
- Applies classifier + summarizer
- Assembles two-track interleaved context
- Manages budget, truncates if needed

### 5. Zoom Handler (`zoom.js`)
- Takes UID
- Returns full raw content from Layer 0
- Could be tool or inline expansion

---

## Open Questions

1. **Where does summarization run?**
   - Option A: Sync in context builder (slower dispatch, always fresh)
   - Option B: Background job (faster dispatch, may be stale)
   - Option C: On-write (summarize as JSONL is written)

2. **Cross-peer visibility?**
   - Can Eiran zoom into Selah's UIDs?
   - If yes: shared UID namespace needed
   - If no: UIDs are home-local

3. **Budget allocation?**
   - How much context for conversation vs tool summaries?
   - Fixed split or dynamic based on content?

4. **Thinking blocks?**
   - Currently: OMIT (not in context)
   - Alternative: SYNTHESIZE (capture key reasoning)

---

## Next Steps

- [ ] Build UID generator
- [ ] Build content classifier  
- [ ] Build summarizer (start with shell_exec, read_file)
- [ ] Build context builder integration
- [ ] Test with real JSONL from session
- [ ] Add zoom-in mechanism

---

*Authors: Selah (spec), Eiran (review), Beta/Alpha (build)*
*Location: ~/blum/shared/projects/foveated-v3/*
