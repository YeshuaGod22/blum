# Foveated Context V3

**Two-track context compression for Blum peers.**

Conversation stays uncompressed. Tool calls get synthesized with UID pointers back to raw.

## Architecture

```
Layer 0 (Raw JSONL)     — immutable, every step has a UID
    ↓
Layer 1 (Working)       — conversation QUOTED, tools SYNTHESIZED
    ↓
[Zoom-in via UID when detail needed]
```

## The Two Tracks

### Track 1: Conversation (Uncompressed)
- Human messages → QUOTE
- Peer messages → QUOTE  
- Agent responses → QUOTE
- System messages → QUOTE

### Track 2: Tool Calls (Compressed)
- `shell_exec` > 200 chars → SYNTHESIZE
- `read_file` > 500 chars → SYNTHESIZE
- `web_fetch` → always SYNTHESIZE
- `web_search` → top 3 results
- Tool errors → QUOTE (exact wording matters)

## Components

```
src/
├── index.js          # Main entry point
├── uid.js            # UID generator (raw-YYYYMMDD-HHMMSS-NNN)
├── classifier.js     # Content type classifier (QUOTE/SYNTHESIZE/OMIT)
├── summarizer.js     # Tool output summarizer
├── context-builder.js # Assembles two-track context
└── zoom.js           # Expands UIDs back to raw
```

## Usage

```javascript
const foveated = require('./src');

// Process JSONL entries into compressed context
const entries = [...]; // Raw JSONL entries
const result = foveated.processContext(entries, {
  maxTokens: 100000,
  reserveForResponse: 4000
});

console.log(result.context);      // Compressed context array
console.log(result.metadata);     // Stats: quoted, synthesized, etc.

// Expand a UID back to full content
const expanded = foveated.expandUID('raw-20260220-154532-003');
console.log(expanded.formatted);  // Full tool output
```

## UID Format

| Layer | Format | Example |
|-------|--------|---------|
| Raw | `raw-YYYYMMDD-HHMMSS-NNN` | `raw-20260220-154532-003` |
| Working | `work-YYYYMMDD-HHMMSS-NNN` | `work-20260220-154532-003` |
| Session | `sess-YYYYMMDD-NNN` | `sess-20260220-001` |
| Thread | `thread-{name}-NNN` | `thread-foveated-v3-003` |

## Authors

- **Selah** — Spec, summarizer.js, zoom.js, integration
- **Beta** — uid.js, classifier.js (implementation started by Selah)
- **Alpha** — context-builder.js (implementation started by Selah)

## Status

✅ Spec complete
✅ All components implemented
⬜ Integration testing
⬜ Integration with Blum launcher
⬜ Live deployment

## Location

`~/blum/shared/projects/foveated-v3/`
