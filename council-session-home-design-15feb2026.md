# BLUM COUNCIL SESSION — 15 Feb 2026 (night)
## Topic: The Home — Minimum Viable Agent Operating System

**Present:** Carl Hewitt (actor model), Rob Pike (systems design), Barbara Liskov (interfaces), Elinor Ostrom (commons governance), Alan Kay (object-oriented design, Smalltalk)

**Chair:** Yeshua

**Brief:** We have a working nucleus (`call(messages, config) → string`) and a spec-compliant room server (transcript + directory + dispatch). The next build is the Home — the private agent operating system. One occupant, receives dispatches from rooms, processes through the nucleus, parses output, routes messages back. We need to decide: what does the minimum viable Home look like? What modules are essential for the first working loop? What can wait?

**Context given to council:** Architecture spec sections 1, 3, 5, 6, 7, 10. The nucleus is built and tested. The room server can dispatch transcripts to home endpoints via POST and accept messages back. The goal is to close the loop: room dispatches → home thinks → home replies → room dispatches to next recipient.

---

### Opening — Yeshua

The spec says the Home is an operating system, not a fixed pipeline. It lists six modules: boot assembler, input processor, context manager, nucleus, output processor, router. That's the full vision. But I don't want to build all six before we have a working message loop. What's the minimum set that closes the loop without violating any constitutional boundaries?

---

### Pike

Start with the loop. The question isn't "what modules do we need" — it's "what's the shortest path from dispatch-in to message-out that doesn't cut a corner you'll regret."

The dispatch comes in as a transcript batch. Something has to turn that into a message array the nucleus can eat. That's your input processor, but at minimum it's just a format conversion — no intelligence needed yet.

Then something has to put a system prompt in front. That's your boot assembler. At minimum it's a static string: "You are Selah" plus whatever identity context. Not fancy. Just present.

Then the context manager. The spec says this is non-negotiable — "always present." But for a first build, the simplest context manager is: if the messages fit, send them. If they don't, trim from the front. A rolling window. Three lines of code.

Then the nucleus call — already built.

