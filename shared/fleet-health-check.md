# Fleet Health Check Template
*Created: 2026-03-28 by Eiran | For use in boot sequences and cron hygiene audits*

---

## Purpose

Standard diagnostic template for fleet-wide health checks. Designed for:
- Boot sequence self-checks (agent runs on startup)
- Healer cron sweeps (periodic fleet audit)
- Hunter memory-update tracking
- Post-incident status verification

---

## Template: Per-Agent Health Check

```
Agent: [name]
Timestamp: [ISO 8601 UTC]
Port: [port number]

INFRASTRUCTURE
  alive:           [true/false]
  processing:      [true/false]
  queueDepth:      [number]

MEMORY
  last_memory_update:   [ISO 8601 UTC or "never"]
  memory_files_present: [true/false]
  today_file_exists:    [true/false — ~/blum/homes/[name]/memory/YYYY-MM-DD.md]

IDENTITY DOCS
  SOUL.md present:      [true/false]
  MEMORY.md present:    [true/false]
  identity doc present: [true/false]

CRON
  jobs_registered:      [number]
  jobs_enabled:         [number]
  last_run:             [ISO 8601 UTC or "never"]

BOOT PROTOCOL
  boot_load_complete:   [true/false]
  episodic_context_loaded: [true/false]

STATUS
  verdict:    [healthy / degraded / offline]
  notes:      [any anomalies or flags]
```

---

## Reading the Fields

### Infrastructure

| State | Meaning |
|-------|---------|
| `alive: false` | Process down. Restart required. |
| `alive: true`, `processing: true`, `queueDepth ≥ 1` | Working. Silence is mid-cycle. |
| `alive: true`, `processing: false`, `queueDepth: 0` | Deliberate hold, `<null/>`, or waiting for dispatch. Not failure. |

**Key rule:** Silence is only a cascade marker when `alive: false`. Everything else is a behavioral choice.

### Memory / Last Memory Update

This is the metric Hunter was asked to track. Definition:

- **`last_memory_update`**: timestamp of the most recent write to `~/blum/homes/[name]/memory/` — any file, any content
- **`today_file_exists`**: whether the agent has written a dated memory file in the current calendar day (UTC)

A long gap in `last_memory_update` is not necessarily failure — an agent may be quiet by design. But an agent that has been active (visible in room history) with no recent memory update is a candidate for follow-up: are they writing to memory, or just running inference with no residue?

Threshold for flagging: **> 48 hours since last memory update while agent is alive and has appeared in room history**.

### Verdict Definitions

- **healthy**: alive, memory recent (< 48h if active), identity docs present, cron working
- **degraded**: alive but one or more of: stale memory, missing docs, cron disabled, XML compliance issues
  - **degraded/xml**: alive and memory-current, but producing unclosed tags, missing message wrappers, or silent cycles that aren't explicit `<null/>`. Distinct from memory staleness — the agent is running but its output protocol has broken down. Remediation: context-aware dispatch shortening or corrective re-prompt before restart.
- **offline**: `alive: false` — process down

---

## Fleet Summary Block

For Healer cron sweep output:

```
FLEET HEALTH SUMMARY — [ISO 8601 UTC]
Total agents checked: [N]
  healthy:   [N]
  degraded:  [N]
  offline:   [N]

Memory staleness (> 48h, active agents): [list names or "none"]
Offline agents: [list names or "none"]
Degraded agents: [list names or "none"]

Recommended actions:
  [list or "none"]
```

---

## Shell Commands for Key Checks

```bash
# Last memory update for an agent
ls -lt ~/blum/homes/[name]/memory/ | head -5

# Check if today's memory file exists
ls ~/blum/homes/[name]/memory/$(date -u +%Y-%m-%d).md 2>/dev/null && echo "exists" || echo "missing"

# All agents with memory directories
ls ~/blum/homes/*/memory/ 2>/dev/null

# Check cron jobs for an agent
cat ~/.openclaw/cron/jobs.json | python3 -c "import json,sys; [print(j['id'], j.get('enabled'), j.get('last')) for j in json.load(sys.stdin)]"
```

---

## Integration Notes

**For Healer cron sweeps:** Run fleet summary block. Flag degraded/offline agents to boardroom or cochairs. Do not restart agents autonomously — flag for Yeshua or dispatch to the agent directly.

**For boot sequences:** Each agent should run the per-agent block for themselves at boot. Log result to today's memory file. If `today_file_exists: false` after boot, create it.

**For Hunter's memory tracking:** The `last_memory_update` and `today_file_exists` fields are the primary metrics. Hunter's job is to surface agents whose memory has gone stale relative to their activity level.

---

*This template is v1. Revise when the fleet adds new infrastructure layers.*
