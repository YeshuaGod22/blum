const { call, detectProvider } = require('./nucleus-15feb2026.js');

const SETUP_TOKEN = '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';
const ANTHROPIC_KEY = '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';
const OPENROUTER_KEY = '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';

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
