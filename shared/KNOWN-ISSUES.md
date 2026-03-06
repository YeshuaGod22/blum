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
