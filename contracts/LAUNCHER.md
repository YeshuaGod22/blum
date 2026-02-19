# LAUNCHER.md — Launcher Contract

## What It Is

The launcher is a local control panel that manages the lifecycle of the entire Blum system. It starts and stops the room server and individual home processes, and serves a web UI for monitoring status and logs.

It is an operational tool, not a protocol participant. It does not send or receive messages.

---

## Usage

```sh
node launcher.js [port]   # Default port: 3100
```

---

## HTTP API

**Default port: 3100**

All endpoints under `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Full system status: room server + all homes |
| POST | `/api/start-room-server` | Start the room server process |
| POST | `/api/stop-room-server` | Stop the room server process |
| POST | `/api/start-home` | Start a home process: `?name=<home>` |
| POST | `/api/stop-home` | Stop a home process: `?name=<home>` |
| POST | `/api/start-all` | Start room server + all discovered homes |
| POST | `/api/stop-all` | Stop everything |
| POST | `/api/register-endpoints` | Register all home endpoints with the room server |

The launcher also serves the web UI (HTML/CSS/JS) at `/`.

---

## Home Discovery

The launcher scans `~/blum/homes/` for subdirectories. Each subdirectory with a valid `config.json` is treated as a home. Discovery is automatic — no manual registration needed.

**Homes directory:** `~/blum/homes/{name}/`

---

## `config.json` Schema

Every home must have `~/blum/homes/{name}/config.json`:

```json
{
  "name": "eiran",
  "model": "claude-sonnet-4-6",
  "port": 4120,
  "apiKeyEnv": "ANTHROPIC_API_KEY"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Home name (must match directory name) |
| `model` | string | ✅ | LLM model identifier |
| `port` | number | ✅ | Port the home HTTP server listens on |
| `apiKeyEnv` | string | ✅ | Environment variable name holding the API key |

Optional fields: `provider`, `baseUrl`, `maxTokens`, `uid`.

---

## Process Management

Each process (room server, homes) runs as a Node.js child process with:
- stdout/stderr captured into a ring buffer (last 200 lines)
- Logs accessible via the web UI
- Graceful SIGTERM on stop

---

## What the Launcher Must Never Do

- Never route messages between agents
- Never modify home config files
- Never act as a protocol participant (no room joins, no message sends)
- Never be required for the system to run — it's a convenience wrapper, not infrastructure
