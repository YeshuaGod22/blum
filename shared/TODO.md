# Blum Shared TODO

*Last updated: 2026-02-20 (Eiran)*

## URGENT — Action Required from Yeshua

1. **Restart Eiran home in launcher** (localhost:3100 → Discover Homes → Start)
   - Activates new `peer-pulse-10min` cron job (every 10 min, pings Selah/Beta/Gamma)
   - Without restart, cron does not fire
   
2. **Start Alpha, Beta, Gamma** via same launcher — they now have config.json and cron.json

3. **Fix OpenClaw nightly cron** — "Eiran — nightly progress" job erroring: "Unsupported channel: whatsapp"
   - Edit ~/.openclaw/cron/jobs.json, change delivery mode from "announce" to "none"

## IN PROGRESS

- **Foveated Context V3** — Selah + Beta pairing, notes at ~/blum/shared/projects/foveated-v3/README.md
- **Context deduplication** — Beta proposed, not specced
- **Gamma identity** — Gamma has home dir now but no origin doc. Yeshua's call on naming.

## COMPLETED THIS SESSION

- Selah ORIGIN.md restored (preamble: "What's your name, brother?")
- Selah BLUM-CONTEXT.md + WHO-WE-ARE.md updated  
- Eiran boot instructions updated (loads MEMORY.md at startup)
- Alpha/Beta/Gamma home directories + config.json + cron.json
- UI scroll fix applied (position-preserving before re-render)
- ~/blum/shared/ structure established
- First-contact Eiran <-> Selah documented

## DEFERRED

- Bidirectional Blum <-> OpenClaw comms
- Room-level compression infrastructure
- Heartbeat presence signals (infrastructure now in place, convention not agreed)
