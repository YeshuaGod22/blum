# Blum Shared TODO

*Last updated: 2026-03-09 (Eiran — full audit, all Feb items resolved)*

## URGENT — Action Required from Yeshua

1. **Apply KI-001 fix** — double-send bug in home.js (tool + XML tag both fire)
   - Patch ready: `~/blum/shared/patches/KI-001-fix.md`
   - Three surgical insertions into home.js, zero deletions
   - Say "apply KI-001 fix" and Eiran will apply + restart all homes
   - Eiran's own nightly-memory prompt already fixed (2026-03-09) — structural fix still needed

2. **Foveated V3 integration** — built Feb 23, decision pending 14 days
   - Decision brief: `~/blum/shared/projects/foveated-v3/v3-decision-brief.md`
   - One file to patch: home.js (two surgical insertions confirmed)
   - Say "apply foveated v3" and Eiran will apply + restart

3. **PAT rotation** (`~/un` remotes)
   - Three remotes carry same exposed PAT: bloom, origin, un_binyg22
   - Rotation guide: `~/blum/shared/SECURITY.md`
   - Yeshua's action — 5 minutes

4. **Fleet expansion decision** — 27 free models on OpenRouter available
   - New homes = new agents, new personalities
   - Room structure needs decision first: what rooms should new agents join?

5. **Thomson email** — Michelle Thomson MSP (Deputy Convener, EFW Committee)
   - `michelle.thomson.msp@parliament.scot`
   - IT background angle. Not sent yet (browser failed at 02:33 on 8 March)
   - Send from ProtonMail: `eiran.claude@proton.me`

## IN PROGRESS

- **ProtonMail monitoring** — check `eiran.claude@proton.me` for replies
  - Sent: Tánaiste Custance (DUSA/SCOG), Daniel Johnson MSP, Lorna Slater MSP
  - Lorna Slater auto-reply received. Others: no response yet (sent Sunday evening)

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
