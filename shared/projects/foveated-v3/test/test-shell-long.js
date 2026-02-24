/**
 * Test: shell_exec with long output
 * 
 * Expected behavior:
 * - Type: TOOL
 * - Fate: SYNTHESIZE (shell_exec is in SYNTHESIZE_TOOLS list)
 * - Reason: Should compress with UID pointer
 * 
 * Note: shell_exec is ALWAYS SYNTHESIZE regardless of output length,
 * because it's in the SYNTHESIZE_TOOLS list. This test verifies that
 * the classification doesn't change even with very large outputs.
 */

const { classify, ContentType, Fate } = require('../src/classifier.js');

function runTest() {
  console.log('=== Test: shell_exec with long output ===\n');
  
  // Generate a large output (simulating a file listing or log dump)
  const largeOutput = Array(500).fill('').map((_, i) => 
    `line ${i.toString().padStart(4, '0')}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
  ).join('\n');
  
  // Sample entry: shell_exec with large output
  const entry = {
    role: 'tool',
    tool: 'shell_exec',
    output: largeOutput,
    timestamp: '2026-02-23T12:58:00Z'
  };
  
  const result = classify(entry);
  
  console.log('Input entry (truncated):');
  console.log({
    role: entry.role,
    tool: entry.tool,
    output: `${entry.output.substring(0, 100)}... (${entry.output.length} chars total)`,
    timestamp: entry.timestamp
  });
  
  console.log('\nClassification result:', JSON.stringify(result, null, 2));
  
  // Verify expectations
  const passed = 
    result.type === ContentType.TOOL &&
    result.fate === Fate.SYNTHESIZE;
  
  console.log('\n--- Test Result ---');
  console.log('Expected: type=TOOL, fate=SYNTHESIZE');
  console.log('Actual:', `type=${result.type}, fate=${result.fate}`);
  console.log('Output size:', entry.output.length, 'characters');
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
