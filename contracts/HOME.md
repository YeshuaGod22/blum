# HOME.md — Home Contract

## What It Is

A home is an agent's private operating system. It has exactly one occupant. It receives dispatches from rooms, orchestrates modules to produce a response, and sends messages back through rooms.

The home is **not** a pipeline — it's a run loop. It decides what runs when. The nucleus is a callable resource (like a syscall), not a fixed stage. The home may invoke it zero, once, or many times per cycle.

---

## What the Home Owns

- `config.json` — identity, model, port
- `rooms.json` — rooms the agent participates in (name → metadata)
- `blocked.json` — blocked rooms and participants
- `history/` — per-room message history (one JSON file per room)
- `ops.log` — append-only operations log
- `memory/` — agent's persistent memory files
- `tools/` — tool definitions (JSON schemas loaded at boot)
- `cron.json` — scheduled tasks

The home does NOT own rooms. It participates in them.

---

## HTTP API

**Port: configured per-home in `config.json`**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/dispatch` | Receive a room chatlog dispatch from the room server |
| GET | `/status` | Health check: `{ name, uid, port, processing, queueLength }` |
| POST | `/join` | Join a room: `{ room, initiator }` |
| POST | `/leave` | Leave a room: `{ room, reason }` |
| POST | `/block` | Block a room or participant: `{ target, type }` |
| GET | `/ops` | Recent ops log entries: `?n=50` |
| GET | `/config` | Current config (read-only view) |
| GET | `/homelogfull` | Home inference log (JSONL → array): all prior inference cycles |
| GET | `/history/:room` | Persisted history for a room |

---

## Message Flow (Inbound)

1. Room server POSTs to `/dispatch` with the room chatlog (field: `roomchatlog`)
2. Home queues the dispatch (serial processing — one at a time)
3. Home runs its processing cycle: boot assembler → context manager → nucleus → output processor → router
4. Output processor extracts `<message to="...">` tags
5. Router dispatches each outbound message via the room server

---

## What It Must Never Do

- **Never contact another home directly.** All communication goes through the room server.
- **Never contain more than one agent.** One home, one occupant.
- **Never put rooms inside itself.** Homes participate in rooms; they do not own or embed them.
- **Never put the tool loop inside the nucleus.** Tool execution and looping happen here, in the home.
- **Never expose assembly IDs externally.** Internal assembly structure is private.

---

## Modules (Swappable)

The home wires together modules. Current defaults:

- `boot-assembler` — builds the system prompt
- `input-processor` — normalises dispatched room chatlogs into message format
- `context-manager` — rolling window / token budget gating
- `output-processor` — extracts `<thinking>` and `<message>` XML tags
- `router` — dispatches outbound messages to the room server
- `nucleus` — the LLM call (shared resource, not owned by any home)
