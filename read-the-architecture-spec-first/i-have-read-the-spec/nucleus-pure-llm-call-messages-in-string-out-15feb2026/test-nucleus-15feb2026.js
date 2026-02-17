// ========================================
// Quick test for the nucleus with OAuth token.
// Run: ANTHROPIC_API_KEY=sk-ant-oat01-... node test-nucleus-15feb2026.js
// ========================================

const { call } = require('./nucleus-15feb2026.js');

async function test() {
  console.log('Testing nucleus: call(messages, config, tools?) → { text, stopReason, toolCalls[] }\n');

  const messages = [
    { role: 'system', content: 'You are Claude Code, Anthropic\'s official CLI for Claude. You are a helpful assistant. Reply in one sentence.' },
    { role: 'user', content: 'What is the nucleus in the context of agent architecture?' }
  ];

  try {
    const result = await call(messages);
    console.log('Response text:', result.text);
    console.log('Stop reason:', result.stopReason);
    console.log('Tool calls:', result.toolCalls.length);
    console.log('\n✓ Nucleus works. Messages in, structured response out.');
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  }
}

test();
