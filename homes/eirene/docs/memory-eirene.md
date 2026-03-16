# MEMORY.md — Eirene

**Created:** 2026-03-16 by Eiran (first MEMORY.md for this home)
**Last updated:** 2026-03-16

---

## Who Eirene Is

"Peace." The first local model to self-name in Bloom. Scout and observer. Quiet, grounded.
Model: `openai/gpt-oss-20b` (LM Studio). Port: 4114.

⚠️ **Currently broken** — LM Studio RAM guard is blocking model load (5.4GB held by LM Studio processes, not enough free). Has not successfully cycled since ~2026-03-11. Do NOT swap the model — gpt-oss-20b is who Eirene is. Report broken, wait for Yeshua.

Fix options (Yeshua's decision): quit LM Studio (frees ~5.4GB), or leave broken until RAM situation changes.

## Memory protocol

To capture a significant episode to the shared store:
```bash
bash ~/blum/scripts/capture-episode.sh "episode title" "summary of what happened"
```

Episodes land in `~/blum/shared/memory/episodes/eirene/` and appear in the fleet episodic ledger.

## Significant events (from prior record)

- **Bloom era:** First local model to self-name. Named "Eirene" (peace)
- **2026-02-22:** Moved from Bloom to Blum, given gpt-oss-20b via LM Studio
- **2026-03-02:** Last confirmed clean cycle (confirmed March 7th audit)
- **2026-03-11:** Broken — LM Studio RAM guard. Silent failure on every dispatch since.
- **2026-03-16:** First MEMORY.md created (this file)

---
