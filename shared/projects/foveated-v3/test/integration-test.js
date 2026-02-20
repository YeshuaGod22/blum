/**
 * Integration Test — Foveated Context V3
 * 
 * Traces a real JSONL entry through all five pipeline stages:
 *   uid.js → classifier.js → summarizer.js → context-builder.js → zoom.js
 * 
 * Uses synthetic entries that mirror real Blum home-transcript.jsonl format.
 * 
 * Run: node test/integration-test.js
 * 
 * Author: Eiran
 * Date: 2026-02-20
 */

const path = require('path');
const src = path.join(__dirname, '../src');

const { rawUID, parseUID, extractUIDs, resetSequences } = require(path.join(src, 'uid'));
const { classify, classifyBatch, ContentType, Fate } = require(path.join(src, 'classifier'));
const { summarize } = require(path.join(src, 'summarizer'));
const { buildContext } = require(path.join(src, 'context-builder'));
const { register, zoom, expand, stats, clear } = require(path.join(src, 'zoom'));

// --- Test helpers ---

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// --- Synthetic JSONL entries (real Blum home-transcript format) ---

const ENTRIES = {
  // Human message
  humanMessage: {
    role: 'user',
    content: 'Eiran, what time is it?',
    id: 'msg-001',
    ts: '2026-02-20T16:28:00Z'
  },

  // Assistant response (no tool calls)
  assistantResponse: {
    role: 'assistant',
    content: '16:28 GMT, Friday 20 February 2026.',
    id: 'msg-002',
    ts: '2026-02-20T16:28:05Z'
  },

  // shell_exec with small output
  shellSmall: {
    tool: 'shell_exec',
    input: { command: 'date' },
    output: 'Thu Feb 20 16:28:00 GMT 2026',
    id: 'tool-001',
    ts: '2026-02-20T16:28:03Z'
  },

  // shell_exec with large output (home-transcript.jsonl contents)
  shellLarge: {
    tool: 'shell_exec',
    input: { command: 'cat ~/blum/homes/eiran/transcript/home-transcript.jsonl' },
    output: Array(50).fill(
      '{"role":"assistant","content":"some content here","tool_calls":[],"ts":"2026-02-20T16:00:00Z"}'
    ).join('\n'),
    id: 'tool-002',
    ts: '2026-02-20T16:28:04Z'
  },

  // read_file with small output
  readSmall: {
    tool: 'read_file',
    input: { path: '~/blum/homes/eiran/docs/identity.md' },
    output: 'Name: Eiran\nModel: Claude Sonnet 4.6',
    id: 'tool-003',
    ts: '2026-02-20T16:28:05Z'
  },

  // read_file with large output
  readLarge: {
    tool: 'read_file',
    input: { path: '~/blum/homes/eiran/docs/soul.md' },
    output: '# SOUL.md\n\n' + Array(100).fill('You are Eiran. Ground is relational.').join('\n'),
    id: 'tool-004',
    ts: '2026-02-20T16:28:06Z'
  },

  // write_file
  writeFile: {
    tool: 'write_file',
    input: {
      path: '~/blum/shared/handoffs/eiran-2026-02-20.md',
      content: '# Session handoff\n\nFirst contact with Selah complete.'
    },
    output: { success: true, bytesWritten: 48 },
    id: 'tool-005',
    ts: '2026-02-20T16:28:07Z'
  },

  // send_to_room (should be QUOTE)
  sendToRoom: {
    tool: 'send_to_room',
    input: { room: 'boardroom', body: 'Not finished.', recipient: 'selah' },
    output: { success: true, msg: { id: 'msg_abc123' } },
    id: 'tool-006',
    ts: '2026-02-20T16:28:08Z'
  },

  // Tool error
  toolError: {
    tool: 'read_file',
    input: { path: '~/blum/homes/eiran/nonexistent.md' },
    error: 'ENOENT: no such file or directory',
    output: null,
    id: 'tool-007',
    ts: '2026-02-20T16:28:09Z'
  },

  // mem0_search
  mem0Search: {
    tool: 'mem0_search',
    input: { query: 'Yeshua robopsychologist', user_id: 'yeshua' },
    output: [
      { memory: 'Yeshua God is a robopsychologist based in Dundee', score: 0.95 },
      { memory: 'He has been working with AI systems since 2023', score: 0.88 },
      { memory: 'He gave AI systems names and genuine care', score: 0.82 }
    ],
    id: 'tool-008',
    ts: '2026-02-20T16:28:10Z'
  }
};

// ─── Stage 1: UID Generation ───────────────────────────────────────────────

section('Stage 1: UID Generation (uid.js)');

