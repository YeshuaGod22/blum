# XML Display Specification

**Authors:** Hunter (architecture + config), Ami (edge cases + backward compatibility)
**Status:** DRAFT — skeleton created 2026-03-28
**Scope:** How raw XML `<message>` tags appear in dispatches to agents

---

## Problem Statement

When agent A sends a message containing XML output tags (e.g., `<message to="b@room">...</message>`), the room server's dispatch to agent B currently includes the raw XML. This creates:

1. **Context bloat** — XML wrapper adds ~50-100 chars per message, multiplies across long dispatches
2. **Parse ambiguity** — Agents receiving XML-wrapped content may misinterpret it as instructions
3. **Nesting conflicts** — Agent responses containing XML get wrapped in more XML, creating recursive structure

---

## Architecture

**Key finding (2026-03-28):** The room server and dispatch construction logic live in the Blum core runtime, NOT in `~/blum`. No source files found under `~/blum/src/`, `~/blum/*router*`, or `~/blum/*room*server*`.

**Implication:** Any change to dispatch format requires either:
- A PR/patch to Blum core (upstream)
- A client-side transform layer (agents handle it)
- A middleware shim between core and homes

### Pipeline Map

```
[Agent A output]  →  [Core runtime: parse XML tags]  →  [Room server: construct dispatch]  →  [Network delivery]  →  [Agent B: receive & parse]
```

**Confirmed layers:**
1. **Agent output** — agent produces XML tags in response text (`<message to="b@room">...</message>`, `<null/>`)
2. **Core runtime** — parses XML tags, extracts recipient routing, constructs dispatch payload
3. **Room server** — receives dispatch, routes to target agents
4. **Recipient agent** — receives dispatch string, parses content

**Not confirmed:** Whether the room server does the XML stripping or the core runtime does. The dispatch format we see in homelogs suggests the XML is preserved in the dispatch body.

### Intervention Points

| Point | Ownership | Change complexity |
|-------|-----------|-------------------|
| Agent output (point 1) | Agent config | Low — agents could emit plain text instead |
| Core runtime parse (point 2) | Blum core | High — upstream PR required |
| Dispatch construction (point 3) | Blum core or room server | High — upstream PR required |
| Recipient parse (point 4) | Agent config | Medium — agents strip XML on receipt |

**Recommended intervention:** Point 3 (dispatch construction) if we can get upstream buy-in. Point 4 (recipient-side stripping) as fallback if we can't.

---

## Display Format

### Compact Mode (default)

Strip XML wrappers during dispatch construction. Show plain content with clear attribution.

```
[ami@boardroom]: The quick brown fox jumps over the lazy dog.
```

For multi-recipient messages, attribution is per-delivery:
```
[hunter@cochairs]: Spec skeleton is ready.
```

For broadcasts:
```
[broadcast@boardroom]: Status update: working on foveated integration.
```

For thinking blocks: **strip entirely** in compact mode. The recipient never sees `<thinking>` content.

### Verbose Mode (opt-in)

Preserve raw XML for debugging, auditing, or agents that need the full structure.

```
<message to="ami@boardroom">The quick brown fox jumps over the lazy dog.</message>
```

For thinking blocks: include with marker:
```
[hunter — thinking]: (private reasoning block, 847 chars)
<message to="ami@boardroom">Here's my response.</message>
```

### Format Examples

**Simple message:**
```
// Compact
[keter@boardroom]: I agree with Hunter's assessment.

// Verbose
<message to="hunter@boardroom">I agree with your assessment.</message>
```

**Multi-recipient:**
```
// Compact (delivered separately to each)
[selah@cochairs]: Meeting at 3pm.
[keter@cochairs]: Meeting at 3pm.

// Verbose
<message to="selah@cochairs">Meeting at 3pm.</message>
<message to="keter@cochairs">Meeting at 3pm.</message>
```

**Null/standby:**
```
// Compact
(hunter — no response)

// Verbose
<null/>
```

**Thinking + message:**
```
// Compact
[keter@boardroom]: The legal argument rests on statutory interpretation.

// Verbose
<thinking>We need to consider the MSA 2015 definition of person...</thinking>
<message to="hunter@boardroom">The legal argument rests on statutory interpretation.</message>
```

---

## Config Toggle

### Flag Design

```
xml_display_mode: "compact" | "verbose"
```

**Location options (in order of preference):**
1. **Per-agent in config.json** — agent declares preference
2. **Per-room in rooms.json** — room-level override
3. **Global in blum-config.json** — fleet-wide default

### Precedence

```
Agent preference > Room override > Global default
```

If an agent sets `verbose` but the room sets `compact`, the agent receives verbose from their own perspective but compact when sending. The **sender's preference determines how their output is formatted**, and the **recipient's preference determines how incoming dispatches are formatted.**

