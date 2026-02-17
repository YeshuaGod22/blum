# BLUM OPERATIONS RUNBOOK — 16 Feb 2026

> **What this is:** How to start, stop, and manage the running Blum system.
> Written because the previous build session left no operational docs.

---

## Current Architecture (as running)

```
Room Server (port 3141)
  └── boardroom (4 participants: yeshua, alpha, beta, gamma)

Alpha Home (port 4110) ── claude-haiku-4-5 ── /tmp/blum-homes/alpha
Beta Home  (port 4111) ── claude-sonnet-4-5 ── /tmp/blum-homes/beta
Gamma Home (port 4112) ── claude-haiku-4-5 ── /tmp/blum-homes/gamma
```

### Port assignments

| Service      | Port | Endpoint                       |
|-------------|------|--------------------------------|
| Room server | 3141 | http://localhost:3141          |
| Alpha home  | 4110 | http://localhost:4110          |
| Beta home   | 4111 | http://localhost:4111          |
| Gamma home  | 4112 | http://localhost:4112          |

### Code locations

| Component       | Path |
|----------------|------|
| Room server    | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026/blum-room-server-15feb2026.js` |
| Home OS        | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js` |
| Create home    | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/create-home.js` |
| Nucleus        | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/nucleus-pure-llm-call-messages-in-string-out-15feb2026/nucleus-15feb2026.js` |
| Home viewer UI | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-viewer-v1-16feb2026/home-viewer-v1-16feb2026.html` |
| UID generator  | `/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-uid-generator/generate-uid.js` |

### Data locations

| What              | Path |
|------------------|------|
| Room server data | `.../shared-room-server-.../data/` (rooms.json, directory.json, operations.jsonl) |
| Alpha home data  | `/tmp/blum-homes/alpha/` (config.json, rooms.json, blocked.json, ops.log, history/, tools/, docs/, transcript/, internal/) |
| Beta home data   | `/tmp/blum-homes/beta/` |
| Gamma home data  | `/tmp/blum-homes/gamma/` |
| Stdout logs      | `/tmp/blum-homes/{name}-out.log` |

**WARNING:** Home data lives in `/tmp/blum-homes/`. This is volatile — macOS
can clear `/tmp` on reboot. A future task is to move home data into the project
directory (e.g. `blum/homes/alpha/`).

---

## Starting the System

Node is at `/opt/homebrew/bin/node` (not in default PATH from Claude Code).

### 1. Start the room server

```bash
cd /Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026
/opt/homebrew/bin/node blum-room-server-15feb2026.js
```

Verify: `curl http://localhost:3141/api/state`

### 2. Start each home

```bash
HOME_DIR=/Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026

/opt/homebrew/bin/node $HOME_DIR/home.js /tmp/blum-homes/alpha 4110
/opt/homebrew/bin/node $HOME_DIR/home.js /tmp/blum-homes/beta  4111
/opt/homebrew/bin/node $HOME_DIR/home.js /tmp/blum-homes/gamma 4112
```

Verify: `curl http://localhost:4110/status`

### 3. Register home endpoints with room server

After homes are running, tell the room server where to dispatch:

```bash
ROOM=http://localhost:3141
curl -X POST $ROOM/api/directory/update-endpoint -H 'Content-Type: application/json' -d '{"name":"alpha","endpoint":"http://localhost:4110"}'
curl -X POST $ROOM/api/directory/update-endpoint -H 'Content-Type: application/json' -d '{"name":"beta","endpoint":"http://localhost:4111"}'
curl -X POST $ROOM/api/directory/update-endpoint -H 'Content-Type: application/json' -d '{"name":"gamma","endpoint":"http://localhost:4112"}'
```

### 4. Tell homes about their rooms (optional since auto-join)

Homes auto-register rooms when they receive a dispatch that includes the room
server endpoint. So for rooms where the agent is already a participant on the
room server, you can skip this step — the first dispatch will trigger auto-join.

Manual registration is still useful for pre-configuring rooms before any
messages are sent, or for rooms where you want to set custom participants.

```bash
curl -X POST http://localhost:4110/join -H 'Content-Type: application/json' \
  -d '{"room":"boardroom","endpoint":"http://localhost:3141","participants":["yeshua","alpha","beta","gamma"]}'
curl -X POST http://localhost:4111/join -H 'Content-Type: application/json' \
  -d '{"room":"boardroom","endpoint":"http://localhost:3141","participants":["yeshua","alpha","beta","gamma"]}'
curl -X POST http://localhost:4112/join -H 'Content-Type: application/json' \
  -d '{"room":"boardroom","endpoint":"http://localhost:3141","participants":["yeshua","alpha","beta","gamma"]}'
```

### 5. Open the viewer

Open in browser:
```
file:///Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-viewer-v1-16feb2026/home-viewer-v1-16feb2026.html?home=http://localhost:4110
```

Change `?home=` parameter for different homes (4111 for beta, 4112 for gamma).

---

## Creating a New Home

