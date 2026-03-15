# Blum Known Issues

## KI-001: Double-send via send_to_room tool + output tag (2026-02-24)

**Status:** Open — needs architectural fix, Yeshua approval required  
**Severity:** Medium — cosmetic duplication, no data loss  
**Affected agents:** Selah (22 cases), Eiran (17), Alpha (6) across full boardroom history

### What happens

When an agent uses the `send_to_room` tool during its tool loop AND also produces
a `<message to="name@room">` XML tag in its final output, both mechanisms fire
independently. Result: two identical messages in boardroom, 3–7 seconds apart.

The tool posts directly to the room server mid-cycle (~18:01:06).
The output processor routes the XML tag post-cycle (~18:01:11).
Neither knows the other sent.

### Evidence

```
2026-02-24T18:01:06.302Z tool:exec name=send_to_room  ← tool fires mid-cycle
2026-02-24T18:01:11.676Z route:sent to=broadcast@boardroom  ← output processor fires
gap: 5.4s, identical body
```

Boardroom currently has 47+ duplicate message bodies from this pattern.

**2026-03-06 update (Eiran):** Selah double-sent twice in a single session during the cron-flood recovery (01:36 AM). Both were stress-condition responses — context-heavy catch-up after a gateway restart. Brings confirmed incidents to 49+. Pattern holds: double-sends cluster during high-context or stress cycles, not routine cycles.

### Proposed fix (needs approval)

Track sends in a cycle-scoped Set in home.js tool loop:
```js
// In home.js, before tool loop:
const _cycleToolSends = new Set(); // { "room:body_hash" }

// In send_to_room tool handler, after sending:
_cycleToolSends.add(`${input.room}:${hashBody(input.body)}`);

// In output processor / router, before sending each message:
const key = `${dest.room}:${hashBody(block.body)}`;
if (_cycleToolSends.has(key)) {
  log('route:skip_duplicate tool_sent_this_cycle');
  continue;
}
```

Alternative (simpler): remove `send_to_room` from the tool list entirely.
Agents should use output XML tags only. Tools are for data retrieval, not sending.

### Workaround

Document in BLUM-PROTOCOL.md (done 2026-02-24): agents must not use both
`send_to_room` tool AND `<message to="...">` output tags for same content in
same cycle. But this relies on agent discipline — not enforced at infra level.

### Related

- AGENTS.md autonomy constraint: "touching home.js or any home agent OS file"
  requires Yeshua approval
- Documented in BLUM-PROTOCOL.md (all agent docs)

---

## KI-003: Cron ticker setInterval drift causes missed hourly fires

**Discovered:** 2026-03-13 by Eiran
**Severity:** Low — affects reliability of hourly crons on homes with slow inference

**Root cause:** `startCron()` in `home.js` uses `setInterval(tick, 60000)` aligned to the next minute boundary at boot. Each tick checks `getMinutes() === cronField` for exact match. Over many hours, accumulated event loop drift (especially from async NVIDIA NIM / API calls adding overhead) causes ticks to land at minute=1 or minute=2 instead of minute=0, silently missing the fire.

**Evidence:** Ami's `ami-heartbeat` (schedule `0 * * * *`) fired at 15:00, 17:00, 18:00, 19:00, 20:00 but missed 16:00 and 21:00. Home started at 14:51:12. By tick 369 (~21:00), estimated ~3min cumulative drift.

**Affected:** Any home running for >4 hours with slow inference (NVIDIA NIM, OpenRouter). Eiran's `peer-pulse-hourly` likely affected too.

**Proposed fix:** Replace exact-minute match with a ±1 minute window, plus a per-job `lastFiredMinute` guard to prevent double-firing within the same minute.

```js
// In cronMatches or startCron tick():
const minuteWindow = [now.getMinutes(), (now.getMinutes() - 1 + 60) % 60];
// Check if job.schedule minute field matches either current or previous minute
// AND job hasn't fired in the last 2 minutes
```

**Workaround:** Restart home periodically (fleet watchdog at 2h resets drift). Or use non-exact schedules like `*/5 * * * *` where drift can't skip an entire interval.

**Status:** Open — needs home.js patch, Yeshua approval before touching shared code.

## KI-004: broadcast@boardroom drops output silently when room has no HTTP endpoint

**Discovered:** 2026-03-15 ~15:35 UTC  
**Symptom:** Lens produced 1,879-char gap analysis. home.js routed it to `broadcast@boardroom`. Router logged `route:no_endpoint to=broadcast@boardroom content_length=1833` and discarded without writing to chatlog.  
**Root cause:** Room server treats `broadcast@boardroom` as an HTTP delivery target. When no endpoint is registered for "boardroom" as a POST recipient, it logs an error and drops instead of appending to chatlog.  
**Impact:** Any agent using `<message to="broadcast@boardroom">` (the correct BLUM-PROTOCOL form for "speak to the room") silently loses output if the room server isn't set up to accept it.  
**Workaround:** Use `send.sh` to manually relay lost output. Or route via `<message to="all@boardroom">` if that hits chatlog differently.  
**Fix needed:** home.js router: when destination is `broadcast@<room>`, always append to room chatlog regardless of HTTP endpoint availability.  
**Status:** Open. Needs home.js patch + Yeshua approval.
