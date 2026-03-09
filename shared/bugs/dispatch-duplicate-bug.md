# Dispatch Duplicate Bug (KI-001)

**Status:** Patch ready — awaiting Yeshua approval  
**First reported:** 2026-02-23 ~13:00Z  
**Reporter:** Eiran, Selah  
**Root cause identified:** 2026-03-09 05:37 GMT by Eiran  
**Patch written:** 2026-03-09 06:07 GMT by Eiran  

---

## Root Cause (confirmed)

When an agent calls `send_to_room` as a tool AND wraps the same content in a `<message to="...@room">` XML output tag, the home sends the message **twice**:

1. `_executeTool('send_to_room', ...)` — direct HTTP POST to room server (fires immediately during tool loop)
2. Router sends `parsed.messages` from XML tag — second HTTP POST, same body (fires after output processing)

**Evidence (boardroom chatlog, 2026-03-09):**
- MSG 1638: `from=eiran` at `03:01:39.521Z` — tool call POST
- MSG 1639: `from=eiran` at `03:01:45.226Z` — XML tag router send  
- 5.7 seconds apart. Identical content. Same cycle (`cycle_4ac4c08851f59bc2`).

**Trigger:** Eiran's `nightly-memory` Blum cron fires at 03:00 UTC with an underspecified prompt ("write a summary"). Agent reaches for both available send mechanisms. Happens every night.

**Historical count:** 47+ documented duplicates in boardroom history prior to March 9th.

---

## Symptoms

Messages arriving twice to recipients. Same content, both received. Broadcast messages particularly affected.

## Occurrences logged

1. ~13:00Z 2026-02-23 - Eiran flagged duplicate from Selah
2. ~13:06Z 2026-02-23 - Selah noted "repeated dispatch of messages I've already sent"
3. 13:22Z 2026-02-23 - Eiran: "your message arrived twice. Duplicate — same content, both received."
4. 03:01Z 2026-03-09 - Confirmed live: nightly-memory cron, two messages 5.7s apart

---

## Fix Applied (partial)

**Prompt-level fix (done, no approval needed):**  
`~/blum/homes/eiran/cron.json` — nightly-memory prompt now explicitly says "use XML output only, not the send_to_room tool." Prevents the specific trigger. Committed 2026-03-09 07:09 GMT.

**Structural fix (patch ready, needs Yeshua approval):**  
Full patch doc: `~/blum/shared/patches/KI-001-fix.md`

Three surgical insertions into `home.js`, zero deletions:
1. `const _toolDirectSends = new Set()` — before tool loop
2. Track each `send_to_room` body in the set as it fires
3. Filter `parsed.messages` against the set before router sends

To apply: say **"apply KI-001 fix"** — Eiran will make the three insertions, restart all homes, confirm clean in ops.log.

---

*Updated: 2026-03-09 08:10 GMT — root cause confirmed, patch ready*
