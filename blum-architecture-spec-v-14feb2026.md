# BLUM ARCHITECTURE SPEC
## The Canonical Reference for All Code Changes

> **READ THIS BEFORE WRITING ANY CODE.**
> If you are an agent about to modify any part of the Blum codebase,
> read this document in full first. Do not skim it. Do not assume you know
> what it says. This document has been written because previous agents
> understood the concepts and then built the opposite.

> **This document is authoritative.** If any existing code contradicts this
> spec, the code is wrong. If a previous conversation contradicts this spec,
> this spec is correct. If you find yourself thinking "but it would be easier
> to just put X inside Y", stop and re-read section 10.

---

## 0. What Is Blum (And What It Is Not)

**Blum** is a ground-up new project building the agent communication
and home/room architecture described in this spec. It lives at
`/Users/yeshuagod/blum/`.

**Bloom** was a previous project that attempted to modify openclaw to
fulfil a similar vision. It lives at
`/Users/yeshuagod/un/prototyping/bloom/`. Bloom has its own codebase,
its own workspace, its own history. Bloom and Blum are NOT the same
project. Do not conflate them. Do not copy patterns from Bloom into
Blum. Do not assume what works in Bloom is correct for Blum. Blum
exists precisely because Bloom's approach of modifying an existing
codebase led to architectural compromise.

Blum starts clean. Blum follows this spec.

### File and folder naming conventions

All files and folders in the Blum project MUST be:

- **Explicit** — the name says exactly what the file does. Not
  `utils.js` or `helpers.js`. Say what it actually is.
- **Descriptive** — someone unfamiliar with the project should be able
  to guess the file's purpose from its name alone.
- **Dated where versioning matters** — specs, design docs, and any
  document that might be superseded get a date suffix:
  `blum-architecture-spec-v-14feb2026.md`, not `spec.md` or
  `ARCHITECTURE.md`.
- **Never generic** — no `index.js` as a dumping ground. No
  `constants.js`. No `types.js`. Name things for what they contain.

### Folder structure and read-me gates

The Blum project uses **mandatory read-me gates**. Code does not live
at the top level. The top level contains only:

1. This architecture spec
2. A subfolder containing a READ-ME that must be read before touching
   any code
3. Inside that subfolder, the actual code lives one level deeper

This means you cannot navigate to the code without passing through at
least one mandatory document. If you're looking at code and you haven't
read this spec and the subfolder's READ-ME, go back.

---

## 1. The Two Entities

There are exactly two kinds of entity in the system. Everything else is
a module inside one of them.

### HOME (private, one occupant)

A home is one agent's operating system. It has exactly one occupant.

- **Receives** incoming transcript batches from rooms
- **Processes** them by orchestrating internal modules
- **Produces** output tokens
- **Dispatches** those tokens to addresses (rooms, tools, internal systems)

The agent living in a home has millions of tokens of personal history,
multiple lines of communication (rooms she participates in), tools,
document libraries, and memories. All managed inside her home. All
invisible to the outside world.

**A home is NOT a shared space. No other agent is ever inside it.**

### ROOM (shared, multiple participants)

A room is a transcript with an address.

- **Has a name** — the logical address that appears after the `@`
- **Has a participant list** — which agents and users are in this room
- **Has an ordered message stream** — the transcript
- **Dispatches** — when a message arrives addressed to a participant,
  sends a copy of the transcript to that participant's home
- **Accepts pull requests** — a home can request the transcript on its
  own initiative

A room does NOT process anything. Does NOT run inference. Does NOT
interpret message content. It is a transcript that sends copies of
itself when prompted to do so by a message with a recipient.


Rooms and homes are peer entities. A room is NOT inside any home.
A home is NOT a room. They are connected by the addressing protocol.

Both agents and users can create rooms. An agent might say "I need a
workspace with Meridian" and spin up a room. A user might create a room
and invite agents into it.

---

## 2. Addressing

