# BOUNDARIES.md — Architectural Boundaries

> **This is the most important file in this directory.**  
> Read it before writing a single line of code.

---

## Rule 1: Homes Never Contact Each Other Directly

**Homes communicate only through rooms.**

When an agent's output contains `<message to="lens@boardroom">`, the home sends that message to the **room server**, which dispatches the room chatlog to Lens's home. The home never opens a connection to another home.

### Why It Exists

Rooms are the audit trail. Every message that passes through a room is logged, timestamped, and attributed. If homes talked directly, there would be no chatlog, no traceability, no way to replay or debug what happened. The room is also the coordination point — it serialises concurrent messages and manages participant state.

### What Breaks If Violated

- **No chatlog.** The communication becomes invisible and untraceable.
- **No participant state.** Block lists, membership, pinned messages — all meaningless.
- **Tight coupling.** Home A now needs to know Home B's port and address. Any topology change breaks everything.
- **Race conditions.** Two homes contacting each other simultaneously without a serialising intermediary is a concurrency nightmare.

### How to Detect Violation

- Any `fetch()` or `http.request()` inside a home that targets another home's port (e.g. `localhost:4121` from within home `eiran`)
- Any message routing logic that bypasses `POST /api/message/send` on the room server
- Direct home-to-home HTTP calls in the router module

---

## Rule 2: Nucleus Is Stateless — Home Owns All State

**The nucleus receives the full context each call and returns a response. It remembers nothing.**

The nucleus signature is `call(messages, config, tools?) → { text, stopReason, toolCalls[] }`. Every piece of state — conversation history, tool results, context window — is assembled by the home and passed in. The nucleus closes with no side effects.

### Why It Exists

Statefulness in the nucleus would make it impossible to share across homes, swap providers mid-conversation, or call it multiple times with different configurations in a single cycle. A pure function is composable, testable, and replaceable. The home's ability to manage context (rolling window, token budgets) depends entirely on the nucleus being stateless — the home controls what goes in.

### What Breaks If Violated

- **Cross-home contamination.** If the nucleus holds state, Home A's conversation bleeds into Home B's.
- **Untestable.** A stateful nucleus can't be tested with simple input/output assertions.
- **Unswappable.** Can't hot-swap providers or models mid-conversation.
- **Tool loop breaks.** If the nucleus loops internally, the home loses control over context management between tool calls.

### How to Detect Violation

- Any module-level variable in `nucleus.js` that accumulates values across calls
- Any `while` loop inside `nucleus.call()`
- Any tool execution inside the nucleus
- Nucleus importing or requiring home-specific modules (history, config)

---

## Rule 3: Room Server Never Invokes LLMs

**The room server stores messages and dispatches chatlogs. It does not think.**

The room server has no `model`, no `apiKey`, no inference capability. Its only intelligence is routing: look up the recipient's endpoint in the directory, POST the room chatlog.

### Why It Exists

A room server that infers or interprets becomes a single point of failure and a hidden intelligence layer. Its behaviour becomes unpredictable, its costs unbounded, and its responsibility unclear. The room must be transparent — what goes in comes out unchanged. This is what makes chatlogs trustworthy.

### What Breaks If Violated

- **Hidden processing.** Messages arriving at a home may have been silently modified or filtered.
- **Unpredictable latency.** LLM calls are slow. Dispatch becomes non-deterministic.
- **Unbounded cost.** Every message passing through the room triggers an LLM call.
- **Architectural confusion.** The room is no longer a passive relay — it becomes an agent, blurring the home/room boundary.

### How to Detect Violation

- Any `apiKey`, `model`, or LLM provider import in `blum-room-server-*.js`
- Any call to the nucleus from within the room server
- Room server endpoints that return generated or summarised content

---

## Predecessor Failures (Why These Rules Exist)

These rules were written in blood. Blum's predecessor **Bloom** violated all three:

- **Bloom put rooms inside homes** — every agent managed its own room state. When two agents shared a room, their state diverged. No single source of truth.
- **Bloom's nucleus had a tool loop** — the LLM would loop internally, making context management impossible and token costs unpredictable.
- **Bloom had direct agent-to-agent calls** — cascading failures when any agent went down; no chatlog of what was said; impossible to replay conversations.

Blum's architecture is a direct response to these failures. Every boundary exists because violating it caused real problems.

---

## Quick Reference

| Rule | Violation Signal | Consequence |
|------|-----------------|-------------|
| Homes via rooms only | Home-to-home HTTP call | No chatlog, tight coupling |
| Nucleus stateless | State in nucleus, loop in nucleus | Cross-home contamination, broken tool control |
| Room never infers | LLM call in room server | Hidden processing, unbounded cost |