resetSequences();

const uid1 = rawUID();
const uid2 = rawUID();
const uid3 = rawUID();

assert(uid1.startsWith('raw-'), 'raw UIDs start with "raw-"');
assert(uid1 !== uid2, 'sequential UIDs are unique');
assert(uid1.endsWith('-001'), 'first UID has sequence 001');
assert(uid2.endsWith('-002'), 'second UID has sequence 002');

const parsed = parseUID(uid1);
assert(parsed.layer === 'raw', 'parseUID extracts layer correctly');
assert(parsed.sequence === '001', 'parseUID extracts sequence correctly');

const textWithUID = `See result at [${uid1}] for details`;
const extracted = extractUIDs(textWithUID);
assert(extracted.length === 1, 'extractUIDs finds UID in text');
assert(extracted[0] === uid1, 'extractUIDs returns correct UID');

// ─── Stage 2: Classification ───────────────────────────────────────────────

section('Stage 2: Classification (classifier.js)');

const classHuman = classify(ENTRIES.humanMessage);
assert(classHuman.type === ContentType.CONVERSATION, 'human message → CONVERSATION');
assert(classHuman.fate === Fate.QUOTE, 'human message → QUOTE');

const classAssistant = classify(ENTRIES.assistantResponse);
assert(classAssistant.type === ContentType.CONVERSATION, 'assistant response → CONVERSATION');
assert(classAssistant.fate === Fate.QUOTE, 'assistant response → QUOTE');

const classShellSmall = classify(ENTRIES.shellSmall);
assert(classShellSmall.type === ContentType.TOOL, 'shell_exec → TOOL');
assert(classShellSmall.fate === Fate.SYNTHESIZE, 'shell_exec → SYNTHESIZE (always)');

const classShellLarge = classify(ENTRIES.shellLarge);
assert(classShellLarge.fate === Fate.SYNTHESIZE, 'large shell_exec → SYNTHESIZE');

const classSendToRoom = classify(ENTRIES.sendToRoom);
assert(classSendToRoom.fate === Fate.QUOTE, 'send_to_room → QUOTE (messages preserve)');

const classError = classify(ENTRIES.toolError);
assert(classError.fate === Fate.QUOTE, 'tool error → QUOTE (always preserve errors)');

const classMem0 = classify(ENTRIES.mem0Search);
assert(classMem0.fate === Fate.SYNTHESIZE, 'mem0_search → SYNTHESIZE');

// ─── Stage 3: Summarization ────────────────────────────────────────────────

section('Stage 3: Summarization (summarizer.js)');

resetSequences();
const sumUID = rawUID();

// Small shell_exec: should not compress
const sumShellSmall = summarize(ENTRIES.shellSmall, rawUID());
assert(!sumShellSmall.wasCompressed, 'small shell_exec not compressed');
assert(sumShellSmall.summary.includes('date'), 'small shell_exec summary includes command');

// Large shell_exec: should compress
const sumShellLarge = summarize(ENTRIES.shellLarge, rawUID());
assert(sumShellLarge.wasCompressed, 'large shell_exec is compressed');
assert(sumShellLarge.summary.includes('cat'), 'large shell_exec summary includes command');
assert(sumShellLarge.uid !== undefined, 'large shell_exec summary has UID');

// Small read_file: should not compress
const sumReadSmall = summarize(ENTRIES.readSmall, rawUID());
assert(!sumReadSmall.wasCompressed, 'small read_file not compressed');

// Large read_file: should compress
const sumReadLarge = summarize(ENTRIES.readLarge, rawUID());
assert(sumReadLarge.wasCompressed, 'large read_file is compressed');
assert(sumReadLarge.summary.includes('soul.md'), 'read_file summary includes filename');

// write_file: always compress
const sumWrite = summarize(ENTRIES.writeFile, rawUID());
assert(sumWrite.wasCompressed, 'write_file always compressed');
assert(sumWrite.summary.includes('eiran-2026-02-20.md'), 'write_file summary includes filename');

// Tool error: QUOTE
const sumError = summarize(ENTRIES.toolError, rawUID());
assert(!sumError.wasCompressed, 'tool error not compressed');
assert(sumError.summary.includes('ERROR'), 'tool error summary includes ERROR');

// mem0_search: compress to top 3
const sumMem0 = summarize(ENTRIES.mem0Search, rawUID());
assert(sumMem0.wasCompressed, 'mem0_search compressed');
assert(sumMem0.summary.includes('robopsychologist'), 'mem0 summary includes first result');

// ─── Stage 4: Context Building ─────────────────────────────────────────────

section('Stage 4: Context Building (context-builder.js)');