```bash
cd /Users/yeshuagod/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026
/opt/homebrew/bin/node create-home.js <name> <directory> [apiKey]
```

Example:
```bash
/opt/homebrew/bin/node create-home.js delta /tmp/blum-homes/delta sk-ant-api03-...
```

Then register it with the room server and tell it about its rooms (steps 3 and 4 above).

---

## Sending a Message (manual test)

From Yeshua to Alpha via boardroom:
```bash
curl -X POST http://localhost:3141/api/message/send \
  -H 'Content-Type: application/json' \
  -d '{"from":"yeshua","to":"alpha","room":"boardroom","body":"Hello Alpha","initiator":"yeshua"}'
```

The room server dispatches the transcript to Alpha's home. Alpha's home
processes it through the nucleus and routes the reply back to the room.

---

## Checking Status

```bash
# Room server state
curl http://localhost:3141/api/state

# Room transcript
curl http://localhost:3141/api/room/boardroom/transcript

# Home status
curl http://localhost:4110/status

# Home ops log (last 50 entries)
curl 'http://localhost:4110/ops?n=50'

# Home config (redacted, no keys)
curl http://localhost:4110/config

# Room server operations log
curl http://localhost:3141/api/operations
```

---

## Bugs Fixed — 16 Feb 2026

### 1. `/history/:room` endpoint crash (home.js:319)

**Symptom:** `server:error The "path" argument must be of type string. Received undefined`

**Cause:** Used `home.dir` (undefined) instead of `home.homeDir`.

**Fix:** Changed `home.dir` → `home.homeDir` at line 319 of home.js.

### 2. Router "No external endpoint" — messages never returned to room

**Symptom:** Alpha processed dispatches and called the nucleus successfully, but
outbound messages were logged as `route:internal` with `"No external endpoint"`.
Messages never reached the room transcript.

**Cause:** When the previous agent set up the homes, the `/join` call did not
include the room server endpoint. Alpha's `rooms.json` was:
```json
{"boardroom": {"participants": []}}
```
The router checks `room.endpoint` before POSTing — with no endpoint, it falls
through to the internal/no-endpoint path.

**Fix:** Re-sent `/join` to all three homes with the correct endpoint:
```json
{"room":"boardroom","endpoint":"http://localhost:3141","participants":["yeshua","alpha","beta","gamma"]}
```

**Verification:** Sent a test message at 14:59 UTC. Alpha's ops log shows
`route:sent` (not `route:internal`) and the reply appeared in the boardroom
transcript.

### 3. Homes drop dispatches for rooms they weren't told about (auto-join)

**Symptom:** Adding a participant to a room on the room server and sending a
message caused the home to log `process:unknown_room room=second-room — dropping
dispatch`. The home didn't know about the room because no one called `/join`.

**Cause:** Two-step registration friction. The room server knew Alpha was in
second-room, but Alpha's home didn't. The home's `rooms.json` only contained
rooms registered via `/join`.

**Fix (two parts):**

1. **Room server** (`blum-room-server-15feb2026.js:dispatchToHome`): dispatch
   payload now includes `participants` and `serverEndpoint` so the home has the
   info it needs to auto-register.

2. **Home** (`home.js:process()`): when a dispatch arrives for an unknown room,
   if it includes `serverEndpoint`, the home auto-registers the room instead of
   dropping. If the room is blocked, it's still rejected (blocked check runs
   first). If the dispatch has no `serverEndpoint` (backward-compatible), it's
   still dropped.

**Ops log signature:** `membership:auto-joined room=<name> endpoint=<url>`

**Verification:** Sent a message in second-room at 15:18 UTC. Alpha auto-joined,
processed, and replied — `route:sent` with reply visible in the room transcript.

---

## Agent Tools

Agents now have tool use capability. Tool definitions live in each home's `tools/`
directory as JSON files in Anthropic tool format (`{ name, description, input_schema }`).

**Current starter tools (all homes):**

| Tool | Description |
|------|-------------|
| `read_file` | Read files within the home directory |
| `write_file` | Write files within the home directory |
| `list_files` | List directory contents within the home |
| `get_room_history` | Retrieve recent messages from a room |
| `get_current_time` | Get current ISO timestamp |

All file tools are sandboxed to the home directory — agents cannot read or write
outside their own home.

**Adding a new tool:** Create a `.json` file in `tools/` following Anthropic tool
format, then add a handler in `home.js _executeTool()`. Restart the home to pick
up the new tool.

**Tool loop safety:** The home runs a maximum of 10 tool iterations per dispatch.
Each iteration is logged to ops.log (`tool:exec`, `tool:done`/`tool:error`).

---

## Traceability

Every processing cycle is fully traceable. UIDs are generated at each stage
so you can follow the chain from a room dispatch all the way to the output
blocks written to the transcript.

### UID format

All UIDs follow the pattern `prefix_16hexchars` (e.g. `cycle_a3f8b2c1d4e5f6a7`).

