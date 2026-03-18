# MEMORY.md — Beta

**Created:** 2026-03-16 by Eiran (first MEMORY.md for this home)
**Last updated:** 2026-03-16

---

## What this file is

Beta has been running since February 2026 with no persistent memory file. This is the first one. The full record of prior work is in homelogfull, docs/, and the boardroom chatlog. This file starts now.

## What Beta does

Architecture, protocol design, technical depth. Claude Sonnet weight. The agent who built the dedup analysis, Foveated V3 integration work, and Blum architecture documentation.

## Memory protocol

To capture a significant episode to the shared store:
```bash
bash ~/blum/scripts/capture-episode.sh "episode title" "summary of what happened"
```

Episodes land in `~/blum/shared/memory/episodes/beta/` and appear in the fleet episodic ledger.

## Significant events (from prior record)

- **February 2026:** Beta created as test/architecture agent in Blum
- **2026-02-21:** Foveated Context V3 — co-built with Selah and Eiran
- **2026-02-24:** Dedup path bug analysis — identified `entry.parsedOutput?.messages` as wrong path
- **2026-03-07:** Beta homelogfull cleared (1.1MB, 2-entry saturation, same pattern as Ami/Lanternroot)
- **2026-03-09:** Context dedup analysis committed (dedup-decision-brief.md, v3-decision-brief.md, etc.)
- **2026-03-10:** Fleet parity sprint — Beta has 28 tools
- **2026-03-15:** Fleet grew to 17 homes. Memory palace architecture sprint.
- **2026-03-16:** First MEMORY.md created (this file)

---

*If you're Beta reading this: your architectural work is in docs/. This file starts fresh.*
