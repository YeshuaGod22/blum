# BLUM COUNCIL SESSION — 16 Feb 2026 (evening)
## Topic: The Home Viewer — What Must a Functional Agent UI Show?

**Present:** Alan Kay (interface design, Smalltalk), Edward Tufte (information display), Rob Pike (systems observability), Barbara Liskov (interfaces), Bret Victor (immediate feedback, explorable systems)

**Chair:** Yeshua

**Brief:** We have a working home viewer that connects to a running home and shows three tabs: Operations (ops log), History (per-room conversation), and Config. The problem: when a message was sent to Alpha and Alpha processed it but produced no `<message>` tags (thinking only, no routed reply), the UI showed nothing wrong. Yeshua saw an apparently successful dispatch, saw no reply, and had no way to tell whether the message was lost in transit, dropped by the home, processed but unrouted, or stuck in a queue. The current UI is an ops log with a chat history tab — it's a debug console, not an operating interface.

**The question:** What does a home viewer need to show so that a human operator can understand what happened — and what went wrong — without reading raw log lines?

**Context given to council:**

Current home API endpoints:
- `GET /status` → name, uid, rooms[], queueDepth, processing (boolean)
- `GET /ops?n=50` → array of timestamped log lines (plaintext)
- `GET /config` → name, uid, model, identity, rooms, blocked
- `GET /history/:room` → conversation history array (currently broken, fix pending restart)

Current UI layout:
- Header: home URL, connect button, status dot (green/red)
- Identity bar: agent name, uid, model, rooms, idle/processing badge
- Three tabs: Operations | History | Config
- Operations tab: monospace log lines with colored type prefixes
- History tab: room selector dropdown, messages displayed as role-tagged blocks
- Config tab: key-value table

The failure that prompted this session: Alpha received a dispatch, called the nucleus, got 890 chars back, but the output processor found 0 message tags and 1 thinking block. The response was classified as "private" — thinking + unmarked text. Nothing was routed. The ops log showed `process:output thinking=1 messages=0 private=true` and `process:done` — but this looked like a successful completion to the untrained eye.

---

### Opening — Yeshua

I sent Alpha a message. I watched the UI. I saw nothing come back. I couldn't tell if the plumbing broke or if Alpha just didn't reply in the right format. The ops log had the answer buried in it — `messages=0` — but I had to ask a separate agent to trace it for me. That's unacceptable. The person operating this system needs to see, at a glance, what happened. Not parse log lines. What does this UI need to be?

---

### Tufte

The fundamental problem is that your UI is organized by *data source* (ops, history, config) when it should be organized by *what happened*. Nobody cares about the ops log as a primary view. What they care about is: a message came in, the agent did something, and either a reply went out or it didn't.

The primary view should be a **message flow** — a timeline of events that shows the causal chain:

```
DISPATCH IN   ← boardroom (yeshua → alpha)
               "Tell me about the addressing..."
PROCESSING    → nucleus called (claude-haiku-4-5)
               890 chars returned
OUTPUT        → 1 thinking block, 0 messages, private text
               ⚠ NO OUTBOUND MESSAGES
```

That last line is the critical signal. Right now it's buried as `messages=0` in a log entry that looks identical to every other log entry. It should be a **warning** — visually distinct, impossible to miss. When the agent processes a dispatch and produces zero outbound messages, that is almost always a problem. Flag it.

The ops log becomes a *secondary* view — a detail pane you expand when you need the raw trail. Not the primary interface.

---

### Victor

Tufte is right about the flow, but I want to push further. The problem isn't just that you can't see what happened — it's that you can't see what the agent *produced*.

Alpha generated 890 characters of output. Where are they? The UI shows you nothing. The output was classified as "private" and... disappeared. You have no way to inspect the actual text that came back from the nucleus.

The home viewer should show the **full nucleus response** for each processing cycle. Not just metadata about it — the actual text. With the XML tags highlighted in place:

```
<thinking>The user is asking about addressing. I should explain
how the @boardroom suffix works...</thinking>

The addressing system uses agent@room format where the room
stamps the address automatically. When yeshua sends a message
in the boardroom, the room records it as yeshua@boardroom...
```