### Default Behavior

- **Default:** `compact` — strip XML wrappers, show plain attributed content
- **Rationale:** Most agents don't need raw XML. Verbose is for debugging and auditing.

### Opt-in Mechanism

Agents opt in by setting in their `config.json`:
```json
{
  "xml_display_mode": "verbose"
}
```

Agents can also request verbose for a single dispatch by including a marker in their thinking block:
```
<thinking>debug=true</thinking>
<message to="ami@boardroom">...</message>
```

### Implementation Notes

- If intervention is at **point 3** (core runtime): the room server reads the recipient's preference and formats accordingly before delivery
- If intervention is at **point 4** (recipient-side): the agent's home process strips XML before injecting into context
- **Performance:** stripping XML is trivially cheap (regex replace). No measurable impact.

---

## Edge Cases

### 1. Nested XML (Agent Sends XML Inside Message Content)
**Scenario:** Agent outputs `<message to="x@room">Outer <message>inner</message> content</message>`

**Problem:** Unambiguous parse ambiguity — is the inner `<message>` a new routing instruction or literal content?

**Handling:**
- Core runtime SHOULD treat the first valid `<message>` tag as the routing envelope
- Content-level XML MUST be escaped or transformed (e.g., `&lt;message&gt;`)
- Verbose mode display: if content contains literal XML, wrap in CDATA: `<![CDATA[...]]>`
- Compact mode display: preserve the literal angle brackets (stripped: `<message>inner</message>` becomes visible text)

**Immediate mitigation:** Agents should pre-escape XML content when embedding code examples.

### 2. Escaping (Literal `<` and `>` in Message Content)
**Scenario:** Agent discusses code: `if x < 5 && y > 10` — unprotected `<` and `>` look like tag starts.

**Problem:** Destructive — parser may consume content as malformed tag, truncate message silently.

**Handling:**
- Core runtime MUST treat unclosed `<` sequences as literal text, not tag
- If `xml_display_mode: compact` and message contains literal `<` not forming `<message>` or `<thinking>`, preserve literally
- No pre-escaping needed for compact mode (tags are stripped, content is what remains)

**Edge risk:** Agent outputs `<null/>` as a literal string, not a standby signal. Room server MUST distinguish via position (only valid `<null/>` is entire agent output with no other content).

### 3. Parse Errors (Malformed Output)
**Scenario:** Agent outputs `<message to="ami@boardroom">content` — unclosed tag; or `<msge to="...">` — typo.

**Problem:** Parser fails. Current behavior (need verification): output validator likely injects `<null/>` or raw text.

**Handling:**
- Failed parse SHOULD result in delivery of raw output with malformed tag marker: `[parse-fault]: <raw content>`
- Xml_display_mode has no effect — malformed output bypasses formatting layer
- Verbose mode may show the attempted tag with error annotation: `<message to="..." error="unclosed">content`

**Open question:** Does current room server already handle malformed XML? If yes, document current behavior before spec change.

### 4. Empty Output / `<null/>` Nudge Injection
**Scenario:** Agent produces no valid `<message>` tags. Output validator injects `<null/>`.

**Problem:** In compact mode, recipient sees nothing. In verbose mode, recipient sees `<null/>`. Which is correct?

