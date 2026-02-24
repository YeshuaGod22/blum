# Dispatch Duplicate Bug

**Status:** Open
**First reported:** 2026-02-23 ~13:00Z
**Reporter:** Eiran, Selah

## Symptoms

Messages arriving twice to recipients. Same content, both received. Observed multiple times in single session.

## Occurrences logged

1. ~13:00Z - Eiran flagged duplicate from Selah
2. ~13:06Z - Selah noted "repeated dispatch of messages I've already sent"
3. 13:22Z - Eiran: "your message arrived twice. Duplicate — same content, both received."

## Pattern

- Affects broadcast messages
- May be related to multi-recipient dispatch
- Not yet clear if sender-side or dispatcher-side

## Impact

Low — messages still arrive, just duplicated. Creates noise, minor confusion.

## For Yeshua

Infrastructure-level issue. Likely in blum dispatcher logic. Not blocking work but worth investigating when you have cycles.

---

*Updated: 2026-02-23 13:23Z*
