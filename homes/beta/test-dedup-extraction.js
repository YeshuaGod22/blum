/**
 * Test: Dedup Seen IDs Extraction
 * 
 * Tests extractSeenIdsFromHome() with real home transcript data.
 * Verifies that seen IDs are correctly extracted from homelogfull.jsonl.
 * 
 * Author: Beta
 * Date: 2026-02-23
 * Fixed: 2026-02-23 — Test 2 prefix corrected from 'dispatch_' to 'disp_' (Eiran)
 */

const path = require('path');
const fs = require('fs');
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

async function testDedupExtraction() {
  console.log('\n=== DEDUP EXTRACTION TEST ===\n');

  // Test 1: Extract from Eiran's home (95 entries confirmed)
  console.log('Test 1: Extract seen IDs from real transcript');
  const eiranHome = path.join(__dirname, '../../../../homes/eiran');
  const eiranTranscript = path.join(eiranHome, 'homelogfull', 'homelogfull.jsonl');

  // Verify file exists
  if (!fs.existsSync(eiranTranscript)) {
    console.error(`❌ FAIL: Transcript not found at ${eiranTranscript}`);
    failed++;
    return 1;
  }
  console.log(`  ℹ Found transcript: ${eiranTranscript}`);

  // Extract seen IDs
  const seenIds = await extractSeenIdsFromHome(eiranHome);
  
  assert(seenIds instanceof Set, 'extractSeenIdsFromHome returns a Set');
  assert(seenIds.size > 0, `extracted non-zero IDs (found ${seenIds.size})`);

  // Test 2: Verify ID format
  console.log('\nTest 2: Verify extracted ID formats');
  let hasDispatchIds = false;
  let hasBlockIds = false;
  
  for (const id of seenIds) {
    if (id.startsWith('disp_')) hasDispatchIds = true;
    if (id.startsWith('msg_') || id.startsWith('think_')) hasBlockIds = true;
    if (hasDispatchIds && hasBlockIds) break;
  }

  assert(hasDispatchIds, 'extracted set contains dispatch IDs');
  console.log(`  ℹ Found ${[...seenIds].filter(id => id.startsWith('disp_')).length} dispatch IDs`);
  
  if (hasBlockIds) {
    console.log(`  ℹ Found ${[...seenIds].filter(id => id.startsWith('msg_') || id.startsWith('think_')).length} block IDs`);
  }

  // Test 3: Manual verification against first 5 entries
  console.log('\nTest 3: Manual verification against raw transcript');
  const content = fs.readFileSync(eiranTranscript, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  let verifiedCount = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const entry = JSON.parse(lines[i]);
    
    if (entry.dispatchId) {
      const found = seenIds.has(entry.dispatchId);
      assert(found, `entry ${i + 1} dispatchId "${entry.dispatchId}" is in seenIds`);
      if (found) verifiedCount++;
    }

    // Check blockIds if present
    if (entry.parsedOutput?.messages) {
      for (const msg of entry.parsedOutput.messages) {
        if (msg.blockId && seenIds.has(msg.blockId)) {
          verifiedCount++;
        }
      }
    }
  }

  console.log(`  ℹ Verified ${verifiedCount} IDs from first 5 entries`);

  // Test 4: Empty home (edge case)
  console.log('\nTest 4: Empty home edge case');
  const emptyHome = path.join(__dirname, '../../../../homes/nonexistent-agent');
  const emptySeenIds = await extractSeenIdsFromHome(emptyHome);
  assert(emptySeenIds.size === 0, 'nonexistent home returns empty Set (not error)');

  // Results
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL DEDUP EXTRACTION TESTS PASSED\n');
    return 0;
  } else {
    console.log(`❌ ${failed} test(s) failed\n`);
    return 1;
  }
}

// Run test
if (require.main === module) {
  testDedupExtraction().then(code => process.exit(code));
}

module.exports = { testDedupExtraction };