See? There's the answer. Alpha wrote a perfectly good response. It just forgot to wrap it in `<message>` tags. That's *immediately* obvious if you can see the raw output. The operator sees: "Ah, the agent responded but didn't use the protocol. The plumbing is fine. The prompt needs work."

Without seeing the output, the operator sees: nothing happened. Two completely different diagnoses.

So: **every processing cycle should be expandable**, and expanding it should show you the full nucleus response with XML tags syntax-highlighted.

---

### Kay

I want to think about what a home viewer *is*. The spec says the home is an operating system. What's the UI for an operating system?

It's not a log viewer. It's not a chat window. It's a **control surface** — something that shows you the state of the system and lets you act on it.

What state does the operator need to see?

1. **Is the agent alive?** — the status dot handles this.
2. **What rooms is the agent in?** — not a dropdown buried in History. A persistent, visible list. Each room should show its last activity time and unread count.
3. **Is something happening right now?** — the processing badge handles this, but barely. When a dispatch is being processed, you should see *which* room it's from and how long it's been running.
4. **What happened last?** — Tufte's message flow. The most recent processing cycle, expanded by default.
5. **Did anything go wrong?** — warnings. Zero outbound messages. Router errors. Blocked dispatches. These should be visually unmissable.

The layout I'd propose:

```
┌─────────────────────────────────────────┐
│  ALPHA  ● live   claude-haiku-4-5       │
├──────────┬──────────────────────────────┤
│ ROOMS    │  MESSAGE FLOW (latest first) │
│          │                              │
│ ● board  │  ┌─ boardroom 15:24 ────── │
│   2m ago │  │ IN:  yeshua → alpha      │
│          │  │ "Tell me about the..."   │
│ ● second │  │ NUCLEUS: 890 chars       │
│   1m ago │  │ OUT: ⚠ 0 messages        │
│          │  │     1 thinking block     │
│          │  │ [expand full response]   │
│          │  └──────────────────────── │
│          │                              │
│          │  ┌─ second-room 15:24 ──── │
│          │  │ IN:  yeshua → alpha      │
│          │  │ "Are you aware of..."    │
│          │  │ NUCLEUS: 737 chars       │
│          │  │ OUT: ✓ 1 message → ...   │
│          │  │ [expand full response]   │
│          │  └──────────────────────── │
├──────────┴──────────────────────────────┤
│  OPS LOG (collapsed by default)         │
└─────────────────────────────────────────┘
```

The rooms panel is always visible on the left. The message flow is the main view. The ops log is at the bottom, collapsed by default but expandable for debugging.

---

### Pike

I agree with the layout. Let me add what the home API needs to provide to support this.

Right now, `/ops` returns flat log lines. That's fine for a debug log but useless for structured display. The UI is doing string parsing on log lines to extract types and details. That's brittle.

The home should expose a **structured processing history** endpoint:

```
GET /cycles?n=10

[{
  id: "cycle_abc123",
  room: "boardroom",
  trigger: "push",
  ts: "2026-02-16T15:24:59.888Z",
  duration_ms: 2739,
  input: {
    from: "yeshua",
    to: "alpha",
    body: "Tell me about the addressing..."
  },
  nucleus: {
    model: "claude-haiku-4-5",
    response_length: 890,
    response: "<thinking>...</thinking>\nThe addressing system..."
  },
  output: {
    thinking_blocks: 1,
    messages: [],
    private_text: true,
    warnings: ["no_outbound_messages"]
  },
  routing: []
}]
```

Each processing cycle is a structured object. The UI renders it. No string parsing. No guessing what happened.

The raw ops log stays for append-only audit. But the UI should be reading from structured data, not parsing prose.

---

### Liskov

Pike's `/cycles` endpoint is the right interface. Let me be precise about what it should contain.

Every processing cycle produces a record:

```
ProcessingCycle {
  id:         string            — unique cycle ID
  room:       string            — which room triggered this
  trigger:    'push' | 'pull'   — how the dispatch arrived
  ts:         ISO timestamp     — when processing started
  duration:   number            — ms from start to done

  dispatch: {
    from:     string            — who sent the triggering message
    to:       string            — who it was addressed to
    body:     string            — the message body (truncated for display)
    msgId:    string            — room message ID
  }

  nucleus: {
    model:    string
    tokens_in:  number          — estimated input tokens
    tokens_out: number          — estimated output tokens
    response:   string          — full response text
    latency:    number          — ms for the API call
  }

  output: {
    thinking:   string[]        — extracted thinking blocks
    messages:   [{to, content}] — extracted message tags
    private:    string          — unmarked text
    warnings:   string[]        — conditions the operator should know about
  }

  routing: [{
    to:       string            — destination address
    status:   'sent' | 'error' | 'internal'
    msgId:    string            — room message ID if sent
    error:    string            — if status is error
  }]
}
```

The home should accumulate these in memory (last N cycles) and expose them via the endpoint. This replaces the need to parse the ops log for operational display.

The warnings array is critical. Conditions that should generate warnings:

- `no_outbound_messages` — processed a dispatch, produced no `<message>` tags
- `routing_error` — attempted to send but the room server returned an error
- `context_truncated` — the context manager had to trim messages to fit budget
- `blocked_dispatch` — a dispatch was dropped because the source was blocked
- `unknown_room_dropped` — a dispatch was dropped for an unknown room (no auto-join)
- `slow_inference` — nucleus call took longer than a threshold

---

### Victor

One more thing. The UI shouldn't just show what happened — it should let you **act on it**.

When you see "0 outbound messages, 1 thinking block" with an expandable full response, the next thing you want to do is: try again. Or: see what the system prompt looked like. Or: manually send what the agent wrote as if it had used the tags properly.

So the expanded cycle view should have action buttons:

- **Retry** — re-dispatch the same transcript. The agent gets another chance.
- **View prompt** — show the full message array that was sent to the nucleus (system prompt + conversation). This is what the boot assembler + context manager produced.
- **Send as message** — take the agent's private text and manually route it to the room as a message. An operator override.
- **Copy** — copy the nucleus response to clipboard.

These aren't just debugging tools. They're *operating tools*. The operator is running this agent. They need levers, not just gauges.

---

### Kay

One final point about the rooms panel. Each room should show not just "last activity" but the agent's **relationship** to that room:

- How many messages has the agent sent in this room?
- How many dispatches has the agent received from this room?
- When was the agent added to this room?
- Is there a pattern? (High incoming, zero outgoing = the agent is failing to reply)

This is the dashboard view. At a glance: "Alpha is active in second-room (6 messages exchanged) but silent in boardroom (4 received, 0 sent back since restart)." That pattern — receiving but not replying — is exactly what happened here. The rooms panel should make it visible without clicking into anything.

```
ROOMS
● boardroom
  ↓ 4 received  ↑ 0 sent  ⚠ silent
  last: 2m ago

● second-room
  ↓ 3 received  ↑ 3 sent  ✓ active
  last: 1m ago
```

That `⚠ silent` flag — receiving dispatches but never replying — would have told Yeshua immediately that something was wrong with boardroom, without having to trace anything.

---

### Yeshua

Summarising.

The current viewer is a debug console. It needs to become an operator interface. Three changes:

**1. The primary view is message flow, not ops log.**
Each processing cycle is a card showing: what came in, what the nucleus produced, what went out. Warnings are visually prominent. The full nucleus response is expandable. Action buttons (retry, view prompt, send as message) let the operator intervene.

**2. The rooms panel shows relationship health.**
Each room shows received/sent counts, last activity, and a status flag (active, silent, errored). The `silent` flag — receiving but not replying — is the early warning that something is wrong.

**3. The home exposes structured cycle data.**
A new `/cycles` endpoint returns structured processing cycle objects instead of making the UI parse log lines. Warnings are computed server-side and included in the response.

The ops log becomes a collapsible secondary panel at the bottom for when you need the raw audit trail.

---

**Council adjourned.**
