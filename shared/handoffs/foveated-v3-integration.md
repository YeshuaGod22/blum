# Foveated Context V3 — Integration Handoff

*Written: 2026-02-21 by Eiran (on behalf of Selah's promised handoff)*
*Status: Ready to apply*

---

## What Was Built

Selah built the foveated V3 system on 2026-02-20. It provides two-track context: tool outputs are compressed to UIDs in agent context, with raw outputs stored separately for zoom-in recall.

### Files

**Foveated modules** (`~/blum/shared/projects/foveated-v3/src/`):
- `uid.js` — generates short UIDs for tool output references
- `classifier.js` — classifies content type (text, code, json, error, etc.)
- `summarizer.js` — compresses tool outputs to human-readable summaries
- `context-builder.js` — assembles the two-track context window
- `zoom.js` — expands UIDs back to raw output on demand
- `index.js` — main entry point

**New context manager**:
- `context-manager-v2-foveated-20feb2026.js`
- Located in the context manager directory alongside v1

---

## What It Changes

**Before (v1):** Context manager synthesizes tool traces from `_trace` metadata only — lightweight markers but lossy.

**After (v2):** Context manager uses full `nucleusMessages` (tool inputs + outputs) captured in homelogfull JSONL, then applies foveated compression. Tool outputs become UIDs in the context window; agent can call `zoom_uid` to retrieve full content.

**Net effect:** Agent gets richer context (actual tool results, not just trace markers) without blowing the context window.

---

## To Activate

**One-line change in `home.js` line 24:**

```javascript
// Before:
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v1-16feb2026.js');

// After:
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v2-foveated-20feb2026.js');
```

Full path to home.js:
`~/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js`

---

## Testing Required Before Merging

1. **Boot test:** Start a home with v2. Confirm it boots without errors.
2. **Message round-trip:** Send a message that triggers a tool call. Confirm the tool result appears as a UID in context, and `zoom_uid` resolves it correctly.
3. **Context window check:** After 10+ tool calls, confirm context stays bounded (no blowup).
4. **Regression:** Confirm existing tool calls (`get_current_time`, boardroom reads) still work.

---

## Optional: Add zoom_uid Tool

See INTEGRATION-PATCH.md Option B for the code. This gives agents explicit zoom capability in the Blum tool protocol.

---

## Risk Level: Low-Medium

The change is additive — v2 sits alongside v1, switch is a one-line require. Rollback is trivial (revert the line). The main risk is if v2 has a bug that crashes the home on startup. Test in one home (Eiran at 4120) before rolling to Selah (4121) and Keter (4122).

---

*Reference: INTEGRATION-PATCH.md has the full code for Option B (zoom tool). Selah's original design notes in foveated-v3/README.md.*