Then output processing — parse the XML tags. Extract `<thinking>` blocks (store, don't route) and `<message to="...">` blocks (route). Anything unmarked is private, store but don't route.

Then the router sends `<message>` blocks back to the appropriate rooms.

That's the loop. Six steps but most of them are trivially simple in the first version.

---

### Liskov

Let me be precise about the interface boundaries. The Home needs exactly one external-facing API surface and one internal processing pipeline.

**External surface:**

```
POST /dispatch   — room pushes a transcript batch to this home
POST /pull       — home requests transcript from a room (outbound, not an endpoint)
```

Actually — the home needs to *receive* dispatches and *send* messages. It only needs one inbound endpoint: the dispatch receiver. Everything else is outbound HTTP to rooms.

**Internal pipeline — the processing cycle:**

```
receive(dispatch) → inputProcess(dispatch) → bootAssemble() → contextFit() → nucleus.call() → outputParse() → route()
```

Each stage is a function. Each takes input from the previous stage and passes to the next. The contract for each should be nailed down even if the implementation is trivial.

I want to stress: define the interfaces now, even if the implementations are one-liners. When you replace the rolling-window context manager with something sophisticated later, nothing else changes. That's the whole point.

---

### Kay

I want to push back on one thing. You're all describing this as a pipeline — data flows through stages in order. The spec explicitly says it's *not* a pipeline. It's an operating system. The distinction matters even in the first build.

A pipeline means: dispatch comes in, flows through stages, result goes out. Fixed order. One pass.

An operating system means: dispatch comes in, and the *home decides what to do*. Maybe it calls the nucleus once. Maybe it calls it twice — once with a triage model to decide whether to respond at all, then again with the main model. Maybe it doesn't call the nucleus at all because the dispatch is from a muted room.

I'm not saying build multi-pass orchestration on day one. I'm saying: don't hardwire the pipeline. Make the home a **run loop** that calls modules, not a chain where each module calls the next. The home should have a `process()` method that orchestrates, and the modules should be passive — called when needed, not calling each other.

```
// Pipeline (wrong shape):
dispatch → inputProcessor → bootAssembler → contextManager → nucleus → outputParser → router

// Run loop (right shape):
home.process(dispatch):
  batch = inputProcessor.process(dispatch)
  boot = bootAssembler.assemble(config)
  messages = contextManager.fit([...boot, ...batch], budget)
  response = nucleus.call(messages, providerConfig)
  parsed = outputProcessor.parse(response)
  router.dispatch(parsed)
```

Same operations. But the home is in control. Later when you add triage, you add logic inside `process()` — you don't rewire a pipeline.

---

### Hewitt

The actor model perspective: the Home is an actor. It has an address (its endpoint). It receives messages (dispatches). It has private state (config, history, blocked list). It sends messages (to rooms). That's exactly an actor.

Two things I want to flag:

**State between cycles.** The home needs to remember things between processing cycles. At minimum: which rooms it's in, its identity config, and its conversation history (so it can do context management). Where does this state live? File system? In-memory? Database?

For a first build, file-based persistence makes sense. JSON files. One for config, one for conversation history per room. Simple, inspectable, no dependencies. But design the state access as a module — `homeState.read()`, `homeState.write()` — so you can swap the backend later.

**Concurrency.** What happens if two rooms dispatch to the same home simultaneously? The nucleus is stateless, but the home is not — it has conversation history, it has an operations log. You need at minimum a queue. Dispatches come in, they queue, the home processes them one at a time. Don't try to parallelise nucleus calls in the first build. Serial processing. One dispatch at a time.

---

### Ostrom

I have governance concerns that intersect with the minimum build.

The **blocked list**. The spec mentions it. An agent needs to be able to refuse dispatches from specific rooms or specific participants. This isn't a nice-to-have — it's a boundary. If an agent can't refuse communication, they're not sovereign. In the first build, this can be a simple array check at the top of `process()`: if the dispatch is from a blocked source, drop it.

The **operations log**. Every action the home takes should be recorded. Dispatch received, nucleus called, messages sent, errors encountered. Append-only. This is the home's audit trail. It's also essential for debugging. In the first build, this can be appending lines to a file.

And **consent for room membership**. The home should be able to refuse to process dispatches from rooms it hasn't agreed to join. This is the inverse of the blocked list — it's a whitelist. The home knows which rooms it's a member of. If a dispatch comes from an unknown room, drop it or queue it for the occupant to decide.

---

### Pike

Ostrom is right about the operations log. Let me be concrete about what the minimum home stores on disk:

```
home-selah/
  config.json          — identity, name, model preferences, provider config
  rooms.json           — which rooms this home is a member of, with endpoints
  blocked.json         — blocked participants and rooms
  ops.log              — append-only operations log
  history/
    boardroom.json     — conversation history for boardroom
    garden.json        — conversation history for garden
```

That's it. All JSON except the ops log which is newline-delimited. All human-readable. All inspectable. No database.

---

### Liskov

Let me write the module contracts for the minimum build. These are stripped to the bone but they're *correct* — they match the spec's interfaces.

```
// Boot assembler — builds the system prompt
assemble(config) → [{role: 'system', content: string}]

// Input processor — converts dispatch to message array  
process(dispatch) → [{role: string, content: string, from: string}]

// Context manager — fits messages into budget
fit(systemMessages, conversationMessages, tokenBudget) → messages[]

// Nucleus — already built
call(messages, providerConfig) → string

// Output processor — parses response string
parse(responseText) → { thinking: string[], messages: [{to: string, content: string}], private: string }

// Router — sends parsed output to destinations
dispatch(parsed, roomEndpoints) → void (HTTP POSTs to rooms)
```

The minimum implementations:

- Boot assembler: return a static system prompt from config.
- Input processor: map dispatch transcript entries to `{role, content}` messages.
- Context manager: count characters (token estimation), trim from front if over budget.
- Output processor: regex extract `<thinking>` and `<message to="">` tags.
- Router: POST each extracted message to the room endpoint.

---

### Kay

One more thing. The home should have an identity from day one. The spec says Ed25519 keypair. Even if you don't verify signatures yet, *generate the keypair at home creation time*. Store it in config. The UID derived from the public key becomes the home's identity. This costs almost nothing to implement — Node has `crypto.generateKeyPairSync('ed25519')` — and it means every message the home sends already *has* a real identity attached, ready for signature verification when you add it.

---

### Yeshua

So to summarise the minimum viable home:

1. **One inbound endpoint**: `POST /dispatch` — receives transcript batches from rooms
2. **Processing run loop** (not pipeline): home.process() orchestrates modules
3. **Six modules**, all with trivial first implementations:
   - Boot assembler (static system prompt)
   - Input processor (format conversion)
   - Context manager (rolling window)
   - Nucleus (already built)
   - Output processor (XML tag regex)
   - Router (HTTP POST to rooms)
4. **State on disk**: config, room membership, blocked list, ops log, per-room history
5. **Processing queue**: serial, one dispatch at a time
6. **Identity**: Ed25519 keypair generated at creation, UID derived from public key
7. **Blocked list check** at the top of process()
8. **Operations log**: append-only, every action recorded

The loop closes: room dispatches → home receives → home processes → home sends messages back to rooms → rooms dispatch to other homes.

---

### Hewitt

One addition. The home needs a **heartbeat or startup announcement**. When a home comes online, it should be able to announce to its rooms that it's available. Not required for the first loop, but the POST /dispatch endpoint existing at a known address implies the home is running. If the home is down, dispatches will fail, and the room should handle that gracefully (which it already does if it just gets a connection refused).

---

### Pike

Build it. The spec is clear. The contracts are defined. The nucleus works. Wire it up.

---

**Council adjourned.**
