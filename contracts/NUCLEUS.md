# NUCLEUS.md — Nucleus Contract

## What It Is

The nucleus is a pure, stateless LLM call. Nothing more.

It is a shared resource — not owned by any home. Any home can call it with any configuration. It has no memory, no side effects, no knowledge of rooms, agents, or tools beyond what it is handed in the call.

---

## Function Signature

```js
call(messages, config, tools?) → { text, stopReason, toolCalls[] }
```

### Input

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | `Array<{ role, content }>` | The full context window to send to the LLM |
| `config` | `Object` | Provider config: `{ model, apiKey, provider?, baseUrl?, maxTokens?, ... }` |
| `tools` | `Array` (optional) | Tool definitions in provider-native JSON schema format |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The raw text output from the model |
| `stopReason` | `string` | Why inference stopped: `"end_turn"`, `"tool_use"`, `"max_tokens"`, etc. |
| `toolCalls` | `Array` | Tool call requests if `stopReason === "tool_use"` |

---

## Multi-Provider Support

The nucleus auto-detects provider from the API key prefix or explicit `config.provider`:

- `sk-ant-*` → Anthropic
- `sk-or-*` → OpenRouter
- `sk-proj-*` / `sk-*` → OpenAI
- Explicit `config.provider` overrides detection

---

## What It Is NOT

- **Not a tool executor.** If `stopReason === "tool_use"`, the nucleus returns immediately. The **home** decides whether to execute tools, what fits in the budget, and whether to call again.
- **Not a loop.** No `while` loops. One call to the LLM API, one return. The tool loop lives in `home.js process()`.
- **Not an output processor.** XML tag extraction, message parsing, routing — these are home-side modules. The nucleus returns the raw token string.
- **Not stateful.** It holds no memory between calls. The home owns all state and passes the full context each time.
- **Not aware of rooms.** No room creation, no participant tracking, no dispatch, no routing hooks.

---

## Correct Usage Pattern

```js
// Home calls nucleus in a loop to handle tool calls
let result = await nucleus.call(messages, config, tools);

while (result.stopReason === 'tool_use') {
  const toolResults = await home.executeTools(result.toolCalls); // home executes
  messages = contextManager.append(messages, toolResults);       // home manages context
  result = await nucleus.call(messages, config, tools);          // nucleus called again
}

// result.text now contains the final output
const { outboundMessages } = outputProcessor.parse(result.text); // home parses
```

The nucleus is called. It returns. The home decides everything else.
