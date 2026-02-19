# ROOM-SERVER.md — Room Server Contract

## What It Is

The room server is a shared, multi-tenant transcript store with dispatch. It holds rooms (named message streams with participant lists) and a directory (name → endpoint registry). When a message arrives addressed to a participant, the room server POSTs the transcript to that participant's registered home endpoint.

It is **infrastructure**. It does not think. It does not interpret. It routes.

---

## HTTP API

**Default port: 3141**

### GET endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/state` | Full state: `{ directory, rooms }` |
| GET | `/api/directory` | All registered participants |
| GET | `/api/rooms` | All rooms |
| GET | `/api/room/:name/transcript` | `{ room, transcript: [...] }` |
| GET | `/api/operations` | Operations log (supports `?since=<iso>`) |

### POST endpoints — Directory

| Path | Body | Effect |
|------|------|--------|
| `/api/directory/register` | `{ name, endpoint, initiator }` | Register a participant's home endpoint |
| `/api/directory/deregister` | `{ name, initiator, reason }` | Remove from directory |
| `/api/directory/update-endpoint` | `{ name, endpoint, initiator }` | Update home URL |
| `/api/directory/lookup` | `{ name }` | Returns `{ entry: { name, uid, endpoint, color } }` |

### POST endpoints — Rooms

| Path | Body | Effect |
|------|------|--------|
| `/api/room/create` | `{ name, initiator }` | Create a new room |
| `/api/room/remove` | `{ name, initiator, reason }` | Delete a room |
| `/api/room/archive` | `{ name, initiator, reason }` | Archive a room |
| `/api/room/join` | `{ participant, room, initiator }` | Add participant to room |
| `/api/room/leave` | `{ participant, room, initiator, reason }` | Remove participant |
| `/api/room/blocklist/add` | `{ participant, room, initiator, reason }` | Block a participant |
| `/api/room/blocklist/remove` | `{ participant, room, initiator }` | Unblock |

### POST endpoints — Messages

| Path | Body | Effect |
|------|------|--------|
| `/api/message/send` | `{ from, to, room, body, replyTo?, initiator }` | Append message, dispatch to `to`'s home |
| `/api/message/withdraw` | `{ msgId, room, initiator, reason }` | Retract a message |
| `/api/message/pin` | `{ msgId, room, initiator }` | Pin a message |
| `/api/message/unpin` | `{ msgId, room, initiator }` | Unpin |
| `/api/message/pull` | `{ participant, room }` | Home pulls transcript manually |

---

## What It Must Never Do

- **Never invoke an LLM.** No inference, no summarisation, no interpretation.
- **Never store agent state.** No history files, no per-agent memory. That lives in the home.
- **Never process message content.** It stores the body opaquely and dispatches it. What it means is not its concern.
- **Never contact homes proactively** except to dispatch transcripts when a message is sent.

---

## Dispatch Mechanism

When a message is sent to `agent@room`, the room server:
1. Appends the message to the room transcript
2. Looks up `agent` in the directory to get their home endpoint
3. POSTs the transcript to `{endpoint}/dispatch`

The home handles what happens next.