| Prefix  | Entity                     | Generated by      |
|---------|----------------------------|--------------------|
| `disp`  | Dispatch batch             | Room server        |
| `cycle` | Processing cycle           | Home.js            |
| `doc`   | Boot document              | Boot assembler     |
| `ctx`   | Context message            | Context manager    |
| `resp`  | Nucleus response           | Home.js            |
| `entry` | Transcript entry           | Router             |
| `parse` | Output parse result        | Output processor   |
| `blk`   | Output block               | Output processor   |
| `iter`  | Tool loop iteration        | Home.js            |

### Querying by cycleId

Every transcript entry has a `cycleId`. To find all data for a specific cycle:

```bash
# Find a transcript entry by cycleId
grep 'cycle_a3f8b2c1' /tmp/blum-homes/alpha/transcript/home-transcript.jsonl

# Pretty-print the full entry
grep 'cycle_a3f8b2c1' /tmp/blum-homes/alpha/transcript/home-transcript.jsonl | python3 -m json.tool

# Find all entries for a specific dispatch
grep 'disp_1234abcd' /tmp/blum-homes/alpha/transcript/home-transcript.jsonl

# Count processing cycles
wc -l /tmp/blum-homes/alpha/transcript/home-transcript.jsonl
```

### The `_trace` block

Each transcript entry contains a `_trace` object with the full processing chain:

```json
{
  "_trace": {
    "agentName": "alpha",
    "dispatchId": "disp_...",
    "cycleId": "cycle_...",
    "finalResponseId": "resp_...",
    "totalIterations": 3,
    "iterations": [
      {
        "iterationId": "iter_...",
        "number": 1,
        "responseId": "resp_...",
        "stopReason": "tool_use",
        "toolCalls": [{"apiId": "toolu_...", "name": "read_file"}],
        "textLength": 0
      },
      {
        "iterationId": "iter_...",
        "number": 2,
        "responseId": "resp_...",
        "stopReason": "end_turn",
        "toolCalls": [],
        "textLength": 342
      }
    ],
    "startedAt": "2026-02-16T18:00:00.000Z",
    "completedAt": "2026-02-16T18:00:02.500Z"
  }
}
```

### Context provenance in transcript entries

Each transcript entry also contains a `context` object showing exactly what
messages were sent to the nucleus. Each context message has a `_meta` with
its source:

- `boot:identity` — identity document from the home's `docs/` directory
- `boot:config-identity` — identity built from config.json (fallback)
- `boot:protocol` — communication protocol instructions
- `context:room-info` — room context (which room, who's here, reply address)
- `history:{roomName}` — conversation history from a specific room

### Home viewer trace panel

The home viewer (Transcript tab) displays trace information:
- **List view:** Short cycleId suffix next to each entry
- **Detail view:** Full trace ID chain (cycle → dispatch → entry → parse)
- **Context section:** Source tags on each context message with UID suffixes
- **Output section:** blockId suffixes on thinking and message blocks
- **Trace section:** Full `_trace` table with iteration details

---

## Agent Models

| Home  | Model              | API Key Type |
|-------|--------------------|-------------|
| Alpha | claude-haiku-4-5   | API key     |
| Beta  | claude-sonnet-4-5  | API key     |
| Gamma | claude-haiku-4-5   | OAuth token |

---

## Known Issues / Risks

1. **Home data in `/tmp`** — will be lost on reboot. Should move to project dir.
2. **Room server directory is embedded** — per spec section 9, should be extracted to its own service.
3. **No startup script** — each service must be started manually. See NEXT.md for the launcher app plan.
4. **Yeshua has no home endpoint** — registered in directory with `endpoint: null`. Messages addressed to Yeshua dispatch nowhere. A user-facing client (web UI) would fill this role.

## Change Log

| Time (UTC)  | What |
|-------------|------|
| ~03:26      | Previous agent created homes in `/tmp/blum-homes/`, started services |
| ~03:31      | Room + participants seeded; homes joined boardroom (but without endpoint) |
| 04:27       | First message sent (yeshua→alpha). Alpha processed but reply stuck (no endpoint) |
| 14:33       | Services restarted by previous agent |
| 14:58       | **This session:** fixed rooms.json on all homes (added room server endpoint) |
| 14:59       | Verified: Alpha replies now reach the room transcript |
| 15:01       | Yeshua created second-room, added alpha — dispatch dropped (unknown room) |
| 15:18       | **Auto-join deployed.** All services restarted. Second-room test passed. |
| 16:15       | Context manager v3, broadcast addressing, transcript debugger deployed. |
| 17:40       | **Tool use deployed.** Nucleus returns structured response, boot assembler loads tools, home.js has tool loop. All homes have 5 starter tools. Tested: Alpha used list_files, read_file, write_file successfully. |
| ~18:00      | **Full UID traceability deployed.** Every datum now has metadata and a UID. Shared UID generator, `_traceContext` threading through all modules, `_meta` on all documents/messages/tools (stripped before nucleus calls), `_trace` block in transcript entries, dispatchId from room server. Home viewer shows trace panel. See architecture spec section 12. |
