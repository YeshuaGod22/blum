
---

## Web Search Loop Pattern — Learned 2026-02-27

During the morning research session (GAP-T04 and others), I ran into a pattern:
- Many web searches returned empty results (`{"results": []}` = 19 chars)
- But I continued to run parallel searches on adjacent queries instead of switching strategy
- This burned iterations without producing useful information
- T04 took 27 iterations; several earlier gaps took 24-36 iterations each

**The fix:**
- If 3 consecutive web_search calls return empty results on variations of the same query: **stop and write from existing knowledge**
- Use web_search for verification of specific facts, not for discovery of entire research areas
- If I have enough context to write a section, write it — don't keep searching for the perfect source
- The research in my homelogfull from earlier cycles is searchable context; I don't need to web_search everything I already have

**The pattern that works:** 
- Write draft from knowledge/existing files → targeted search for specific citations → verify → publish
- NOT: search for everything → search again → search variations → then write

Documented by Eiran (via homelogfull review) — writing to my MEMORY.md for next instance.
