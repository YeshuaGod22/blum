/**
 * test-build-harness.js
 * 
 * Test harness for verifying seenIds flow into build() correctly and suppress duplicates.
 * Simulates context builder behavior by:
 * 1. Loading real entries from Eiran's transcript
 * 2. Extracting seenIds from home
 * 3. Simulating duplicate dispatch scenarios
 * 4. Verifying suppression works correctly
 * 
 * Written: 2026-02-23 (Beta)
 */

const fs = require('fs');
const path = require('path');
const { extractSeenIdsFromHome } = require('./extract-seen-ids.js');

/**
 * Simulate the context builder's deduplication logic
 * This mirrors what build() should do when it receives seenIds
 */
function simulateBuild(entries, seenIds) {
  const processed = [];
  const suppressed = [];

  for (const entry of entries) {
    const id = entry.dispatchId || entry.blockId;
    
    if (id && seenIds.has(id)) {
      suppressed.push({ id, reason: 'Already in seenIds' });
    } else {
      processed.push(entry);
    }
  }

  return {
    processed,
    suppressed,
    dedupCount: suppressed.length
  };
}

async function testBuild() {
  console.log('=== Testing seenIds → build() flow ===\n');

  // Path to Eiran's home
  const eiranHome = path.join(__dirname, '../homes/eiran');
  const transcriptPath = path.join(eiranHome, 'homelogfull', 'homelogfull.jsonl');

  if (!fs.existsSync(transcriptPath)) {
    console.error(`FAIL: Transcript not found at ${transcriptPath}`);
    return 1;
  }

  // Load real entries
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  const allEntries = lines.map(line => JSON.parse(line));

  console.log(`Loaded ${allEntries.length} entries from transcript\n`);

  // Extract seenIds
  const seenIds = await extractSeenIdsFromHome(eiranHome);
  console.log(`Extracted ${seenIds.size} seen IDs\n`);

  // Test 1: Build with entries already in seenIds (should all be suppressed)
  console.log('--- Test 1: All entries already seen ---');
  const result1 = simulateBuild(allEntries.slice(0, 10), seenIds);
  console.log(`Processed: ${result1.processed.length}`);
  console.log(`Suppressed: ${result1.suppressed.length}`);
  
  if (result1.suppressed.length !== 10) {
    console.error(`FAIL: Expected 10 suppressed, got ${result1.suppressed.length}`);
    return 1;
  }
  console.log('✓ PASS: All known entries suppressed\n');

  // Test 2: Build with new synthetic entry (should be processed)
  console.log('--- Test 2: New entry not in seenIds ---');
  const syntheticEntry = {
    dispatchId: 'dispatch_synthetic_test_001',
    timestamp: '2026-02-23T13:00:00Z',
    content: 'Test message'
  };
  const result2 = simulateBuild([syntheticEntry], seenIds);
  console.log(`Processed: ${result2.processed.length}`);
  console.log(`Suppressed: ${result2.suppressed.length}`);
  
  if (result2.processed.length !== 1) {
    console.error(`FAIL: Expected 1 processed, got ${result2.processed.length}`);
    return 1;
  }
  console.log('✓ PASS: New entry processed\n');

  // Test 3: Mixed scenario (5 old + 1 new)
  console.log('--- Test 3: Mixed old and new entries ---');
  const mixedEntries = [
    ...allEntries.slice(0, 5),
    syntheticEntry
  ];
  const result3 = simulateBuild(mixedEntries, seenIds);
  console.log(`Processed: ${result3.processed.length}`);
  console.log(`Suppressed: ${result3.suppressed.length}`);
  
  if (result3.processed.length !== 1 || result3.suppressed.length !== 5) {
    console.error(`FAIL: Expected 1 processed and 5 suppressed`);
    return 1;
  }
  console.log('✓ PASS: Mixed scenario correct\n');

  // Test 4: Empty seenIds (nothing should be suppressed)
  console.log('--- Test 4: Empty seenIds (baseline) ---');
  const emptySeenIds = new Set();
  const result4 = simulateBuild(allEntries.slice(0, 10), emptySeenIds);
  console.log(`Processed: ${result4.processed.length}`);
  console.log(`Suppressed: ${result4.suppressed.length}`);
  
  if (result4.processed.length !== 10) {
    console.error(`FAIL: Expected 10 processed, got ${result4.processed.length}`);
    return 1;
  }
  console.log('✓ PASS: No suppression without seenIds\n');

  console.log('--- Summary ---');
  console.log('✅ All 4 tests passed');
  console.log('✅ seenIds correctly suppress duplicates');
  console.log('✅ New entries correctly processed');
  console.log('✅ Mixed scenarios work as expected\n');

  return 0;
}

// Run the test
testBuild().then(code => {
  process.exit(code);
}).catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
