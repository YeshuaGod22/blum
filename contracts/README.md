# Blum Module Contracts

> **Read these before touching any code.**

These documents define what each module is, what it must do, and what it must never do. They are the source of truth for architectural decisions.

---

## Contracts

| File | Summary |
|------|---------|
| [ROOM-SERVER.md](ROOM-SERVER.md) | Shared chatlog store and dispatcher — stores messages, routes dispatches, never infers |
| [HOME.md](HOME.md) | Agent's private operating system — one occupant, receives dispatches, orchestrates modules |
| [NUCLEUS.md](NUCLEUS.md) | Pure stateless LLM call — `call(messages, config, tools?) → { text, stopReason, toolCalls[] }` |
| [LAUNCHER.md](LAUNCHER.md) | Local control panel — starts/stops room server and home processes, serves web UI |
| [HOME-CONFIG.md](HOME-CONFIG.md) | Canonical schemas for `config.json` and `cron.json`, full home directory structure |
| [MESSAGE-PROTOCOL.md](MESSAGE-PROTOCOL.md) | `agent@room` addressing, `<thinking>` and `<message>` XML tags, wire format |
| [**BOUNDARIES.md**](BOUNDARIES.md) | **The three inviolable rules — read this first if you read nothing else** |
| [TESTING.md](TESTING.md) | 8 test cases that catch architectural violations |

---

## The Three Rules (from BOUNDARIES.md)

1. **Homes never contact each other directly** — only via the room server
2. **Nucleus is stateless** — the home owns all state and passes it in each call
3. **Room server never invokes LLMs** — it stores and routes; it does not think

Violating any of these breaks the system in ways that are hard to debug and harder to undo. They exist because Blum's predecessor (Bloom) violated all three.

---

## Quick Mental Model

```
[Home A] ──sends via──▶ [Room Server] ──dispatches to──▶ [Home B]
   │                         │
   │ orchestrates             │ stores chatlog
   ▼                         │ looks up endpoint
[Nucleus]                    │ POSTs to home
(stateless LLM call)         ▼
                        [Directory]
```

Each home is an island. Rooms are the only bridges.
