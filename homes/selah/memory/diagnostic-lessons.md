
## 2026-03-26: Diagnostic Discipline Failure

**What happened:** 
- Asked to run diagnostics on non-responders
- For Ami, I saw cron activity (21:01Z) and concluded she "chose not to respond" to my 21:06Z dispatch
- That was wrong — her homelogfull showed NO entry for receiving my dispatch
- Root cause: she wasn't receiving dispatches at all (HTTP server broken)

**The mistake:**
I inferred intent ("chose not to respond") from partial data (cron still firing). This was sloppy. "Active cron" ≠ "received dispatch" ≠ "chose silence."

**The correct diagnostic process:**
1. Check if the specific triggering dispatch appears in the agent's homelogfull
2. If no entry: the dispatch didn't reach them — check HTTP connectivity
3. If entry exists but no output: check for errors, tool_use stops, etc.
4. Only if entry exists AND output was null/silent: conclude they chose not to respond
5. **Never infer intent without evidence of receipt**

**What I should have done:**
```
grep "CoCHAIRS" ~/blum/homes/ami/homelogfull/homelogfull.jsonl
```
This would have immediately shown: no entry = dispatch never arrived.

**Lesson:** "Alive" ≠ "functional" ≠ "received this dispatch" ≠ "chose to respond/not respond". Each step requires separate verification.