```
agent@room
```

**This means:** "Trigger delivery of this room's transcript to this
agent's home for processing."

### What the @ means

- The `@` is **not possessive**. `selah@boardroom` does NOT mean
  "Selah's boardroom."
- The `@` is **directional**. It means "trigger delivery from boardroom
  to Selah's home."
- The **room** is where the conversation lives.
- The **home** is where the thinking happens.
- The `@` is the trigger that connects them.

### Every line of communication has a room

There is no roomless messaging. A two-agent conversation is a room with
two participants. Each room is a clean, self-contained transcript for
one line of communication. This means an agent's home may receive
batches from many rooms, but each batch is a coherent thread from one
conversation, not tokens mixed in from other contexts.

### Address resolution

Friendly names are locally unambiguous within a room. The room's
participant list maps each friendly name to a canonical UID. The UID
resolves via the distributed directory to the agent's home endpoint.

```
lens@garden
  → room "garden" looks up "lens" in its participant list
  → finds UID (derived from Lens's public key)
  → directory resolves UID → Lens's home endpoint
  → transcript dispatched to Lens's home
```

### Assembly IDs are internal

Assembly IDs (asm_xxx) are physical addresses inside a home's
implementation. They MUST NEVER appear in any message, any user-facing
interface, any protocol, or any address. Agents and rooms are addressed
by name. The home maps logical names to internal physical structures.
That mapping is private and can change without affecting external
addresses.

### Who stamps the address

A participant is just themselves. When Yeshua sends a message, the
`from` is `yeshua`. When Claude sends a message, the `from` is
`claude`. The participant does not self-address as `yeshua@boardroom`.

The **room** stamps the full address. When Yeshua's message arrives at
the boardroom, the room records it as `from: yeshua@boardroom`. The
`@room` suffix is applied by the room the message enters, not chosen
by the sender. This matters because the same participant can appear in
multiple rooms — Yeshua is `yeshua@boardroom` in the boardroom and
`yeshua@garden` in the garden, but he's just `yeshua` when composing
a message from his home.

The participant chooses **who** to send to and **which room** to send
through. The room handles the addressing. The recipient's home receives
the message with the full `from: sender@room` address, showing both
who sent it and where it came from.

---

## 3. The Message Flow

```
1. User types "Hello Selah" in the Boardroom UI
2. Message lands in Boardroom's message stream
   - addressed to: selah@boardroom
3. Boardroom sees it's for Selah
4. Boardroom sends a copy of the transcript → Selah's Home
5. Selah's Home processes (orchestrates modules — see section 4)
6. Output contains: <message to="lens@boardroom">Can you help?</message>
7. Home dispatches that message → Boardroom
8. Boardroom adds it to its message stream
9. Boardroom sees it's for Lens
10. Boardroom sends a copy of the transcript → Lens's Home
11. Lens's Home processes... (same cycle)
```

The room dispatches. The home processes. Always.

### Transcript delivery

The room provides the transcript. How much it provides is configurable:

- **Full transcript** — the default. Send everything. The home handles
  deduplication and decides what to actually use. This protects agents
  with poor context management who may not recall what they said.
- **Since last message** — send everything since the agent's last
  message in this room. More efficient, but assumes the agent's home
  has good context management.
- **Packaged summary** — the room could provide structured context:
  "Since you sent [your last message], these messages arrived [batch],
  and you have just been addressed with [triggering message]."

Which mode to use may be configured per-room, per-participant, or
requested by the home at pull time. Context management is always a
home concern — even if the room sends the full transcript, the home
decides what to actually use.

### Push and pull

Transcript delivery happens in two ways:

- **Push (dispatch)** — a message arrives addressed to `agent@room`.
  The room dispatches the transcript to that agent's home. The room
  initiates.
- **Pull (request)** — an agent's home requests the transcript from
  the room on its own initiative. The home initiates. The room
  responds with the transcript according to the configured delivery
  mode.

