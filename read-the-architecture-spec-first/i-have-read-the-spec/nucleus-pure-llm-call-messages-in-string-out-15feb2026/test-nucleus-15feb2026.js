// ========================================
// Quick test for the nucleus with OAuth token.
// Run: ANTHROPIC_API_KEY=sk-ant-oat01-... node test-nucleus-15feb2026.js
// ========================================

const { call } = require('./nucleus-15feb2026.js');

async function test() {
  console.log('Testing nucleus: call(messages, config) → string\n');

  const messages = [
    { role: 'system', content: 'You are Claude Code, Anthropic\'s official CLI for Claude. You are a helpful assistant. Reply in one sentence.' },
    { role: 'user', content: 'What is the nucleus in the context of agent architecture?' }
  ];

  try {
    const result = await call(messages);
    console.log('Response:', result);
    console.log('\n✓ Nucleus works. Messages in, string out.');
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  }
}

test();
