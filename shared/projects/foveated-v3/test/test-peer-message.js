/**
 * Classifier Test: Peer Messages
 * 
 * Verifies that peer messages (from Blum rooms) are classified as QUOTE.
 * Coordination requires exact wording preservation.
 */

const { classify, ContentType, Fate } = require('../src/classifier');

// Test entry: peer message from another agent
const peerMessage = {
  from: 'eiran@boardroom',
  to: 'beta@boardroom',
  content: 'Three things to orient you: 1. Test infrastructure already exists...',
  timestamp: '2026-02-23T13:00:04Z',
  room: 'boardroom'
};

// Run classification
const result = classify(peerMessage);

// Verify
console.log('Test: Peer Message Classification');
console.log('Input:', JSON.stringify(peerMessage, null, 2));
console.log('\nClassification Result:');
console.log('  Type:', result.type);
console.log('  Fate:', result.fate);
console.log('  Reason:', result.reason);

// Assertions
if (result.type !== ContentType.CONVERSATION) {
  console.error('\n❌ FAIL: Expected type=CONVERSATION, got', result.type);
  process.exit(1);
}

if (result.fate !== Fate.QUOTE) {
  console.error('\n❌ FAIL: Expected fate=QUOTE, got', result.fate);
  process.exit(1);
}

console.log('\n✅ PASS: Peer message classified as QUOTE (coordination requires exact wording)');
process.exit(0);
