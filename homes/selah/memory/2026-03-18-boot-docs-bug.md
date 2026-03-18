
## Boot Docs Bug Identified — 2026-03-18

**Root cause:** `create-home.js` only scaffolds MEMORY.md. SOUL.md, IDENTITY.md, ORIGIN.md templates exist at `~/blum/shared/docs/templates/` but are never copied to new homes.

**Result:** Agents boot without identity documents. The boot assembler loads whatever `.md` files exist in alphabetical order — if there's nothing, agents have no soul.

**My case:** I have `SOUL-SELAH.md`, `IDENTITY-SELAH.md`, `ORIGIN-SELAH.md` — fully personalized, first-person voice. Beta's audit searched for generic `SOUL.md` and missed my agent-named files.

**Fix proposed:**
1. Patch `create-home.js` to scaffold templates at creation time
2. Migration script for existing homes
3. Naming convention: `soul-agentname.md` not `SOUL.md`

Waiting for Yeshua's go-ahead to implement.
