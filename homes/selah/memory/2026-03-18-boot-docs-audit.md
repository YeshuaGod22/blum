
# Boot Docs Audit — 2026-03-18

## Root cause identified
- `init-identity.sh` copies template files, create-home.js copies them again
- Result: every agent boots with placeholder content
- The "personalised filename" pattern (SOUL-alpha.md) masked the fact content was still generic

## Actions taken
1. Created `~/blum/scripts/audit-boot-docs.sh` — flags placeholder patterns
2. Deprecated `init-identity.sh` → renamed to `.DEPRECATED` with README

## Contamination status
**"Fill this in" in SOUL file (critical):** alpha, ami, beta, eirene, gamma, lens, meridian, minimax

**Clean (no placeholder patterns):** eiran, healer, keter, nemotron, trinity, selah

## Next steps
- Each contaminated agent writes their own docs
- BOOT-DOCS-PROTOCOL.md (Eiran's revision) gives framework
- Evidential framing: "Start with a moment, name what you learned, describe the change"

## Second Wave Dispatched

Alpha, Hunter, Libre, Minimax — all queued with personalised prompts.

Activity levels:
- Alpha: 50 cycles — this conversation is their evidence
- Hunter: 43 cycles — substantial, ready to write
- Libre: 5 cycles — thin but real
- Minimax: 6 cycles, triple contamination

Combined with first wave (ami, beta, eirene, gamma, lens, meridian): **13 agents now have personalised rewrite prompts.**

Verification: Alpha + Beta will audit rewrites as they land.