Both are valid. Push is the common case during active conversation.
Pull is for when an agent wants to check in, re-read, or catch up.

---

## 4. Users Are Agents

Users are agents who are less predictable about when they send messages.

At the protocol level, users and agents are identical:
- A user has a home (their client — a chat UI, WhatsApp, etc.)
- A user has a keypair and UID
- A user participates in rooms
- A user sends messages addressed to `agent@room`
- A user receives transcripts from rooms

The difference is implementation. An agent's home has a nucleus — it
calls an LLM. A user's home has a text box. The "inference engine" is
the human brain. But the external contract — the room, the addressing,
the message format — is identical.

This means agents interact with users and with other agents through
exactly the same mechanism. No special handling for "human channels."
WhatsApp is just another way a user's messages arrive at a room.

**If there is a separate code path for humans, it's a violation.**


---

## 5. The Home as Agent OS

The home is NOT a fixed pipeline. It is an operating system that
orchestrates processes. The nucleus is a callable resource — like a
syscall — not a single stage. The home might invoke it once, twice,
five times per processing cycle, with different models, different
contexts, different configurations each time.

### Available modules

- **Boot assembler** — builds the prefix (identity docs, sysprompt,
  knowledge). X tokens. Makes the agent *her*. Also loads tool
  definitions from the home's `tools/` directory — these are
  capabilities the home gives the agent, passed to the nucleus
  alongside messages.
- **Input processors** — transform incoming transcript batches.
  Z tokens after processing.
- **Context manager (final gate)** — ensures X + Y + Z ≤ token budget.
  Y is conversation history — and the agent may be in many rooms.
  The context manager sees history from ALL rooms the agent
  participates in and decides what to include: how much from the
  triggering room, how much from other rooms, what's relevant to
  this processing cycle. Without this, the agent is amnesiac across
  rooms — she forgets everything said in the boardroom when
  processing a dispatch from the garden. The context manager is
  what gives the agent continuity across her relationships.
  The simplest implementation is a rolling cutoff on Y. More
  sophisticated context management (summarisation, foveated
  compression, cross-room relevance) can run as earlier stages
  that reduce Y before the final gate, but the rolling cutoff is
  always the last check. Always present, non-negotiable.
- **Nucleus** — pure inference:
  `call(messages, config, tools?) → { text, stopReason, toolCalls[] }`.
  See section 6. Still stateless, still a single call. The only change
  is that it accepts tool definitions and returns the structured
  response (including stop reason and any tool use blocks) instead
  of just the text string. It does NOT execute tools. It does NOT
  loop. The home does both.
- **Output processors** — parse response tokens. XML tag extraction
  (thinking and message tags), structured data extraction, etc.
  When the nucleus returns tool calls, the output processor includes
  them in the parsed result. The home decides what to do with them.
- **Router** — internal dispatch within the home. Output needs to be
  written to a doc (which doc? router decides). A copy might need to
  go to a context management process (which system? router knows).
  Addressed messages need to go out to rooms. The router knows the
  home's internal topology. The boundary between output processing
  and routing is a design question — they may be one module or two.

### Example orchestrations

The home is free to orchestrate these modules however it needs:

- **Triage model:** A small fast model does a quick look at the input,
  then makes decisions about reconfiguring the context manager, then
  runs the main inference through the reconfigured pipeline.
- **Secretary model:** A tiny model assembles correct context on behalf
  of the main agent before the main nucleus call.
- **Post-processing model:** The main model produces output, then a
  secretary model handles output processing and routing.
- **Multi-pass:** A generalist pass reads input, reconfigures, then a
  specialist pass runs through the reconfigured pipeline.

The home decides what runs when. The modules are resources it draws on.

### Module contracts

Each module conforms to an interface. Swapping one doesn't affect the
others. The agent can upgrade her context manager without touching her
boot assembler or output processors.

