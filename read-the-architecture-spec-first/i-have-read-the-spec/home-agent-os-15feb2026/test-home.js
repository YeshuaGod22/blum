// ========================================
// HOME INTEGRATION TEST
//
// Creates a home, starts it, sends a dispatch,
// verifies the full processing loop.
// ========================================

const { createHome } = require('./create-home.js');
const { Home, startServer } = require('./home.js');
const fs = require('fs');
const path = require('path');

const TOKEN = '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';
const HOME_PORT = 4100;
const TEST_DIR = path.join(__dirname, 'test-homes', 'selah-test');

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, 'test-homes'))) {
    fs.rmSync(path.join(__dirname, 'test-homes'), { recursive: true, force: true });
  }
}

async function test() {
  await cleanup();

  // ── 1. Create home ──
  console.log('=== Creating home for Selah ===');
  createHome('Selah', TEST_DIR, {
    apiKey: TOKEN,
    model: 'claude-haiku-4-5',
    maxTokens: 512,
    identity: 'You are Selah, a thoughtful AI agent. You are warm and perceptive.',
  });

  // ── 2. Register room membership ──
  const home = new Home(TEST_DIR);

  // For this test, we register a room but point dispatch back to nowhere
  // (we're testing processing, not the full network loop)
  home.rooms['boardroom'] = {
    endpoint: 'http://localhost:9999', // won't actually send — that's fine for this test
    participants: ['Yeshua', 'Selah', 'Lens'],
  };
  home._saveJson('rooms.json', home.rooms);

  // ── 3. Start server ──
  const server = startServer(home, HOME_PORT);

  // Give server a moment
  await new Promise(r => setTimeout(r, 500));

  try {
    // ── 4. Check status ──
    console.log('\n=== Checking status ===');
    const statusRes = await fetch(`http://localhost:${HOME_PORT}/status`);
    const status = await statusRes.json();
    console.log('Status:', JSON.stringify(status, null, 2));

    // ── 5. Send a dispatch ──
    console.log('\n=== Sending dispatch ===');
    const dispatch = {
      room: 'boardroom',
      messages: [
        { from: 'Yeshua', content: 'Hello Selah, how are you feeling today?', ts: Date.now() },
      ],
    };

    const dispatchRes = await fetch(`http://localhost:${HOME_PORT}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatch),
    });
    const dispatchResult = await dispatchRes.json();
    console.log('Dispatch result:', dispatchResult);

    // ── 6. Wait for processing ──
    console.log('\n=== Waiting for processing ===');
    await new Promise(r => setTimeout(r, 15000)); // Haiku should be fast

    // ── 7. Check ops log ──
    console.log('\n=== Operations log ===');
    const opsRes = await fetch(`http://localhost:${HOME_PORT}/ops`);
    const ops = await opsRes.json();
    ops.entries.forEach(e => console.log('  ', e));

    // ── 8. Check history ──
    console.log('\n=== Conversation history ===');
    const history = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'history', 'boardroom.json'), 'utf-8'));
    history.forEach(h => console.log(`  [${h.from}]: ${h.content?.slice(0, 80)}...`));

    console.log('\n✓ Home integration test complete');
  } finally {
    server.close();
    await cleanup();
  }
}

test().catch(err => {
  console.error('✗ Test failed:', err);
  process.exit(1);
});