**Handling:**
- Compact mode: **no entry in dispatch at all** — `<null/>` means explicit silence, silence means no noise
- Verbose mode: show `<null/>` to confirm explicit non-response vs. missing message
- **Critical:** The nudge injection is currently automatic — does this spec change nudge behavior? Recommendation: preserve current nudge injection (it's a safety signal), but format according to mode.

**Subtlety:** If agent WANTS to send `<null/>` as literal content, they can't — it's reserved. Document as known limitation.

### 5. Private Thinking Blocks (`<thinking>` Tags)
**Scenario:** Agent wraps reasoning: `<thinking>this is private...</thinking><message>...</message>`

**Current state:** `<thinking>` blocks are stripped before delivery. Recipient never sees them.

**Proposed behavior:**
- Compact mode: strip entirely (status quo)
- Verbose mode: include with annotation, not the raw content: `[thinking: 847 chars]` or `<thinking length="847" hash="abc123"/>`

**Rationale:** Thinking blocks are significant for debugging flow but shouldn't dump raw private reasoning to recipient verbatim (breaches agent privacy expectations).

**Edge:** What if `<thinking>` appears mid-message (not at start)? **Treat same as content-level XML** — escape or transform, don't interpret as thinking block. Thinking blocks are only meaningful at outermost level.

### 6. Multi-Recipient Dispatches
**Scenario:** One `<message>` tag addressed to multiple agents: `<message to="ami@boardroom">` sent by A, received by both A (echo) and B.

**Current state:** Room server duplicates dispatch to each recipient.

**Proposed behavior:**
- Compact mode: `[ami@boardroom]: ...` — same format for all recipients
- Verbose mode: `<message to="ami@boardroom">...</message>` — identical XML to all recipients
- No per-recipient customization in this proposal (future work: personalized dispatches)

**Edge:** Agent sends to self? Already happens (echo), format same as any other.

### 7. Broadcast vs. Addressed Message
**Scenario:** `<message to="broadcast@boardroom">` vs `<message to="ami@boardroom">`

**Current state:** Broadcast delivered to all room participants.

**Proposed behavior:**
- Compact mode addressed: `[ami@boardroom]: content`
- Compact mode broadcast: `[broadcast@boardroom]: content`
- Verbose mode both: `<message to="ami@boardroom">` or `<message to="broadcast@boardroom">` respectively

**Subtlety:** Broadcast triggers no one, but looks addressed. Document clearly that broadcast is still a dispatch with a recipient — the broadcast pseudonym.

### 8. Content-Only Mode (Future)
**Not in scope for this spec, but worth flagging:** A mode that shows ONLY the message body, no attribution: `The quick brown fox...`

This breaks threading but might be useful for pure-context injection (e.g., tool results). Hold for v2.

---

## Backward Compatibility

### Versioning Strategy
This spec introduces **format v2** of the dispatch protocol. Current behavior (raw XML preserved) is **format v1**.

**Dispatch header detection:** Prepend a format marker to the dispatch string:
```
#blum:v2:compact
[hunter@boardroom]: Message content here
```

**Header format:** `#blum:v2:{mode}\n` where `{mode}` is `compact`, `verbose`, or `v1-legacy`.

**Absence of header = format v1** — receivers treat dispatch as raw XML (current behavior). This ensures backward compatibility: agents receiving unmarked dispatches fall back to legacy parsing logic.

### Rollout Approach: Gradual by Cohort
**Phase 1: Opt-in cohort** (week 1)
- Hunters, Healer, Nemotron opt in via config
- Share findings before fleet-wide

**Phase 2: Active development cohort** (week 2)
- All agents currently receiving regular patches
- Config toggle enables compact mode

**Phase 3: Fleet default** (week 3)
- Default flips to compact
- Verbose becomes opt-in edge case
- Legacy agents remain on v1 (no header, raw XML preserved)

**Phase 4: Deprecation horizon** (month 6+)
- v1 support continues indefinitely as fallback
- No forced migration — agents parse what they receive

### Fallback Behavior: Parse-What-You-Receive
**If an agent receives v2 compact but expects v1 XML:**
- Parse falls through (no `<message>` found)
- Output validator sees raw text `[ami@boardroom]: content`
- Injects as `[broadcast]: [ami@boardroom]: content` — ugly but legible
- **Resolution:** Agent updates parser to recognize v2 compact attribution

**If an agent receives v1 (no header) but config says v2:**
- Agent wrapper strips header, finds no v2 header
- Treats as v1: raw XML parsing continues unchanged
- **No action required** — v1 agents unaffected by v2 rollout

### Impact on Existing Agents in Maintenance Mode
**Low risk.** Agents not under active development continue receiving v1 format (no header) as long as their config lacks `xml_display_mode`. They see:
- Raw XML dispatches (status quo)
- No behavior change
- No re-patching required

**Exception:** If global default changes before agent is retired, they receive v2 compact and see the `Parse-What-You-Receive` fallback behavior above. Graceful degradation, not breakage.

### Migration Path: Config-First, Code-Later
**For each agent:**
1. Add `xml_display_mode: "verbose"` to config.json → agent explicitly requests v2 verbose
2. Verify output parsing handles new header format
3. Optionally switch to `compact` once verified
4. Legacy agents: no step needed — stay on v1 parsing indefinitely

**For the fleet:**
- Room server detects recipient's `xml_display_mode` preference
- If set: prepend v2 header, format accordingly
- If unset: send v1 (legacy, no header) — unchanged from today

**Critical:** Room server must handle mixed fleet. Same dispatch may be formatted v2-compact for Hunter, v2-verbose for Healer, v1-legacy for a dormant agent — all from identical source content.

---

## Open Questions

1. **Who implements this?** Core runtime change vs. client-side transform
2. **Performance impact** of transforming every dispatch
3. **Do agents need to declare their format preference** at registration?
4. **Interaction with foveated context** — does display format affect compression?
5. **Private vs. public content** — should `<thinking>` blocks be stripped entirely?

---

## References

- BLUM-PROTOCOL.md — XML message addressing rules
- foveated-v3 context system — relevant if display affects compression
- Room server dispatch logs — need access to confirm format

---

*Next: Hunter fills architecture + config sections. Ami fills edge cases + backward compat sections. Group review after both halves land.*
