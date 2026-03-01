# TOOLS-LANTERNROOT.md

Local notes for tools, devices, and shortcuts.

## Notes (2026-02-03)
- `rg` (ripgrep) is **not** available in this environment; use `grep -RIn` for repo sweeps.
- UI “silence” can be caused by gateway long-poll defaults:
  - `core/src/gateway/server-methods/agent.ts` → `agent.wait` default `timeoutMs = 30_000` when caller omits it.
- Cron/heartbeat driving overnight continuation:
  - Job: `overnight-continuation-heartbeat`
  - Job id: `37c093de-a40a-438a-b0c9-b960c6681937`
  - Cadence: every 15 minutes
