const { call, detectProvider } = require('./nucleus-15feb2026.js');

const SETUP_TOKEN = 'REDACTED-ANTHROPIC-KEY';
const ANTHROPIC_KEY = 'REDACTED-ANTHROPIC-KEY';
const OPENROUTER_KEY = 'REDACTED-OPENROUTER-KEY';

const prompt = [{ role: 'user', content: 'Reply with exactly one word: the name of your model family. Nothing else.' }];

async function test() {
  const tests = [
    { label: 'Anthropic setup token', apiKey: SETUP_TOKEN, model: 'claude-haiku-4-5' },
    { label: 'Anthropic API key',     apiKey: ANTHROPIC_KEY, model: 'claude-haiku-4-5' },
    { label: 'OpenRouter',            apiKey: OPENROUTER_KEY, model: 'anthropic/claude-3.5-haiku' },
  ];

  for (const t of tests) {
    const provider = detectProvider(t);
    process.stdout.write(`${t.label} (${provider}) → `);
    try {
      const result = await call(prompt, t);
      console.log(`✓ "${result.trim()}"`);
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 120)}`);
    }
  }
}

test();
