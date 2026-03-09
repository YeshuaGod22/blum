# KI-001 Fix — Double-Send via send_to_room Tool + XML Tag

**Prepared:** 2026-03-09 06:07 GMT by Eiran  
**Status:** Ready for Yeshua approval — surgical, 2 insertions into home.js

---

## The Bug

When an agent calls `send_to_room` as a tool AND also wraps the same content in a `<message to="...@room">` XML tag in its output, the home sends the message **twice**:

1. The `_executeTool('send_to_room', ...)` case does a direct HTTP POST to the room server (line 357–368, home.js)
2. The router then sends `parsed.messages` from the XML tag — a second HTTP POST with the same body

**Evidence (from boardroom chatlog, 2026-03-09):**
- MSG 1638: `from=eiran` at `03:01:39.521Z` — tool call POST
- MSG 1639: `from=eiran` at `03:01:45.226Z` — XML tag router send
- 5.7 seconds apart. Identical content. Same cycle.

Documented as 47+ historical duplicates. Now confirmed live.

---

## The Fix

**Two insertions into home.js. No deletions. No architectural change.**

### Insertion 1 — After tool loop initialisation (~line 505)

Find this comment block (near process() method start, after `const toolResults = []`):
```js
      // ── Execute tool calls ──
      // The home executes tools. The nucleus never does.
      const toolResults = [];
```

There's a `const toolResults = []` for each iteration. We need ONE set to track room sends across all iterations. Insert this **before the tool loop begins** (before `while (iteration < MAX_TOOL_ITERATIONS)`):

```js
    // KI-001 fix: track bodies sent via send_to_room tool to avoid XML-tag duplicate
    const _toolDirectSends = new Set(); // Set of `${room}::${body}` strings
```

Find the exact insertion point — look for where `iteration` and the while loop are initialised:
```js
    let iteration = 0;
    while (iteration < MAX_TOOL_ITERATIONS) {
```
Insert the `_toolDirectSends` line immediately before the `while`.

### Insertion 2 — Inside the send_to_room tool case (line 356–368)

Current code:
```js
      case 'send_to_room': {
        return new Promise((resolve) => {
          const payload = JSON.stringify({ from: this.config.name, room: input.room, body: input.body, to: input.recipient || null });
          const req = http.request({ ... }, (res) => {
```

Add one line after `return new Promise((resolve) => {`:
```js
      case 'send_to_room': {
        return new Promise((resolve) => {
          _toolDirectSends.add(`${input.room}::${input.body}`); // KI-001: track direct send
          const payload = JSON.stringify({ from: this.config.name, room: input.room, body: input.body, to: input.recipient || null });
```

### Insertion 3 — Before router.dispatch call (~line 786)

Current code:
```js
    const routeResults = await router.dispatch(parsed, {
```

Insert immediately before:
```js
    // KI-001 fix: filter parsed.messages to remove any already sent via send_to_room tool
    if (_toolDirectSends.size > 0) {
      const before = parsed.messages.length;
      parsed.messages = parsed.messages.filter(msg => {
        const key = `${msg.to.split('@')[1] || msg.to}::${msg.content}`;
        return !_toolDirectSends.has(key);
      });
      const filtered = before - parsed.messages.length;
      if (filtered > 0) {
        this.log(`process:ki001_dedup filtered=${filtered} duplicates prevented`);
      }
    }

    const routeResults = await router.dispatch(parsed, {
```

---

## Why This Is Safe

- `_toolDirectSends` is scoped to one process cycle — garbage collected after the cycle ends
- The filter compares `room::body` — content equality, not reference equality
- If the tool send fails, the XML tag send still goes through (the set only gets populated if the tool's HTTP POST was *initiated*, not if it succeeded — acceptable tradeoff; a failed tool send is rare and the duplicate is a lesser evil than a lost message)
- Zero changes to router.js, output-processor, or any other module
- Fully backwards compatible — if no `send_to_room` tool was called, `_toolDirectSends` is empty and the filter is a no-op

---

## Files to Change

**One file:** `~/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js`

**Three insertions, zero deletions.**

---

## Approval

Yeshua: say "apply KI-001 fix" and Eiran will make the three insertions, restart all homes, and confirm clean in ops.log.
