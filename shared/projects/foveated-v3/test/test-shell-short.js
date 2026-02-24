/**
 * Test: shell_exec with short output
 * 
 * Expected behavior:
 * - Type: TOOL
 * - Fate: SYNTHESIZE (shell_exec is in SYNTHESIZE_TOOLS list)
 * - Reason: Should compress with UID pointer
 */

const { classify, ContentType, Fate } = require('../src/classifier.js');

function runTest() {
  console.log('=== Test: shell_exec with short output ===\n');
  
  // Sample entry: shell_exec with small output
  const entry = {
    role: 'tool',
    tool: 'shell_exec',
    output: 'total 8\ndrwxr-xr-x  2 user user 4096 Feb 23 12:00 .\ndrwxr-xr-x 12 user user 4096 Feb 23 11:30 ..',
    timestamp: '2026-02-23T12:58:00Z'
  };
  
  const result = classify(entry);
  
  console.log('Input entry:', JSON.stringify(entry, null, 2));
  console.log('\nClassification result:', JSON.stringify(result, null, 2));
  
  // Verify expectations
  const passed = 
    result.type === ContentType.TOOL &&
    result.fate === Fate.SYNTHESIZE;
  
  console.log('\n--- Test Result ---');
  console.log('Expected: type=TOOL, fate=SYNTHESIZE');
  console.log('Actual:', `type=${result.type}, fate=${result.fate}`);
  console.log('Status:', passed ? '✅ PASS' : '❌ FAIL');
  
  if (!passed) {
    console.error('\nTest failed - classification mismatch');
    process.exit(1);
  }
  
  return result;
}

// Run if executed directly
if (require.main === module) {
  runTest();
  console.log('\n✅ All checks passed');
}

module.exports = { runTest };