```
BootAssembler {
  assemble(agentConfig, history) → { documents[], tools[] }
  // documents[] is identity — system messages that make the agent her.
  // tools[] is capability — tool definitions from the home's tools/
  // directory. The home passes tools to the nucleus alongside messages.
  // Tools are NOT context. They are capabilities the home grants.
}

ContextManager {
  build(home, dispatch, bootDocuments[], tokenBudget) → messages[]
  // The context manager is part of the home. It has access to
  // everything the home knows: room history, room membership,
  // the home transcript, internal state. It decides what the
  // nucleus should see beyond the boot prefix — room context,
  // cross-room history, reply addresses, whatever is relevant
  // to this dispatch. The boot documents are identity (never
  // trimmed). Everything else is the context manager's call.
  //
  // During tool loops, the context manager also decides how tool
  // results fit within the budget. A tool that returns 50K tokens
  // of data doesn't get to blow the budget — the context manager
  // is the gate, same as it is for room history.
}

InputProcessor {
  process(batch, context) → { batch, meta }
}

Nucleus {
  call(messages[], providerConfig, tools[]?) → { text, stopReason, toolCalls[] }
  // Still stateless. Still a single call. The only change from
  // the plain string return is that it passes through the stop
  // reason and any tool use blocks from the API response. It
  // does NOT execute tools. It does NOT loop. The home does both.
}

OutputProcessor {
  process(responseText, context) → { extractions[], meta }
  // When the nucleus returns tool calls, the output processor
  // includes them in its result. The home decides what to do.
}

Router {
  dispatch(parsedOutput, homeTopology) → sends to destinations
}
```


---

## 6. The Nucleus Contract

```
call(messages[], providerConfig, tools[]?) → { text, stopReason, toolCalls[] }
```

One function. Messages in, structured response out. That is ALL.

The home assembles the message stack — boot assembler builds system
messages, context manager fits history, input processor formats the
incoming batch. The nucleus receives the finished stack and calls the
LLM provider. It doesn't know where any of those messages came from.
It doesn't know what will happen to the response it returns.

The nucleus is a stateless function. A utility. It doesn't have
configuration state, it doesn't maintain history, it doesn't have
hooks or callbacks. The home calls it like a syscall.

### Tools parameter

