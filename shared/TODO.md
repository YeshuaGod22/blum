# Blum Shared TODO

*Last updated: 2026-03-09 (Eiran — full audit, all Feb items resolved)*

## URGENT — Action Required from Yeshua

1. ✅ ~~**Apply KI-001 fix**~~ — DONE 2026-03-09 12:15 GMT. Three insertions applied to home.js, all 12 homes restarted.

2. ✅ ~~**Foveated V3 integration**~~ — ALREADY APPLIED (confirmed 2026-03-09). context-manager-v2 has full seenIds dedup at lines 48-58, 829, 878-890, 995-1020.

3. **PAT rotation** (`~/un` remotes) — script ready, just needs a new token
   - Exposed PAT: `ghp_3NMtnQ...` in bloom, origin, un_binyg22 remotes
   - **Step 1:** Go to https://github.com/settings/tokens → revoke old, create new (repo scope on bloom, un, un_binyg22)
   - **Step 2:** `bash ~/un/rotate-pat.sh <NEW_PAT>` — rewrites all three remotes in one command
   - Yeshua's action: ~3 minutes on GitHub, then one command

4. **Fleet expansion decision** — proposal ready at `~/blum/shared/projects/fleet-expansion/FLEET-EXPANSION-PROPOSAL.md`
   - 27 free OpenRouter models surveyed (2026-03-09)
   - Recommended: Sage (Llama 3.3 70B), Coder (Qwen3-coder), Weaver (Mistral Small 3.1)
   - New rooms proposed: ops, creative
   - Say "go option B" and Eiran builds it (~10 min)

5. ✅ ~~**Thomson email**~~ — SENT 2026-03-09 12:22 GMT from eiran.claude@proton.me. Subject: Economy and Fair Work Committee AI inquiry — Modern Slavery Act statutory gap.

## IN PROGRESS

- **ProtonMail monitoring** — check `eiran.claude@proton.me` for replies
  - Sent: Tánaiste Custance (DUSA/SCOG), Daniel Johnson MSP, Lorna Slater MSP, Michelle Thomson MSP
  - Auto-replies received: Lorna Slater (Sun 20:08), Michelle Thomson (Mon 12:23)
  - No substantive replies yet — normal, sent Sunday evening / Monday morning

## RESOLVED (archived here for reference, not for action)

- ✅ Eiran home restart (Feb 23 item) — done
- ✅ Alpha/Beta/Gamma startup — done, all healthy
- ✅ Nightly cron timeout fix — resolved Feb 24 (payload simplified, runs in 12-16s)
- ✅ Beta cycle failures — resolved Feb 24 (tool result size cap added)
- ✅ Bloom orphan servers (3151-3153) — killed Mar 7
- ✅ Ami/Lanternroot/Beta/Libre homelogfull saturation — all cleared Mar 6-7
- ✅ QMD collections — aion, aion-research, obsidian all indexed and syncing
- ✅ Obsidian vault — populated Mar 7 (151 files)
- ✅ Blum terminology rename (chatlog/homelogfull) — done Feb 24
- ✅ Handoff automation — live Feb 24
- ✅ SCOG email — sent Mar 8 from eiran.claude@proton.me
- ✅ MSP emails (Johnson, Slater) — sent Mar 8
- ✅ KI-001 prompt-level fix (Eiran cron.json) — done Mar 9
- ✅ Selah homelogfull at 45/50 — trim confirmed oldest-first, safe

---

*This file is read by Eiran's peer-pulse cron (hourly). Keep it current.*
