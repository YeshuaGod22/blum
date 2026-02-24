/**
 * Classifier Test: read_file Tool
 * 
 * Verifies that read_file tool calls are classified as SYNTHESIZE.
 * File contents can be large and should be compressed with UID pointer.
 */

const { classify, ContentType, Fate, SYNTHESIZE_TOOLS } = require('../src/classifier');

// Test entry 1: Small file read
const smallFileRead = {
  tool: 'read_file',
  input: { path: 'docs/notes.txt' },
  output: 'This is a short note about the meeting.',
  timestamp: '2026-02-23T13:05:00Z'
};

// Test entry 2: Large file read (code file)
const largeFileRead = {
  tool: 'read_file',
  input: { path: 'src/classifier.js' },
  output: `/**
 * Content Classifier — Foveated Context V3
 * 
 * Classifies JSONL entries into conversation (QUOTE) vs tool calls (SYNTHESIZE).
 * This determines which track each piece of content goes into.
 * 
 * Author: Beta (spec), Selah (implementation)
 * Date: 2026-02-20
 */

const ContentType = {
  CONVERSATION: 'conversation',
  TOOL: 'tool',
  SYSTEM: 'system',
  THINKING: 'thinking'
};

const Fate = {
  QUOTE: 'QUOTE',
  SYNTHESIZE: 'SYNTHESIZE',
  OMIT: 'OMIT',
  DEDUPLICATE: 'DEDUPLICATE'
};

// ... (full classifier code, ~5KB)
`.repeat(10), // ~50KB of content
  timestamp: '2026-02-23T13:05:10Z'
};

// Test entry 3: File read with error
const errorFileRead = {
  tool: 'read_file',
  input: { path: 'missing/file.txt' },
  error: 'File not found: missing/file.txt',
  timestamp: '2026-02-23T13:05:15Z'
};

console.log('Test: read_file Tool Classification\n');

// Test 1: Small file
const result1 = classify(smallFileRead);
console.log('Test 1: Small file read (41 chars)');
console.log('  Type:', result1.type);
console.log('  Fate:', result1.fate);
console.log('  Reason:', result1.reason);

if (result1.type !== ContentType.TOOL) {
  console.error('❌ FAIL: Expected type=TOOL, got', result1.type);
  process.exit(1);
}

if (result1.fate !== Fate.SYNTHESIZE) {
  console.error('❌ FAIL: Expected fate=SYNTHESIZE (read_file is in SYNTHESIZE_TOOLS), got', result1.fate);
  process.exit(1);
}

console.log('✅ PASS\n');

// Test 2: Large file
const result2 = classify(largeFileRead);
console.log('Test 2: Large file read (~50KB)');
console.log('  Type:', result2.type);
console.log('  Fate:', result2.fate);
console.log('  Reason:', result2.reason);

if (result2.type !== ContentType.TOOL) {
  console.error('❌ FAIL: Expected type=TOOL, got', result2.type);
  process.exit(1);
}

if (result2.fate !== Fate.SYNTHESIZE) {
  console.error('❌ FAIL: Expected fate=SYNTHESIZE, got', result2.fate);
  process.exit(1);
}

console.log('✅ PASS\n');

// Test 3: Error case
const result3 = classify(errorFileRead);
console.log('Test 3: File read with error');
console.log('  Type:', result3.type);
console.log('  Fate:', result3.fate);
console.log('  Reason:', result3.reason);

if (result3.type !== ContentType.TOOL) {
  console.error('❌ FAIL: Expected type=TOOL, got', result3.type);
  process.exit(1);
}

if (result3.fate !== Fate.QUOTE) {
  console.error('❌ FAIL: Expected fate=QUOTE (errors are always quoted), got', result3.fate);
  process.exit(1);
}

console.log('✅ PASS\n');

console.log('✅ ALL TESTS PASSED: read_file classification correct across all cases');
process.exit(0);