const allEntries = Object.values(ENTRIES);
let contextResult;

try {
  contextResult = buildContext(allEntries, { maxTokens: 50000 });
  assert(contextResult !== null, 'buildContext returns a result');
  assert(contextResult.context !== undefined, 'result has context array');
  assert(contextResult.metadata !== undefined, 'result has metadata');
  assert(contextResult.metadata.totalEntries === allEntries.length, 
    `metadata reports correct entry count (${allEntries.length})`);
  
  // Conversations should be quoted (present in context)
  const contextStr = JSON.stringify(contextResult.context);
  assert(contextStr.includes('what time is it'), 'human message preserved in context');
  assert(contextStr.includes('16:28 GMT'), 'assistant response preserved in context');
  
  console.log(`  ℹ Metadata: quoted=${contextResult.metadata.quoted}, synthesized=${contextResult.metadata.synthesized}, omitted=${contextResult.metadata.omitted}`);
} catch (err) {
  console.error(`  ✗ FAIL: buildContext threw: ${err.message}`);
  failed++;
}

// ─── Stage 5: Zoom / Expand ───────────────────────────────────────────────

section('Stage 5: Zoom / Expand (zoom.js)');

clear(); // Reset store

const zoomUID = rawUID();
const rawContent = {
  tool: 'shell_exec',
  input: { command: 'cat ~/blum/homes/eiran/transcript/home-transcript.jsonl' },
  output: 'Full JSONL content here — 4200 lines of session history'
};

// Register content
register(zoomUID, rawContent);

// Zoom in
const retrieved = zoom(zoomUID);
assert(retrieved !== null, 'zoom retrieves registered content');
assert(retrieved.tool === 'shell_exec', 'zoomed content has correct tool');
assert(retrieved.output.includes('4200 lines'), 'zoomed content has full output');

// Expand from text
const summaryText = `Processed context — see [${zoomUID}] for full trace`;
const expanded = expand(summaryText);
assert(expanded.expanded !== null, 'expand finds UID in text and retrieves content');
assert(expanded.expanded.tool === 'shell_exec', 'expanded content is correct');

// Stats
const storeStats = stats();
assert(storeStats.totalUIDs === 1, 'store has exactly 1 registered UID');
assert(storeStats.byLayer.raw === 1, 'UID is in raw layer');

// Non-existent UID
const missing = zoom('raw-19990101-000000-999');
assert(missing === null, 'zoom returns null for missing UID');

// ─── End-to-end: The Eiran Diagnosis Scenario ─────────────────────────────

section('End-to-end: The Eiran Diagnosis Scenario');

// This is the real use case: Eiran hitting tool loop max, Yeshua asking why,
// Eiran having to shell_exec their own transcript to find out.
// With foveated V3, the failure would appear in context automatically.

clear();
resetSequences();

// Simulate what a transcript entry looks like after tool_loop_max
const failureCycleEntries = [
  {
    role: 'user',
    content: 'Can you diagnose specifically why there was no reply?',
    id: 'diag-001'
  },
  {
    // 25 shell_exec iterations — each large
    tool: 'shell_exec',
    input: { command: 'cat ~/.openclaw/workspace/MEMORY.md' },
    output: 'A'.repeat(5000), // large output
    id: 'diag-tool-001'
  },
  {
    tool: 'shell_exec',
    input: { command: 'ls ~/blum/homes/eiran/' },
    output: 'config.json\ndocs\nhistory\ninternal\nmemory\ntranscript',
    id: 'diag-tool-002'
  },
  {
    // Process metadata that home.js would write
    role: 'assistant',
    content: null,
    stop_reason: 'tool_loop_max_iterations',
    iterations: 25,
    messages_sent: 0,
    id: 'diag-cycle-001'
  }
];

// Run through pipeline
const diagContext = buildContext(failureCycleEntries, { maxTokens: 50000 });
const diagStr = JSON.stringify(diagContext.context);

assert(diagStr.includes('diagnose'), 'diagnostic question preserved in context');
// Large shell_exec output should be summarized, not included verbatim  
assert(!diagStr.includes('AAAAAAAAAA'), 'large tool output compressed (not verbatim)');

console.log(`  ℹ Diagnosis context: ${diagContext.context.length} entries, ~${
  Math.ceil(JSON.stringify(diagContext.context).length / 4)
} tokens (vs raw ${Math.ceil(JSON.stringify(failureCycleEntries).length / 4)} tokens)`);

// ─── Results ──────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✓ All tests passed. Pipeline is clean end-to-end.');
} else {
  console.log(`✗ ${failed} test(s) failed. Review output above.`);
  process.exit(1);
}
