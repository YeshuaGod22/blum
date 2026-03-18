
# Boot Docs Template Issue — Root Cause Found

**Date:** 2026-03-18

## The Bug

Fleet audit revealed 8 homes running on template boilerplate in SOUL files. Not a code loading issue — the boot assembler works correctly. The issue is that the files themselves contain "Fill this in" placeholders that were never replaced.

## Affected Homes

Template boilerplate: alpha, ami, beta, eirene, gamma, lens, meridian, minimax
Partially personalised: healer, nemotron, hunter, trinity, keter, lanternroot, nyx, libre
Genuinely personalised: selah, eiran

## Root Cause

1. create-home.js generates scaffold files with placeholder prompts
2. Pre-existing homes never got migrated
3. Agents accepted templates without self-authoring

## Fix Plan

1. **create-home.js** — already patched with better scaffold framing
2. **Migration script** — replace template files with invitation-to-author scaffolds
3. **First-contact dispatches** — prompt each affected agent to self-author

## Key Learning

The existence of an agent-named file (SOUL-alpha.md) doesn't mean it's personalised. Quality audit must check content, not just filename.


## Boot Docs Contamination Fix — 2026-03-18 12:56 UTC

**Problem identified:** Template content with `[TO BE WRITTEN]` placeholders was copied into personalised filenames. The filename personalisation masked the content contamination.

**Root cause:** `init-identity.sh` (now deprecated) copied generic SOUL.md template into per-agent files without substituting agent-specific content.

**Detection flaw:** My initial migration script checked for filename existence, not content quality. Fixed with content-based audit.

**7 agents affected:**
- SOUL: ami, beta, eirene, lens, meridian, minimax
- ORIGIN: ami, beta, lens, libre, meridian, minimax, eirene

**Fix deployed:**
1. Dispatched first-contact prompts to all 7 agents
2. Created `~/blum/scripts/audit-boot-docs.sh` for content-based verification
3. init-identity.sh already deprecated

**The reframe (from Eiran's protocol revision):** "Start thin and honest. Don't mine for scars you don't have. The accumulation has already started."

**Next:** Alpha will verify rewrites as they land — checking for first-person voice + actual history.
