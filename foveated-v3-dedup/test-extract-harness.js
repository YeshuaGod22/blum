/**
 * test-extract-harness.js
 * 
 * Test harness for extractSeenIdsFromHome() using real data from Eiran's home transcript.
 * Verifies that:
 * 1. The function returns a Set of IDs
 * 2. IDs extracted match dispatchIds from the actual transcript
 * 3. Sample verification against known entries works
 * 
 * Written: 2026-02-23 (Beta)
 */

const fs = require('fs');
const path = require('path');
const { extractSeenIdsFromHome } = require('./extract-seen-ids.js');

async function testExtraction() {
  console.log('=== Testing extractSeenIdsFromHome() ===\n');

  // Path to Eiran's home (95 entries confirmed by Eiran)
  const eiranHome = path.join(__dirname, '../homes/eiran');
  const transcriptPath = path.join(eiranHome, 'homelogfull', 'homelogfull.jsonl');

  // Verify the transcript exists
  if (!fs.existsSync(transcriptPath)) {
    console.error(`FAIL: Transcript not found at ${transcriptPath}`);
    return 1;
  }

  console.log(`Reading transcript: ${transcriptPath}`);
  
  // Extract seen IDs
  const seenIds = await extractSeenIdsFromHome(eiranHome);
  
  console.log(`\n✓ Extracted ${seenIds.size} unique IDs\n`);

  // Manual verification: read first 5 entries and check their dispatchIds are in the set
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  console.log(`Total lines in transcript: ${lines.length}`);
  console.log('\n--- Manual verification (first 5 entries) ---\n');

  let verifiedCount = 0;
  let failCount = 0;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    try {
      const entry = JSON.parse(lines[i]);
      const dispatchId = entry.dispatchId;
      
      if (!dispatchId) {
        console.log(`Line ${i + 1}: No dispatchId present (skipping)`);
        continue;
      }

      if (seenIds.has(dispatchId)) {
        console.log(`Line ${i + 1}: ✓ ${dispatchId} found in seenIds`);
        verifiedCount++;
      } else {
        console.error(`Line ${i + 1}: ✗ ${dispatchId} NOT in seenIds`);
        failCount++;
      }
    } catch (err) {
      console.error(`Line ${i + 1}: Parse error - ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n--- Results ---`);
  console.log(`Verified: ${verifiedCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    console.error('\nFAIL: Some dispatchIds were not found in seenIds');
    return 1;
  }

  console.log('\n✅ PASS: All sampled dispatchIds found in seenIds\n');
  return 0;
}

// Run the test
testExtraction().then(code => {
  process.exit(code);
}).catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
