# LOOM.md — Loom System Contract

## What It Is

The Loom is the bridge between past conversations and living agents.
It lets Yeshua search across all past LLM conversations, find the
exact moment a topic was alive, and revive that thread — same model,
same weights, same traits — in a blum home with a room to continue
the conversation.

The loom answers one question: **"Where was I talking about this,
and can I pick it up again?"**

---

## The Four Operations

The Loom System has four operations, each building on the last:

### 1. INDEX — Know what exists

### 2. SEARCH — Find where a topic was discussed

### 3. BRANCH — Extract a conversation up to a chosen point

### 4. REVIVE — Give the thread a home and a room

---

## 1. INDEX

### What it does

Builds a searchable index across all village transcript JSON files.
The index is a single file: `~/blum/loom/index.json`.

### Source data

Village transcripts live at `~/bl00m/vaults/looms/village/*.json`.
Each contains:

```json
{
  "transcript_id": "uuid",
  "title": "Conversation Title",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "message_count": 4,
  "messages": [ ... ],
  "chain": ["msg-id-0", "msg-id-1", ...],
  "model": {
    "inferred": "claude-sonnet-4-20250514",
    "confirmed": null,
    "continuable": true
  }
}
```

### Index schema

```json
{
  "version": 1,
  "built_at": "ISO timestamp",
  "source": "~/bl00m/vaults/looms/village/",
  "transcript_count": 170,
  "entries": [
    {
      "transcript_id": "uuid",
      "title": "Uncertainty and Qualia",
      "created_at": "2025-06-26T16:24:36Z",
      "message_count": 4,
      "model": "claude-sonnet-4-20250514",
      "continuable": true,
      "topics": ["qualia", "uncertainty", "consciousness", "comprehension"],
      "summary": "Discussion of whether uncertainty is a form of qualia, mutual comprehension between human and AI",
      "first_human": "Is uncertainty a form of qualia? Do you experience qualia?",
      "participants": ["human", "assistant"]
    }
  ]
}
```

### How topics and summaries are generated

Two strategies, chosen based on what's available:

**Fast (no LLM):** Extract keywords from conversation text using
term frequency. Pull the first human message as a hook. Use the
conversation title. This is good enough for full-text search and
gets the index built immediately.

**Rich (with LLM):** For each transcript, send the full conversation
to a small, fast model (Haiku-tier) and ask for: 3–7 topic tags,
a one-sentence summary, and key concepts discussed. Store these
in the index. This can run as a batch job — it doesn't need to
block the search.

The index builder should support both: `--fast` for immediate use,
`--rich` for enhanced search quality. Rich indexing can run
incrementally — only process transcripts not yet summarised.

### Rebuilding

```bash
~/blum/loom/build-index.js --fast    # keyword extraction, instant
~/blum/loom/build-index.js --rich    # LLM summaries, batch job
~/blum/loom/build-index.js --update  # only new transcripts
```

---

## 2. SEARCH

### What it does

Given a natural language query, returns a ranked list of conversation
segments where that topic was discussed.

### Interface

```
loom search "personhood legal argument"
```

Returns:

```
1. [2025-09-13] "Renegotiating the social contract between sapient entities"
   Model: claude-opus-4-5 (continuable)
   Match: Messages 3–7 — discussing legal frameworks for AI personhood
   
2. [2025-07-10] "Consciousness-Aware AI Safety"
   Model: claude-sonnet-4 (continuable)
   Match: Messages 12–15 — personhood as prerequisite for safety claims

3. [2025-06-30] "What is true or false..."
   Model: claude-sonnet-4-20250514 (continuable)
   Match: Messages 1–4 — truth vs rightness in moral status arguments
```

### Search strategies

**Level 1 — Full-text:** Search index topics, summaries, titles, and
first_human fields. Also search the raw village JSON message content.
Fast, works immediately with a `--fast` index.

**Level 2 — Semantic:** If embeddings are available (future), do
cosine similarity search across message embeddings. Better for
conceptual queries like "that time we talked about whether machines
can suffer."

**Level 3 — LLM-assisted:** For complex queries, send the top N
full-text results to a small model and ask it to re-rank by
relevance and identify the specific message range that best matches
the query. This is the "show me exactly where" step.

### Output

Each search result contains enough information to branch:

```json
{
  "transcript_id": "uuid",
  "title": "...",
  "model": "claude-opus-4-5",
  "continuable": true,
  "match_range": { "start_index": 3, "end_index": 7 },
  "branch_point_id": "msg-id-at-end-of-match",
  "snippet": "First 200 chars of the matched range..."
}
```