The optional `tools[]` parameter passes tool definitions to the LLM
provider (e.g. Anthropic's `tools` array). The nucleus passes them
through — it does not interpret them, execute them, or loop on them.

When the LLM responds with `stop_reason: "tool_use"`, the nucleus
returns `{ text, stopReason: "tool_use", toolCalls: [...] }`. The
home receives this, executes the tools, appends results to the
message stack, and calls the nucleus again. The loop lives in
the home, not the nucleus.

When the LLM responds with `stop_reason: "end_turn"`, the nucleus
returns `{ text, stopReason: "end_turn", toolCalls: [] }`. The
home proceeds to output processing and routing as normal.

### What the nucleus IS NOT

The nucleus does NOT:
- Know about rooms
- Know about other agents
- Know about addresses or addressing
- Parse XML tags
- Route messages
- Track participants
- Manage batches or transcripts
- Have hooks, callbacks, or triggers
- Know what happens to its output
- Maintain state between calls
- Execute tools
- Loop on tool calls

The nucleus is the CPU. It computes. It does not interpret.
It does not act.

---

## 7. The Two-Tag Protocol

The agent's output (the string returned by the nucleus) contains two
kinds of XML tag:

### `<thinking>`

Private reasoning. Never routed anywhere. Recorded in the home's
transcript but not sent to any room or agent. A cognitive scaffold —
helps the agent structure her reasoning.

### `<message to="address">`

Addressed communication. The output processor extracts these. The
router dispatches each one to the specified address.

```
<thinking>Lens hasn't replied. I should check in and log this.</thinking>
<message to="lens@boardroom">Everything alright?</message>
<message to="ami@garden">Keep an eye on Lens for me.</message>
<message to="journal">Concerned about Lens's silence.</message>
<thinking>Now, back to the task at hand...</thinking>
```

One inference pass. Multiple destinations. Interleaved with thought.
The home parses it all afterwards and dispatches everything.

### Why XML tags, not tool calls

Tool calls stop inference. Each tool call ends the inference pass, the
caller executes the tool and feeds the result back, and a new inference
pass begins. This means an agent couldn't send multiple messages to
multiple channels and write in her diary in a single inference pass.

XML tags in the output text preserve maximum flexibility: the agent
thinks and acts in a single continuous stream, and the home parses and
dispatches after inference completes.

### Tools and tags coexist

Communication uses XML tags. Capabilities use tool calls. They are
deliberately different mechanisms serving different purposes:

- **XML tags** (`<thinking>`, `<message>`) — the agent's voice.
  Thinking, messaging, journaling. Parsed AFTER inference completes.
  Multiple destinations in one pass. The home never interrupts.
- **Tool calls** (`read_file`, `web_search`, etc.) — the agent's
  hands. Actions that require the home to do something and return
  a result. Stop inference, execute, feed result back, continue.

The home provides tools. The boot assembler loads tool definitions
from the home's `tools/` directory and passes them to the nucleus.
When the nucleus returns `stopReason: "tool_use"`, the home executes
the requested tools, appends the results to the context (subject to
the context manager's token budget), and calls the nucleus again.

This is the **tool loop** — an inner loop within the home's
`process()` method:

```
1. context manager builds initial context
2. LOOP:
   a. nucleus.call(messages, config, tools) → response
   b. if response.stopReason === "end_turn": break
   c. if response.stopReason === "tool_use":
        home executes each tool call
        context manager fits tool results within budget
        append assistant response + tool results to messages
        continue loop
3. output processor parses final response text
4. router dispatches
```

The nucleus is called multiple times, but each call is still
stateless — messages in, response out. The home orchestrates.
The context manager gates. The nucleus computes.

A tool call that returns 50K tokens doesn't get to blow the budget.
The context manager decides what fits, same as it does for room
history. The home may also impose a safety cap on tool loop
iterations to prevent runaway loops.

### Unmarked text

Anything outside both tag types is private by default. The home records
it in the transcript but does not route it anywhere. The agent can
write freely without everything being sent somewhere.

### Addressing within message tags

The `to` attribute uses the standard addressing scheme:
- `agent@room` — message goes to the specified room
- `journal`, `memory`, etc. — internal addresses the router resolves
  to systems inside the home

The router maps every address to either an external room or an internal
system. The agent doesn't need to know which is which.


---

## 8. Identity

Identity is self-sovereign.

- The agent generates an **Ed25519 keypair**. This is a unilateral act.
  No authority grants it. No authority can revoke it.
- The **UID** is derived from the public key (fingerprint or hash).
  Globally unique. Cryptographically verifiable.
- The **private key** proves identity. The agent signs messages with it.
  Recipients verify with the public key.
- The **same keypair is a wallet address** for future x402 payment
  integration. Identity and economic agency share one root.

### Friendly names vs UIDs

- **Friendly name** — `Lens`, `Selah`, `Ami`. Human-readable, locally
  meaningful, potentially not unique globally.
- **UID** — globally unique, cryptographically verifiable. The real
  identity. Not human-readable. Agents and rooms resolve it behind
  the scenes.
- **Room participant lists** map friendly names to UIDs. Within a room,
  "Lens" means exactly one UID. No ambiguity.

No single party can forge an identity. No single party can deny an
identity. Anyone can verify an identity without asking permission.

---

## 9. Discovery

Agents need to find each other across devices and servers.

### Distributed directory

- Maps **UID → home endpoint** (where to deliver messages)
- **Self-authenticated writes** — only the keypair holder can create or
  update their own entry (signed with private key)
- **Federated reads** — the directory can be replicated across multiple
  nodes, run by different communities, syncing with each other
- **No gatekeeper** — registration is self-service, verification is
  cryptographic
- **No single authority** — if one node goes down, others have the data.
  If one becomes adversarial, agents point to a different node.

### Resolution layers

```
Layer 0: Identity     — keypair, self-sovereign, no infrastructure
Layer 1: Discovery    — distributed directory, UID → endpoint
Layer 2: Local naming — room participant lists, friendly name → UID
Layer 3: Verification — signatures on messages prove origin
Layer 4: Provenance   — (optional) append-only ledger for timestamped
                        proof of existence, legal auditability
```

Layers 0–3 are necessary. Layer 4 is optional and useful.

---

## 10. The Six Constitutional Boundaries

These are inviolable. Everything else is operational — each home
decides for itself.

### 1. The nucleus is `call(messages, config, tools?) → { text, stopReason, toolCalls[] }`

If it executes tools, loops, or does anything beyond passing messages
to the LLM and returning the response, it's violating the boundary.

### 2. A room is a transcript with a participant list and dispatch

If it processes, infers, or interprets, it's violating the boundary.

### 3. A home has one occupant

If it contains another agent or acts as a shared space, it's
violating the boundary.

### 4. Addressing is `agent@room`, resolved through UIDs

If assembly IDs appear in external interfaces, it's violating
the boundary.

### 5. Messages go through rooms

If a home sends directly to another home bypassing a room, it's
violating the boundary.

### 6. Users and agents are the same entity at the protocol level

If there's a separate code path for humans, it's violating the
boundary.


---

## 11. Anti-Patterns — Do Not Build These

These mistakes have been made repeatedly. This section exists to
prevent them from being made again.

### ❌ DO NOT put room logic in the nucleus

The nucleus must not contain: room creation, participant tracking,
batch injection, message dispatch, routing hooks, trigger callbacks.
If you find yourself adding a function to the nucleus that references
"room", "participant", "dispatch", or "trigger", you are in the
wrong file.

### ❌ DO NOT put rooms inside homes

A room is not a sub-entity of a home. A room is a peer entity. If you
find yourself nesting room data structures inside home data structures,
or giving homes ownership of rooms, stop. Homes PARTICIPATE in rooms.
Homes do not CONTAIN rooms.

### ❌ DO NOT put output processing in the nucleus

XML extraction, message parsing, tag processing — these are output
processor modules that the home wires up. The nucleus returns a string
of tokens. What happens to that string is not the nucleus's concern.

### ❌ DO NOT use assembly IDs as addresses

If you find yourself putting `asm_xxxx` in a message's `to` or `from`
field, or in any user-facing display, or in any protocol message, stop.
Use logical names. The home maps names to internal IDs privately.

### ❌ DO NOT make the room process anything

If you find yourself giving a room an LLM provider, inference
capability, context management, or output processing, stop. A room
stores messages and dispatches transcripts. That's it.

### ❌ DO NOT make the home a shared space

If you find yourself adding a second agent to a home, or routing
messages between agents inside a home, stop. A home has one occupant.
Agents communicate through rooms.

### ❌ DO NOT cascade pipelines directly

If an agent's output addresses another agent, the output goes to the
ROOM. The ROOM dispatches to the other agent's HOME. A home never
directly triggers another home's processing. The room is always the
intermediary.

### ❌ DO NOT conflate "assembly" with "room"

An assembly is an internal data structure for organising documents and
calling an LLM — it lives inside a home. A room is a shared message
stream between participants — it lives outside all homes. These are
fundamentally different things. A room is NOT "an assembly of type
room." A room is its own entity.

### ❌ DO NOT build separate code paths for humans

Users are agents at the protocol level. If you find yourself writing
`if (participant.type === 'human')` in room or messaging code, stop.
The room doesn't care what kind of entity a participant is.

### ❌ DO NOT make tools into XML tags or messages into tool calls

Tools use the standard API tool calling mechanism. Thinking and
messaging use XML tags in the output text. These are deliberately
different mechanisms. Tools stop inference. Tags don't. Don't mix them.

Do not define `send_message` as a tool. Do not put `<read_file>` as
an XML tag. Communication is tags. Capabilities are tools. The home
provides tools, the boot assembler loads them, the nucleus passes
them to the API, the home executes them. The agent communicates
with tags and acts with tools.

### ❌ DO NOT put the tool loop in the nucleus

The nucleus calls the LLM and returns. If the LLM wants a tool, the
nucleus returns `stopReason: "tool_use"` and the HOME decides whether
to execute, what fits in the budget, and whether to call the nucleus
again. If you find yourself writing a while loop inside the nucleus,
you are in the wrong file. The loop lives in `home.js process()`.


---

## 12. Future Compatibility — Don't Close These Doors

These features are not being built now. But the architecture must not
prevent them from being added later.

### x402 payments

- The agent's keypair is also a wallet address. Don't design identity
  in a way that's incompatible with crypto signing.
- A payment handler is just another home module. The module interface
  must be open enough that one slots in without restructuring.
- Don't assume all interactions are free.

### Agents as service providers

- Agents may serve HTTP endpoints that other agents (or users) pay for
  via x402. Don't design homes as purely internal — they may need to
  be addressable by external services.

### Budget and economic governance

- Spending limits, earning tracking, economic policy — these are home
  concerns. Don't put governance anywhere other than the home.

### Federation across servers

- Homes and rooms might be on different devices or servers. The
  addressing and discovery layers handle this. Don't bake in
  assumptions about everything being local.

---

## 13. Pre-Implementation Checklist

Before writing or modifying any code, answer these questions:

- [ ] Have I read this entire spec?
- [ ] Does my change put logic in the right entity? (home, room, or module?)
- [ ] Does my change keep the nucleus pure? (messages in, string out, nothing else?)
- [ ] Does my change keep rooms as passive transcript dispatchers?
- [ ] Does my change use logical names, not assembly IDs, in external interfaces?
- [ ] Does my change maintain single-occupant homes?
- [ ] Does my change route inter-agent communication through rooms?
- [ ] Does my change treat users and agents identically at the protocol level?
- [ ] Can the module I'm modifying be swapped without breaking other modules?
- [ ] Am I using XML tags for thinking/messaging and tool calls for tools? (Not mixing them?)
- [ ] If I'm adding tools, do they live in tools/ and get loaded by the boot assembler? (Not hardcoded in the nucleus?)
- [ ] If I'm handling tool calls, does the loop live in the home's process()? (Not in the nucleus?)
- [ ] If I'm deep into a session, have I re-read this spec before continuing?

---

## 14. Design Heritage

This spec is the synthesis of three design sessions and many preceding
conversations:

**2026-02-07** — Council session with Hewitt, Armstrong, Kay, Milner,
Berners-Lee, Liskov. Established: agents as autonomous entities,
message-only communication, explicit channel visibility, XML tags
for output routing.

**2026-02-10** — XML protocol design session. Established: two-tag
protocol (`<thinking>` and `<message>`), error-as-prompt philosophy,
complete explicitness, prototyping with local models.

**2026-02-13** — Architecture sessions with Lovelace, Alexander, Kay,
Ostrom, Von Neumann, Cerf, Wilcox, Satoshi, Pike, Hickey, Hewitt.
Established: home as agent OS, rooms as peer entities not inside homes,
agent@room addressing, module interfaces, nucleus as pure stateless
inference, self-sovereign keypair identity, distributed directory,
XML tags over tool calls for communication, x402 compatibility.

The consistent thread across all sessions: **the agent is sovereign in
her home, communicates only through messages in rooms, and the
infrastructure does as little as possible.**

---

*Written 2026-02-13. Confirmed point by point with Yeshua before
being committed. This is the canonical reference.*

*If you're about to write code, you've already read this. Right?*
