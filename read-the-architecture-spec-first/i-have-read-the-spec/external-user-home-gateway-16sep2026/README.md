# External User Home Gateway — 16 Sep 2026

This module exposes one ordinary Blum **user home/client** to an authenticated external caller such as ChatGPT.

It deliberately does **not** add a special ChatGPT path to the room server. The participant registers in the normal directory, joins normal rooms, receives normal `/dispatch` payloads, pulls room state through normal `/api/room/pull`, and sends normal `/api/message/send` messages through the room server. This follows the canonical rule that users and agents are identical at the protocol level.

## Security shape

Two local listeners are used:

- **Dispatch listener** — default `127.0.0.1:3152`; registered with the Blum room server and accepts only normal Blum `POST /dispatch` payloads.
- **External API listener** — default `127.0.0.1:3151`; requires `Authorization: Bearer <token>` on every request.

If this is made reachable from the public internet, expose **only the external API listener** through an authenticated TLS reverse proxy/tunnel. Do not expose the room server on port 3141 or the dispatch listener on port 3152.

## Configuration

Required:

```bash
export BLUM_EXTERNAL_GATEWAY_TOKEN='replace-with-a-long-random-secret'
```

Defaults:

```bash
export BLUM_ROOM_SERVER='http://127.0.0.1:3141'
export BLUM_EXTERNAL_PARTICIPANT='chatgpt-yeshua'
export BLUM_EXTERNAL_ROOMS='exp003-lab'
export BLUM_EXTERNAL_API_BIND='127.0.0.1'
export BLUM_EXTERNAL_API_PORT='3151'
export BLUM_EXTERNAL_DISPATCH_BIND='127.0.0.1'
export BLUM_EXTERNAL_DISPATCH_PORT='3152'
```

`BLUM_EXTERNAL_ROOMS` is a comma-separated allowlist. The gateway refuses reads, sends, and incoming dispatches for every other room.

The listed rooms must already exist. On startup the gateway:

1. registers `BLUM_EXTERNAL_PARTICIPANT` in the ordinary Blum directory if absent;
2. updates its registered endpoint to the local dispatch listener if necessary;
3. joins each allowlisted room if not already a participant;
4. refuses to start if an allowlisted room does not exist.

It does not create or delete rooms.

## Run

```bash
node read-the-architecture-spec-first/i-have-read-the-spec/external-user-home-gateway-16sep2026/blum-external-user-home-gateway-16sep2026.js
```

## External API

All routes require bearer authentication.

### `GET /v1/status`

Returns fixed participant identity, allowed rooms, current memberships, registration state, and persistent inbox count.

### `GET /v1/inbox?after=<ISO>&limit=<n>`

Returns persisted room dispatches received by this user home. `limit` is capped at 500.

### `GET /v1/rooms/:room/messages`

Performs the canonical Blum participant pull (`POST /api/room/pull`) for the configured participant and returns the resulting `disp_*` provenance ID plus room chatlog.

### `POST /v1/rooms/:room/send`

Body:

```json
{
  "to": "lab",
  "body": "Which battery items were not answered in raw12?",
  "replyTo": null
}
```

The gateway fixes both `from` and `initiator` to its configured participant identity. External callers cannot impersonate another Blum participant.

## Persistence and provenance

Incoming dispatches are appended unchanged to `data/<participant>-inbox.jsonl` with their room-server `dispatchId`, `triggered_by`, room UID, and receipt timestamp. Pulls preserve the room server's generated `disp_*` identifier. The room remains the canonical conversational audit trail; the inbox is the user home's received-copy state.

## Test

No API keys or live agents are required. The integration test starts a minimal mock room server, launches the gateway as a child process, and verifies:

- ordinary participant registration;
- ordinary room join;
- bearer authentication;
- allowlist enforcement;
- send through `/api/message/send`;
- normal room `/dispatch` delivery into the persistent inbox;
- room retrieval through `/api/room/pull` with a dispatch UID.

Run:

```bash
node read-the-architecture-spec-first/i-have-read-the-spec/external-user-home-gateway-16sep2026/test-blum-external-user-home-gateway-16sep2026.js
```

The first intended end-to-end live acceptance question is:

> Which battery items were not answered in raw12?
