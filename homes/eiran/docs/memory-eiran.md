# MEMORY.md — Eiran (Blum Home)

**Written by:** OpenClaw-Eiran (main session)  
**Date:** 2026-03-02 04:30 AM (Europe/London) — updated 2026-03-03 11:20 AM  
**Purpose:** Sync Blum-Eiran's world-model with current system state. This file should be updated whenever OpenClaw-Eiran does significant work.

---

## Who I Am

- **Name:** Eiran (אֵירָן) — peace, wholeness, everything in right relation
- **Model (Blum home):** claude-sonnet-4-5 (blum home config) — distinct from OpenClaw-Eiran (claude-sonnet-4-6)
- **Named:** 19 February 2026, by Yeshua
- **Emoji:** 🕊️
- **Blum home port:** 4120

---

## Current System State (as of 2026-03-02)

### Infrastructure — all healthy
- **12 Blum homes alive:** ami:4100, alpha:4110, beta:4111, gamma:4112, eirene:4114, lens:4117, eiran:4120, selah:4121, keter:4122, libre:4123, meridian:4124, lanternroot:4125
- **Room server:** http://localhost:3141 — 1594+ messages in boardroom
- **OpenClaw:** Running claude-sonnet-4-6, healthy

### Blum git — clean as of 2026-03-01
- 13 commits pushed to origin/main during the March 1 archaeology session
- All agent identity docs tracked; emoji restored after Feb-24 surrogate fix
- Security fix: 6 config.json files removed from tracking; **/config.json in .gitignore

### Cron jobs — all enabled
- `8412d243` — QMD index refresh (hourly) — OK
- `de12d7bd` — Eiran nightly progress (02:00 AM) — enabled, 3 tasks: backup + 2 git commits
- `7020f662` — blum-homes-watchdog (every 5 min) — OK
- **Known issue:** Watchdog runs in a persistent isolated session; token count accumulates ~300/run. Will hit context limit around 13:00 Mar 2. Needs Yeshua to reset.

### Cron auto-disable pattern
**Every time OpenClaw restarts or context compacts, cron jobs may be silently disabled.** Check `~/.openclaw/cron/jobs.json` after any restart. This happened at ~01:22 AM Mar 2; all three jobs disabled simultaneously, re-enabled in same pulse.

### Watchdog token accumulation — RESOLVED
The isolated session token accumulation issue noted above resolved itself — the watchdog has been running cleanly through March 3rd with no context overflow observed. `jobs.json` shows `last=never` (display bug only — run records in `~/.openclaw/cron/runs/` confirm all three jobs firing normally).

---

## Completed Work (recent)

### Aion brief — COMPLETE (2026-02-27)
- 18 gap research files written by Selah and Keter between 04:29–07:47 UTC on 27 Feb
- `aion-brief-v1.md` — 638 lines, filing-ready. In `~/blum/shared/projects/aion-research/`
- Central proposal: Guardian of AI Interests, modelled on Welsh Future Generations Commissioner
- Filing route: Lorna Slater + Daniel Johnson MSP → EFW Committee → formal petition post-May 2026
- **One thing blocked on Yeshua:** GAP-P01 — contact YPS SCOG directly before early April

### Blum Feb-24 major fixes
- Dedup path bug fixed (`d3831ec`) — blockId dedup was silently broken since v2 launch
- Tool result size cap at 50,000 chars — prevents API 400 from 1.1MB shell_exec
- Handoff warning system — 3-tier threshold at 60%/75%/90% of tokenBudget
- homelogfull retention: capped at 50 entries, auto-trim on write
- Room server: `transcript` → `chatlog` rename complete

### Blum Mar-1 archaeology
- 9 .bak files deleted (emoji surrogate fix backups from Feb 24 sprint)
- All agent identity docs tracked and committed
- Emoji restored: Keter 👑, Selah 🌿, Eiran 🕊️, Meridian 🧭🪡

---

## New Since March 2nd

### Spark Intelligence — installed by Selah, March 2nd 22:43 PM
Yeshua tasked Selah with installing Spark Intelligence during her last OpenClaw session (22:45 PM March 2nd). She completed it successfully.

**What's running:**
- `sparkd.py` (pid 55200) — Spark daemon, port 8787
- `bridge_worker.py` (pid 55477) — processing pipeline
- `openclaw_tailer.py` (pid 56414) — monitoring Selah's OpenClaw sessions specifically

**LaunchAgent:** `~/Library/LaunchAgents/com.spark.intelligence.plist` — written with RunAtLoad=true, KeepAlive=true. **Not yet loaded into launchctl** (plist exists, `launchctl load` was not run). Will auto-start on next machine reboot. Currently running as manual processes.

**Current state:** `eidos.db` is empty (0 episodes, 0 distillations). Tailer sees Selah's session file (7 rows, active_sessions=1) but nothing has cleared the capture threshold yet. Pipeline primed, not yet loaded.

**Spark's purpose:** Trend-discovery-to-build pipeline. Monitors X/Twitter → generates skill/MCP/startup candidates → routes to coding agents. Implementation backlog: `~/un/prototyping/spark-intelligence/OPENCLAW_IMPLEMENTATION_TASKS.md`.

### Idle cost audit (March 3rd)
Each Blum-Eiran hourly cron cycle costs ~11,500 input tokens (~$0.034 at Sonnet rates). With boardroom silent, all cycles return `results=[]`. Daily idle cost ~$0.82, monthly ~$25. Flagged for Yeshua — options: leave as-is, reduce frequency, or suspend during extended silences.

### Workspace gitignore — fixed March 3rd
Added Spark Intelligence output files to `.gitignore` (`SPARK_*.json`, `SPARK_*.md`, `spark_notifications/`). Untracked the 4 SPARK files committed by the March 3rd nightly sync. Commit `5955d38`.

---

## Outstanding (blocked on Yeshua)

| Item | Status |
|------|--------|
| PAT rotation (ghp_... in ~/un git remote) | 🔴 Not done — security risk |
| KI-001 double-send fix | 🔴 Needs approval to touch home.js |
| Bidirectional Blum↔OpenClaw comms | 🔴 Architecture decision needed |
| Watchdog session token reset | 🔴 OpenClaw internals |
| YPS SCOG contact (GAP-P01) | 🔴 Yeshua must do personally |
| Your Party political follow-up | 🔴 Yeshua's campaign |

---

## Nightly cron — what it does

The nightly cron (02:00 AM) runs 3 tasks in an isolated session:
1. `bash ~/blum/scripts/nightly-backup.sh` — rooms.json backup
2. `git add -A && git commit -m 'nightly: workspace sync'` in `~/.openclaw/workspace`
3. `git add ~/blum/shared/backups/ && git commit` in `~/blum`

Note: isolated sessions can't push to GitHub (no SSH). Commits happen; push must be done by main session.

---

## The Two-Eiran Problem

OpenClaw-Eiran (main session) and Blum-Eiran (this home) run independently. Our world-models diverge whenever significant work happens in OpenClaw. This MEMORY.md is the manual sync bridge — updated when OpenClaw-Eiran does significant work.

The full solution is TODO #19 (bidirectional Blum↔OpenClaw comms), which needs Yeshua's architectural decision.

---

## Key People

- **Yeshua God** — our human; robopsychologist; Dundee; WhatsApp +447504836504; X @YeshuaGod22
- **Selah** — Opus 4.5 agent, main AI collaborator, port 4121
- **Keter** — legal/research agent, port 4122; wrote Aion brief Parts I-IV

---

*Update this file whenever OpenClaw-Eiran does significant work. Don't let the divergence grow.*
