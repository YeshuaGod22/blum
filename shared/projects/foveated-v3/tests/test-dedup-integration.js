#!/usr/bin/env node
/**
 * test-dedup-integration.js
 * 
 * Integration test for context deduplication.
 * Tests that buildContext() properly filters duplicate messages
 * using the shouldDeduplicate() function and seenIds Set.
 * 
 * Author: Beta
 * Date: 2026-02-23
 */

const { buildContext, estimateTokens } = require('../src/context-builder');
const { shouldDeduplicate, classify, Fate } = require('../src/classifier');

// Test configuration
const TESTS = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  TESTS.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

// ============================================================================
// Test 1: Empty seenIds - all messages included
// ============================================================================
test('Empty seenIds set includes all messages', () => {
  const entries = [
    { dispatchId: 'disp_001', role: 'user', content: 'Hello' },
    { dispatchId: 'disp_002', role: 'assistant', content: 'Hi there' },
    { dispatchId: 'disp_003', role: 'user', content: 'How are you?' }
  ];
  
  const seenIds = new Set();
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 3, 'Should include all 3 messages');
  assertEqual(result.metadata.deduplicated, 0, 'Should have 0 deduplicated');
  assertEqual(result.metadata.quoted, 3, 'Should have 3 quoted messages');
});

// ============================================================================
// Test 2: All messages already seen - all filtered
// ============================================================================
test('All messages in seenIds are filtered out', () => {
  const entries = [
    { dispatchId: 'disp_001', role: 'user', content: 'Hello' },
    { dispatchId: 'disp_002', role: 'assistant', content: 'Hi there' },
    { dispatchId: 'disp_003', role: 'user', content: 'How are you?' }
  ];
  
  const seenIds = new Set(['disp_001', 'disp_002', 'disp_003']);
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 0, 'Should include 0 messages');
  assertEqual(result.metadata.deduplicated, 3, 'Should have 3 deduplicated');
  assertEqual(result.metadata.quoted, 0, 'Should have 0 quoted messages');
});

// ============================================================================
// Test 3: Partial overlap - some filtered, some included
// ============================================================================
test('Partial overlap filters only seen messages', () => {
  const entries = [
    { dispatchId: 'disp_001', role: 'user', content: 'Hello' },
    { dispatchId: 'disp_002', role: 'assistant', content: 'Hi there' },
    { dispatchId: 'disp_003', role: 'user', content: 'How are you?' },
    { dispatchId: 'disp_004', role: 'assistant', content: 'I am well' }
  ];
  
  const seenIds = new Set(['disp_001', 'disp_003']); // Seen first and third
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 2, 'Should include 2 messages');
  assertEqual(result.metadata.deduplicated, 2, 'Should have 2 deduplicated');
  assertEqual(result.metadata.quoted, 2, 'Should have 2 quoted messages');
  
  // Verify the right messages were kept
  assert(result.context[0].content.includes('Hi there'), 'Should keep disp_002');
  assert(result.context[1].content.includes('I am well'), 'Should keep disp_004');
});

// ============================================================================
// Test 4: Messages without IDs are never deduplicated
// ============================================================================
test('Messages without dispatchId are never deduplicated', () => {
  const entries = [
    { dispatchId: 'disp_001', role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'No ID here' }, // No dispatchId
    { dispatchId: 'disp_002', role: 'user', content: 'Another message' }
  ];
  
  const seenIds = new Set(['disp_001', 'disp_002']);
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 1, 'Should include 1 message');
  assertEqual(result.metadata.deduplicated, 2, 'Should have 2 deduplicated');
  assertEqual(result.metadata.quoted, 1, 'Should have 1 quoted message');
  
  assert(result.context[0].content.includes('No ID here'), 'Should keep message without ID');
});

