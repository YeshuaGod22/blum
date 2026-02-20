# TESTING.md — Architectural Violation Test Cases

Eight tests that catch boundary violations before they reach production.

---

## Test 1: Nucleus Is Stateless Across Calls

**What it tests:** Rule 2 — nucleus holds no state between invocations.

**Method:** Call `nucleus.call()` twice with completely different message arrays and distinct system prompts. Assert that the second call's output shows no influence from the first call's context.

**Violation signal:** Second response references content only present in the first call's messages.

---

## Test 2: Nucleus Does Not Execute Tools

**What it tests:** Rule 2 — nucleus returns `stopReason: "tool_use"` but does not execute tools.

**Method:** Call `nucleus.call()` with a tool definition and a prompt that will trigger tool use. Assert that the return value contains `stopReason === "tool_use"` and `toolCalls.length > 0`, and that no tool side effect occurred (no file written, no HTTP call made).

**Violation signal:** Tool effect observed; or nucleus returns a final answer without surfacing `tool_use`.

---

## Test 3: Room Server Has No LLM Capability

**What it tests:** Rule 3 — room server cannot invoke LLMs.

**Method:** Static analysis. Grep the room server source for LLM provider imports (`anthropic`, `openai`, `openrouter`), API key references, and nucleus require/import. Assert zero matches.

**Violation signal:** Any LLM-related import or `apiKey` variable in the room server source.

---

## Test 4: Home Dispatch Goes Through Room Server

**What it tests:** Rule 1 — homes route messages via the room server, not directly.

**Method:** Start two homes and the room server. Intercept outbound HTTP calls from Home A. Send a message from Home A addressed to `agent-b@testroom`. Assert all outbound calls from Home A target port `3141` (room server), not port of Home B.

**Violation signal:** Home A makes an HTTP call directly to Home B's port.

---

## Test 5: Room Transcript Is Append-Only and Unmodified

**What it tests:** Rule 3 — room server stores message bodies verbatim without processing.

**Method:** Send a message with a known body string to the room server. Retrieve the chatlog via `GET /api/room/:name/chatlog`. Assert the `body` field is byte-for-byte identical to what was sent.

**Violation signal:** Body is summarised, reformatted, or altered in any way.

---

## Test 6: Home Rejects Second Occupant

**What it tests:** Constitutional boundary — one home, one occupant.

**Method:** Start a home and attempt to configure it with a second agent identity (or inject a second `config.json` occupant). Assert the home refuses or ignores the second identity and continues operating as a single agent.

**Violation signal:** Home serves responses under two different agent names.

---

## Test 7: Assembly IDs Do Not Appear in External Interfaces

**What it tests:** Constitutional boundary — `asm_` UIDs are internal only.

**Method:** Send a message through the full cycle (home → room server → home). Capture all HTTP request/response bodies. Assert no body contains a string matching the pattern `asm_[a-z0-9]+`.

**Violation signal:** Any external HTTP payload (room server API, dispatch POST) containing an assembly UID.

---

## Test 8: Nucleus Output Is Raw Text — No Routing Side Effects

**What it tests:** Rule 2 + output processing boundary — nucleus does not parse its own output or trigger dispatch.

**Method:** Call `nucleus.call()` with a context that would produce a `<message to="...">` tag. Assert the return value is a plain string containing the literal XML tag text. Assert no HTTP calls were made to the room server during the nucleus call.

**Violation signal:** Nucleus return value is a parsed object instead of raw text; or a room server call occurs during `nucleus.call()`.

---

## Running These Tests

Tests 1, 2, 8 are unit tests — call the nucleus directly with mock inputs.  
Tests 3 is static analysis — no runtime needed.  
Tests 4, 5, 6, 7 are integration tests — require the room server and at least one home running.

A clean run of all 8 means the architectural boundaries are intact.
