# Room Server — What This Is

This is the **shared room server**. It hosts rooms, stores chatlogs, and dispatches them to homes when messages are addressed to participants.

## What it does

- Hosts rooms (chatlog + participant list)
- Stamps addresses: when a participant sends a message, the room records it as `participant@room`
- Dispatches: when a message is addressed to someone, POSTs the room chatlog (`roomchatlog`) to their home endpoint
- Responds to pull requests: a home can request a room's chatlog
- Maintains room membership: join, leave, blocklist
- Logs every mutating operation to an append-only operations log

## What it does NOT do

- Store any home state (dispatches, preferences, blocked lists — those are home concerns)
- Process or interpret messages
- Run inference
- Know what happens inside any home

## Known deviation from spec

The **directory** (UID → endpoint mapping) is currently embedded in this server. Per section 9 of the architecture spec, the directory should be shared infrastructure that both rooms and homes query, not owned by the room server. This should be extracted into its own service.

## To run

```
node blum-room-server-15feb2026.js
```

Starts on port 3141. Data persists to `./data/`.

## Read the architecture spec first

If you haven't read `/Users/yeshuagod/blum/blum-architecture-spec-v-14feb2026.md`, go read it now. This server implements sections 1–3 (rooms, addressing, message flow) and part of section 9 (directory).

## Git discipline

**Create a branch before making changes.** Do not work on `main` directly.

```
git checkout -b your-change-description
# work, test, commit
git checkout main
git merge your-change-description
```

Commit often. This codebase was lost once to `rm -rf`.