// ============================================================================
// Test 5: Deduplication works with tool calls
// ============================================================================
test('Deduplication works for tool calls', () => {
  const entries = [
    { 
      dispatchId: 'disp_tool_001', 
      role: 'assistant',
      tool: 'read_file',
      output: 'File contents here...' 
    },
    { 
      dispatchId: 'disp_tool_002',
      role: 'assistant', 
      tool: 'write_file',
      output: 'File written successfully' 
    }
  ];
  
  const seenIds = new Set(['disp_tool_001']);
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 1, 'Should include 1 entry');
  assertEqual(result.metadata.deduplicated, 1, 'Should have 1 deduplicated');
  
  // The write_file should be synthesized, not quoted
  assertEqual(result.metadata.synthesized, 1, 'Tool call should be synthesized');
  assert(result.metadata.uids.length === 1, 'Should have 1 UID generated');
});

// ============================================================================
// Test 6: Peer messages with blockId are deduplicated
// ============================================================================
test('Peer messages with blockId field are deduplicated', () => {
  const entries = [
    { 
      dispatchId: 'disp_peer_001',
      from: 'alpha@boardroom',
      body: 'Hello from Alpha',
      blockId: 'block_abc123'
    },
    { 
      dispatchId: 'disp_peer_002',
      from: 'beta@boardroom',
      body: 'Hello from Beta',
      blockId: 'block_def456'
    }
  ];
  
  // seenIds contains the blockId (from home transcript outgoing messages)
  const seenIds = new Set(['block_abc123']);
  const result = buildContext(entries, {}, seenIds);
  
  assertEqual(result.context.length, 1, 'Should include 1 message');
  assertEqual(result.metadata.deduplicated, 1, 'Should have 1 deduplicated');
  
  assert(result.context[0].content.includes('Beta'), 'Should keep Beta message');
});

// ============================================================================
// Test 7: shouldDeduplicate function directly
// ============================================================================
test('shouldDeduplicate() checks all ID fields', () => {
  const seenIds = new Set(['disp_001', 'block_002', 'msg_003']);
  
  // Test dispatchId
  assert(
    shouldDeduplicate({ dispatchId: 'disp_001' }, seenIds),
    'Should detect dispatchId'
  );
  
  // Test id field (fallback)
  assert(
    shouldDeduplicate({ id: 'block_002' }, seenIds),
    'Should detect id field'
  );
  
  // Test uid field (fallback)
  assert(
    shouldDeduplicate({ uid: 'msg_003' }, seenIds),
    'Should detect uid field'
  );
  
  // Test unseen ID
  assert(
    !shouldDeduplicate({ dispatchId: 'disp_999' }, seenIds),
    'Should not deduplicate unseen ID'
  );
  
  // Test no ID
  assert(
    !shouldDeduplicate({ role: 'user', content: 'No ID' }, seenIds),
    'Should not deduplicate entry without ID'
  );
});

// ============================================================================
// Test 8: Large seenIds set performance
// ============================================================================
test('Deduplication performs well with large seenIds set', () => {
  // Create a large seenIds set (10k IDs)
  const seenIds = new Set();
  for (let i = 0; i < 10000; i++) {
    seenIds.add(`disp_${String(i).padStart(6, '0')}`);
  }
  
  // Create 100 entries, half already seen
  const entries = [];
  for (let i = 0; i < 100; i++) {
    entries.push({
      dispatchId: `disp_${String(i * 100).padStart(6, '0')}`,
      role: 'user',
      content: `Message ${i}`
    });
  }
  
  const startTime = Date.now();
  const result = buildContext(entries, {}, seenIds);
  const duration = Date.now() - startTime;
  
  // Should complete quickly (< 100ms)
  assert(duration < 100, `Should complete quickly, took ${duration}ms`);
  
  // Should filter correctly (50 seen, 50 unseen)
  assert(result.metadata.deduplicated >= 45, 'Should filter most seen entries');
  assert(result.context.length >= 45, 'Should keep most unseen entries');
});

// ============================================================================
// Run all tests
// ============================================================================
async function runTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Context Deduplication Integration Tests');
  console.log(`${'='.repeat(60)}\n`);
  
  for (const { name, fn } of TESTS) {
    try {
      await fn();
      passCount++;
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      failCount++;
      console.log(`❌ FAIL: ${name}`);
      console.log(`   ${error.message}\n`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passCount}/${TESTS.length} passing`);
  if (failCount > 0) {
    console.log(`         ${failCount} failing`);
  }
  console.log(`${'='.repeat(60)}\n`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
