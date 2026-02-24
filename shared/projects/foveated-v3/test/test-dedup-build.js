/**
 * Test: Dedup Integration with buildContext()
 * 
 * Tests that seenIds flow correctly into buildContext() and filter duplicates.
 * Uses real home transcript entries and verifies dedup metadata.
 * 
 * Author: Beta
 * Date: 2026-02-23
 */

const path = require('path');
const fs = require('fs');
const { buildContext } = require('../src/context-builder');
const { extractSeenIdsFromHome } = require('../src/extract-seen-ids');

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

async function testDedupBuild() {
  console.log('\n=== DEDUP BUILD INTEGRATION TEST ===\n');

  // Load real entries from Eiran's home
  const eiranHome = path.join(__dirname, '../../../../homes/eiran');
  const transcriptPath = path.join(eiranHome, 'homelogfull', 'homelogfull.jsonl');

  if (!fs.existsSync(transcriptPath)) {
    console.error(`❌ FAIL: Transcript not found at ${transcriptPath}`);
    failed++;
    return 1;
  }

  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const allEntries = lines.map(line => JSON.parse(line));

  console.log(`  ℹ Loaded ${allEntries.length} entries from transcript`);

  // ─── Test 1: Baseline (no seenIds) ─────────────────────────────────────

  section('Test 1: buildContext WITHOUT seenIds (baseline)');
  
  const result1 = buildContext(allEntries.slice(0, 20), {});
  
  assert(result1.metadata !== undefined, 'buildContext returns metadata');
  assert(result1.metadata.deduplicated === 0, 'no deduplication without seenIds');
  assert(result1.context.length > 0, 'context has entries');

  console.log(`  ℹ Total=${result1.metadata.totalEntries}, Quoted=${result1.metadata.quoted}, Synthesized=${result1.metadata.synthesized}`);

  // ─── Test 2: Manual seenIds extraction + dedup ────────────────────────

  section('Test 2: buildContext WITH manually extracted seenIds');

  const firstBatch = allEntries.slice(0, 10);
  const secondBatch = allEntries.slice(0, 20); // Overlaps with first 10

  // Manually extract IDs from first batch
  const manualSeenIds = new Set();
  for (const entry of firstBatch) {
    if (entry.dispatchId) manualSeenIds.add(entry.dispatchId);
    if (entry.parsedOutput?.messages) {
      for (const msg of entry.parsedOutput.messages) {
        if (msg.blockId) manualSeenIds.add(msg.blockId);
      }
    }
  }

  assert(manualSeenIds.size > 0, `extracted ${manualSeenIds.size} seen IDs manually`);

  const result2 = buildContext(secondBatch, {}, manualSeenIds);

  assert(result2.metadata.deduplicated > 0, 'deduplication occurred with seenIds');
  assert(result2.metadata.deduplicated <= 10, 'deduplicated count <= first batch size');

  console.log(`  ℹ Deduplicated ${result2.metadata.deduplicated} of 20 entries (first 10 were "seen")`);

  // ─── Test 3: extractSeenIdsFromHome() → buildContext() ────────────────

  section('Test 3: Full dedup chain (extractSeenIdsFromHome → buildContext)');

  const extractedIds = await extractSeenIdsFromHome(eiranHome);
  assert(extractedIds.size > 0, `extracted ${extractedIds.size} IDs from home`);

  // Build context with ALL entries - should deduplicate heavily since they're all from home
  const result3 = buildContext(allEntries, {}, extractedIds);

  assert(result3.metadata.deduplicated > 0, 'deduplication occurred');
  assert(result3.metadata.deduplicated === allEntries.length, 
    `all ${allEntries.length} entries deduplicated (they're all from home transcript)`);
  assert(result3.context.length === 0, 'context is empty (all entries were seen)');

  console.log(`  ℹ Deduplicated=${result3.metadata.deduplicated}, Context items=${result3.context.length}`);

  // ─── Test 4: Mixed scenario (new + old) ───────────────────────────────

  section('Test 4: Mixed scenario (new synthetic entry + old entries)');

  // Create a synthetic new entry
  const newEntry = {
    dispatchId: 'dispatch_synthetic_new_001',
    ts: new Date().toISOString(),
    room: 'test',
    parsedOutput: {
      messages: [{
        to: 'test@test',
        body: 'This is a new synthetic message',
        blockId: 'msg_synthetic_001'
      }]
    }
  };

  const mixedEntries = [...allEntries.slice(0, 5), newEntry];
  const result4 = buildContext(mixedEntries, {}, extractedIds);

  assert(result4.metadata.deduplicated === 5, 'deduplicated 5 old entries');
  assert(result4.context.length > 0, 'new entry processed into context');
  
  // Verify the new entry's content is in context
  const contextStr = JSON.stringify(result4.context);
  assert(contextStr.includes('synthetic'), 'new entry content appears in context');

  console.log(`  ℹ Deduplicated=${result4.metadata.deduplicated}, Context items=${result4.context.length}`);

  // ─── Test 5: Empty seenIds (edge case) ────────────────────────────────

  section('Test 5: Empty seenIds edge case');

  const emptySeenIds = new Set();
  const result5 = buildContext(allEntries.slice(0, 10), {}, emptySeenIds);

  assert(result5.metadata.deduplicated === 0, 'no deduplication with empty seenIds Set');
  assert(result5.context.length > 0, 'context has entries');

  // ─── Test 6: Verify dedup metadata structure ──────────────────────────

  section('Test 6: Dedup metadata structure');

  const testResult = buildContext(allEntries.slice(0, 5), {}, extractedIds);
  
  assert(testResult.metadata.hasOwnProperty('totalEntries'), 'metadata has totalEntries');
  assert(testResult.metadata.hasOwnProperty('deduplicated'), 'metadata has deduplicated');
  assert(testResult.metadata.hasOwnProperty('quoted'), 'metadata has quoted');
  assert(testResult.metadata.hasOwnProperty('synthesized'), 'metadata has synthesized');
  assert(testResult.metadata.hasOwnProperty('omitted'), 'metadata has omitted');

  // Verify accounting: totalEntries = deduplicated + quoted + synthesized + omitted
  const sum = testResult.metadata.deduplicated + 
              testResult.metadata.quoted + 
              testResult.metadata.synthesized + 
              testResult.metadata.omitted;
  
  assert(sum === testResult.metadata.totalEntries, 
    `metadata accounts for all entries (${sum} === ${testResult.metadata.totalEntries})`);

  // ─── Results ────────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL DEDUP BUILD TESTS PASSED\n');
    return 0;
  } else {
    console.log(`❌ ${failed} test(s) failed\n`);
    return 1;
  }
}

// Run test
if (require.main === module) {
  testDedupBuild().then(code => process.exit(code));
}

module.exports = { testDedupBuild };
