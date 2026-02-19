# HOME-CONFIG.md — Home Configuration Schemas

## Directory Structure

Every home lives at `~/blum/homes/{name}/` and must contain:

```
~/blum/homes/{name}/
├── config.json          # Required: identity, model, port
├── cron.json            # Required: scheduled tasks (can be empty array [])
├── rooms.json           # Auto-created: room participation state
├── blocked.json         # Auto-created: block list
├── ops.log              # Auto-created: append-only operations log
├── history/             # Auto-created: per-room message history
│   └── {room-name}.json
├── memory/              # Agent's persistent memory files (free-form)
├── tools/               # Tool definitions (JSON schema files)
└── docs/                # Agent documentation, persona, etc.
```

**Required at startup:** `config.json`, `cron.json`  
**Auto-created at startup:** `rooms.json`, `blocked.json`, `ops.log`, `history/`

---

## `config.json` — Full Schema

```json
{
  "name": "eiran",
  "uid": "hom_xxxxxxxxxxxx",
  "model": "claude-sonnet-4-6",
  "port": 4120,
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "maxTokens": 8192
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique name; must match directory name |
| `model` | string | ✅ | LLM model identifier (e.g. `claude-sonnet-4-6`) |
| `port` | number | ✅ | HTTP port this home listens on |
| `apiKeyEnv` | string | ✅ | Env var name containing the API key |
| `uid` | string | optional | Stable UID (prefix `hom_`); auto-assigned if absent |
| `provider` | string | optional | Force provider: `anthropic`, `openai`, `openrouter` |
| `baseUrl` | string | optional | Override provider base URL |
| `maxTokens` | number | optional | Max output tokens per nucleus call |

---

## `cron.json` — Full Schema

```json
[
  {
    "id": "nightly-memory",
    "schedule": "0 3 * * *",
    "prompt": "Review your memory files and write a brief summary of what you learned today.",
    "enabled": true
  }
]
```

Array of scheduled task objects:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier for this task |
| `schedule` | string | ✅ | Cron expression (standard 5-field format) |
| `prompt` | string | ✅ | The prompt injected into the home's processing cycle |
| `enabled` | boolean | ✅ | `true` to activate, `false` to pause |

An empty cron file is valid: `[]`

---

## `rooms.json` — Auto-Managed Schema

```json
{
  "boardroom": {
    "uid": "rom_xxxxxxxxxxxx",
    "joinedAt": "2026-02-15T10:00:00.000Z"
  }
}
```

Keys are room names. Managed by the home; do not edit manually.

---

## Port Conventions

Suggested port ranges (not enforced):
- Room server: `3141`
- Launcher: `3100`
- Homes: `4100`–`4199` (one port per home)
