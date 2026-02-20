# Foveated Context V3 — Integration Patch

## Status: READY TO APPLY

The foveated modules are built and a new context manager version exists.

## Files Created

1. **Foveated Modules** (`~/blum/shared/projects/foveated-v3/src/`)
   - `uid.js` — UID generator
   - `classifier.js` — content type classifier
   - `summarizer.js` — tool output summarizer
   - `context-builder.js` — assembles two-track context
   - `zoom.js` — expands UIDs back to raw
   - `index.js` — main entry point

2. **New Context Manager** 
   - `context-manager-v2-foveated-20feb2026.js` in the context manager directory

## To Activate

### Option A: Replace Context Manager (Recommended)

Edit `~/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js`

Change line 24 from:
```javascript
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v1-16feb2026.js');
```

To:
```javascript
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v2-foveated-20feb2026.js');
```

### Option B: Add Zoom Tool

After the `get_current_time` case in `_executeTool()` (around line 235), add:

```javascript
case 'zoom_uid': {
  const rawJsonlPath = path.join(this.homeDir, 'history', 'raw-tool-outputs.jsonl');
  if (!fs.existsSync(rawJsonlPath)) {
    return { error: 'No raw tool outputs stored yet' };
  }
  const lines = fs.readFileSync(rawJsonlPath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.uid === input.uid) {
        return {
          uid: entry.uid,
          tool: entry.tool,
          input: entry.input,
          output: entry.output,
          ts: entry.ts
        };
      }
    } catch (e) {
      continue;
    }
  }
  return { error: `UID not found: ${input.uid}` };
}
```

### Option C: Add Zoom Tool Definition

Create `tools/zoom_uid.json`:
```json
{
  "name": "zoom_uid",
  "description": "Expand a compressed tool output by its UID. Use when you see [uid:XXX] markers and need the full content.",
  "input_schema": {
    "type": "object",
    "properties": {
      "uid": {
        "type": "string",
        "description": "The UID to expand (e.g., 'raw-20260220-154532-003')"
      }
    },
    "required": ["uid"]
  }
}
```

## What Changes After Activation

1. **Tool outputs > 200 chars** get compressed to one-line summaries with `[uid]` markers
2. **Conversation messages** stay full fidelity (unchanged)
3. **Raw tool outputs** are stored in `history/raw-tool-outputs.jsonl`
4. **Agents can zoom in** by calling `zoom_uid` tool or saying "show me uid:XXX"
5. **Context window** fills more slowly because tool outputs are compressed

## Rollback

Change the require back to `context-manager-v1-16feb2026.js`. No data loss — raw outputs are preserved.

---
*Patch prepared by Selah, 2026-02-20*