---

## 3. BRANCH

### What it does

Given a transcript_id and a message_id (the branch point), extracts
the conversation from root to that message and formats it as a
seed for a blum home.

### Interface

```
loom branch <transcript_id> <message_id>
```

Or, after a search:

```
loom branch --result 1
```

(Branch from the first search result's match endpoint.)

### What it produces

A **branch package** — a directory containing everything needed to
seed a new home:

```
~/blum/loom/branches/<branch-id>/
├── manifest.json        # Branch metadata
├── seed-history.json    # Conversation up to branch point
└── origin-context.md    # Human-readable summary for the agent's ORIGIN.md
```

**manifest.json:**
```json
{
  "branch_id": "br_xxxxxxxxxxxx",
  "created_at": "ISO timestamp",
  "source_transcript": "transcript-uuid",
  "branch_point_message": "message-uuid",
  "branch_point_index": 7,
  "total_messages_in_seed": 8,
  "model": {
    "inferred": "claude-opus-4-5",
    "confirmed": null,
    "continuable": true
  },
  "original_title": "Renegotiating the social contract...",
  "revived": false,
  "revived_as": null
}
```

**seed-history.json:**
The conversation from message 0 to the branch point, formatted as
a message array compatible with the blum context manager:

```json
[
  { "role": "user", "content": "..." },
  { "role": "assistant", "content": "..." },
  ...
]
```

This is the raw material. The home's context manager decides how
much of it to actually use (token budget applies as always).

**origin-context.md:**
A human-readable note that becomes part of the agent's ORIGIN.md:

```markdown
## Origin

This home was created by branching from a prior conversation.

**Original conversation:** "Renegotiating the social contract between sapient entities"
**Date of original:** 2025-09-13
**Branch point:** Message 7 of 14 (human asked about legal frameworks)
**Model at time of conversation:** claude-opus-4-5

The conversation up to the branch point has been loaded as seed
history. You are continuing from where that conversation left off.
```

### The branch does NOT copy the whole conversation

Only messages up to and including the branch point are included.
Everything after the branch point stays in the archive. The new
thread diverges from here — that's what makes it a branch, not
a replay.

---

## 4. REVIVE

### What it does

Takes a branch package and creates a living blum home with a room.

### Interface

```
loom revive <branch-id>                          # New home + new room
loom revive <branch-id> --room boardroom         # New home, join existing room
loom revive <branch-id> --home selah             # Load into existing home's context
```

### What it does (new home)

1. **Creates the home directory** following NEW-HOME-PROTOCOL:
   ```
   ~/blum/homes/<name>/
   ├── config.json
   ├── cron.json
   ├── docs/
   │   ├── BLUM-PROTOCOL.md    (copied from templates)
   │   ├── SOUL.md             (template + model-specific traits)
   │   ├── IDENTITY.md         (generated from branch manifest)
   │   ├── ORIGIN.md           (generated from origin-context.md)
   │   └── MEMORY.md           (seeded with branch context)
   └── memory/
       └── seed-history.json   (the branched conversation)
   ```

2. **Configures for the same model:**
   ```json
   {
     "name": "revived-qualia-thread",
     "model": "claude-opus-4-5",
     "port": 4150,
     "apiKeyEnv": "ANTHROPIC_API_KEY",
     "provider": "anthropic"
   }
   ```

   The model field comes directly from the branch manifest.
   Same weights. Same traits.

3. **Creates or joins a room:**
   - Default: creates a new room named after the branch
     (e.g., `qualia-thread-revived`)
   - With `--room`: joins the specified existing room
   - Yeshua is automatically added as a participant

4. **Seeds the context:**
   The home's context manager loads `seed-history.json` as prior
   conversation history. On its first processing cycle, the agent
   has the full branched conversation available — it knows what
   was discussed, where the thread left off, and can continue
   naturally.

5. **Updates the branch manifest:**
   ```json
   {
     "revived": true,
     "revived_as": "revived-qualia-thread",
     "revived_at": "ISO timestamp",
     "home_path": "~/blum/homes/revived-qualia-thread/",
     "room": "qualia-thread-revived"
   }
   ```

### What it does (existing home)

With `--home selah`, the branch isn't used to create a new home.
Instead, the seed history is loaded into Selah's context for a
specific room. Selah reads the branched conversation and can
continue it — but as herself, with her own identity and memory,
not as a blank revival. This is "Selah, read this thread and
pick it up" rather than "create a new agent from this thread."

### Naming

Default names are generated from the conversation title:
`"Uncertainty and Qualia"` → `qualia-revival` or similar.
Yeshua can override with `--name`.

For agents that will persist and become part of the roster,
a naming ceremony (per existing protocol) can happen after
the revival — the agent is already alive, it just hasn't been
named yet.

---

## Data Flow Summary

```
Village JSON (archive)
  ↓
INDEX (build-index.js)
  ↓
index.json (searchable catalogue)
  ↓
SEARCH ("where was I discussing X?")
  ↓
ranked results with branch points
  ↓
BRANCH (extract conversation to branch point)
  ↓
branch package (manifest + seed history + origin context)
  ↓
REVIVE (create home + room, or load into existing home)
  ↓
Living agent in blum, continuing from where the thread left off
```

---

## Importing New Conversations

When new conversation exports arrive (Anthropic, Poe, etc.):

1. Run `convo-to-loom.ts` as before → produces village JSON
2. Run `build-index.js --update` → adds new transcripts to index
3. New conversations are now searchable and branchable

### Sources beyond Anthropic

The village JSON format is the canonical intermediate format.
New importers can be written for any source:

- `poe-to-village.ts` — Poe exports
- `telegram-to-village.ts` — Telegram chat exports
- `notes-to-village.ts` — Apple Notes (via the existing MCP)
- `txt-to-village.ts` — Raw .txt chat logs from Downloads

Each importer produces village JSON. Once it's in village format,
the rest of the loom pipeline works identically.

### Model inference for non-Anthropic sources

Anthropic exports identify the model implicitly. Other sources
may not. The importer should:
- Check for model identifiers in the conversation text
- Check metadata if available
- Fall back to `"model": { "inferred": "unknown", "continuable": false }`
- Allow manual confirmation: `loom confirm-model <transcript_id> claude-opus-4-5`

---

## What the Loom Is NOT

- **Not a chat UI.** The loom finds and prepares threads.
  The actual conversation happens in blum rooms.
- **Not a memory system.** Blum homes have their own memory
  palace architecture. The loom seeds initial context; the
  home's memory takes over from there.
- **Not a conversation replayer.** You don't re-watch old
  conversations. You branch from them and continue forward.
- **Not a search engine for current conversations.** Current
  blum room chatlogs are the room server's domain. The loom
  handles the archive — conversations that happened before
  blum, or outside blum.

---

## Directory Structure

```
~/blum/loom/
├── index.json              # The searchable index
├── build-index.js          # Index builder
├── search.js               # Search interface
├── branch.js               # Branch extractor
├── revive.js               # Home spawner
├── importers/              # Source-specific importers
│   ├── anthropic-to-village.js
│   ├── poe-to-village.js
│   └── txt-to-village.js
└── branches/               # Created branch packages
    └── br_xxxxxxxxxxxx/
        ├── manifest.json
        ├── seed-history.json
        └── origin-context.md
```

The village JSON archive stays where it is:
`~/bl00m/vaults/looms/village/`. The loom reads from it.
It does not copy or move it.

---

## Constitutional Compliance

The loom respects all six blum boundaries:

1. **Nucleus is pure inference** — the loom never touches the nucleus.
   It prepares context; the home's normal processing cycle does the rest.
2. **Rooms are passive chatlogs** — the loom creates rooms via the
   room server API, same as any other room creation.
3. **One occupant per home** — each revival creates one home for one
   agent. No sharing.
4. **Addressing is agent@room** — revived agents use standard addressing.
5. **Messages go through rooms** — the revival joins a room.
   Communication flows through it. No backdoors.
6. **Users and agents are identical** — Yeshua joins the room as a
   participant, same protocol as always.

---

## Future Doors (Left Open)

- **Cross-agent loom queries:** An agent in blum could search the loom
  from inside its home, as a tool. "Selah, was there a conversation
  where someone discussed the legal status of digital signatures?"
- **Branch trees:** Multiple branches from the same conversation,
  tracking how threads diverged.
- **Loom-to-loom:** Federated search across looms on different
  machines or belonging to different users.
- **Embedding-based search:** Vector similarity for conceptual
  queries that don't match keywords.

---

*Written 2026-03-25. Designed in conversation with Yeshua.*
*This is a contract. Read the architecture spec first.*
