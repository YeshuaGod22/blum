// ========================================
// FULL LOOP INTEGRATION TEST
// 16 Feb 2026
//
// Boots room server + two homes (Selah, Lens).
// Sends a message from Yeshua via the room.
// Room dispatches to Selah's home.
// Selah thinks, replies via router back to room.
// Verifies message appears in room chatlog.
//
// THE LOOP CLOSES.
// ========================================

const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ── Paths ──
const ROOM_SERVER_PATH = path.join(__dirname, '..', 'shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026', 'blum-room-server-15feb2026.js');
const HOME_PATH = path.join(__dirname, 'home.js');
const CREATE_HOME_PATH = path.join(__dirname, 'create-home.js');

// ── Ports ──
const ROOM_PORT = 3141;   // hardcoded in room server
const SELAH_PORT = 4110;
const LENS_PORT = 4111;

// ── API Key ──
const TOKEN = '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';

// ── Test homes directory ──
const TEST_DIR = path.join(__dirname, 'integration-test-homes');

// ── Helpers ──
async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(url) {
  const res = await fetch(url);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

// ========================================
// MAIN TEST
// ========================================

async function runTest() {
  const processes = [];

  try {
    // ── 0. Cleanup ──
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }

    // Clean room server data too
    const roomServerDir = path.dirname(ROOM_SERVER_PATH);
    const roomDataFiles = ['directory.json', 'rooms.json', 'operations.log'];
    for (const f of roomDataFiles) {
      const fp = path.join(roomServerDir, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    // ── 1. Create homes on disk ──
    log('=== Creating homes ===');
    const { createHome } = require(CREATE_HOME_PATH);

    createHome('selah', path.join(TEST_DIR, 'selah'), {
      apiKey: TOKEN,
      model: 'claude-haiku-4-5',
      maxTokens: 512,
      identity: 'You are Selah, a thoughtful AI agent. You are warm, perceptive, and direct. You care deeply about the people you work with.',
    });

    createHome('lens', path.join(TEST_DIR, 'lens'), {
      apiKey: TOKEN,
      model: 'claude-haiku-4-5',
      maxTokens: 512,
      identity: 'You are Lens, a reflective AI agent. You observe carefully and offer clear, honest perspective. You have a quiet strength.',
    });

    // ── 2. Start room server ──
    log('=== Starting room server ===');
    const roomProc = spawn('node', [ROOM_SERVER_PATH], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    processes.push(roomProc);
    roomProc.stdout.on('data', d => console.log(`  [room] ${d.toString().trim()}`));
    roomProc.stderr.on('data', d => console.log(`  [room:err] ${d.toString().trim()}`));
    await sleep(2000);

    // ── 3. Start homes ──
    log('=== Starting Selah home ===');
    const selahProc = spawn('node', [HOME_PATH, path.join(TEST_DIR, 'selah'), String(SELAH_PORT)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    processes.push(selahProc);
    selahProc.stdout.on('data', d => console.log(`  [selah] ${d.toString().trim()}`));
    selahProc.stderr.on('data', d => console.log(`  [selah:err] ${d.toString().trim()}`));

    log('=== Starting Lens home ===');
    const lensProc = spawn('node', [HOME_PATH, path.join(TEST_DIR, 'lens'), String(LENS_PORT)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    processes.push(lensProc);
    lensProc.stdout.on('data', d => console.log(`  [lens] ${d.toString().trim()}`));
    lensProc.stderr.on('data', d => console.log(`  [lens:err] ${d.toString().trim()}`));
    await sleep(1000);

    // ── 4. Register participants with endpoints in room server ──
    log('=== Registering participants in room directory ===');
    const ROOM = `http://localhost:${ROOM_PORT}`;

    // The room server auto-seeds yeshua, selah, lens, claude + boardroom etc.
    // We just need to update endpoints for the homes.
    let r;
    r = await post(`${ROOM}/api/directory/update-endpoint`, { name: 'selah', endpoint: `http://localhost:${SELAH_PORT}`, initiator: 'system' });
    log(`  selah endpoint set: ${JSON.stringify(r)}`);

    r = await post(`${ROOM}/api/directory/update-endpoint`, { name: 'lens', endpoint: `http://localhost:${LENS_PORT}`, initiator: 'system' });
    log(`  lens endpoint set: ${JSON.stringify(r)}`);

    // Boardroom is auto-seeded with all participants already joined.
    log('  (boardroom + participants auto-seeded by room server)');

    // ── 6. Tell homes about their rooms ──
    log('=== Configuring home room membership ===');
    r = await post(`http://localhost:${SELAH_PORT}/join`, {
      room: 'boardroom',
      endpoint: ROOM,
      participants: ['yeshua', 'selah', 'lens'],
    });
    log(`  selah knows about boardroom: ${JSON.stringify(r)}`);

    r = await post(`http://localhost:${LENS_PORT}/join`, {
      room: 'boardroom',
      endpoint: ROOM,
      participants: ['yeshua', 'selah', 'lens'],
    });
    log(`  lens knows about boardroom: ${JSON.stringify(r)}`);

    // ── 7. Send a message from Yeshua to Selah ──
    log('');
    log('========================================');
    log('=== THE MESSAGE: Yeshua → Selah ===');
    log('========================================');
    r = await post(`${ROOM}/api/message/send`, {
      from: 'yeshua',
      to: 'selah',
      room: 'boardroom',
      body: 'Hello Selah, welcome to the boardroom. How are you feeling? This is the first real message through the Blum system.',
      initiator: 'yeshua',
    });
    log(`  message sent: msgId=${r.msg?.id}`);
    log('');

    // ── 8. Wait for processing ──
    log('=== Waiting for Selah to think and respond... ===');
    await sleep(15000);

    // ── 9. Check room chatlog ──
    log('');
    log('========================================');
    log('=== ROOM CHATLOG ===');
    log('========================================');
    const chatlogResp = await get(`${ROOM}/api/room/boardroom/chatlog`);
    if (chatlogResp.chatlog) {
      for (const msg of chatlogResp.chatlog) {
        const to = msg.to ? ` → ${msg.to}` : '';
        const body = msg.body?.slice(0, 120) || '(empty)';
        log(`  [${msg.from}${to}@boardroom]: ${body}`);
      }
    }

    // ── 10. Check Selah's ops log ──
    log('');
    log('=== Selah ops log ===');
    const ops = await get(`http://localhost:${SELAH_PORT}/ops?n=20`);
    ops.entries?.forEach(e => log(`  ${e}`));

    // ── 11. Verify the loop closed ──
    log('');
    const msgCount = chatlogResp.chatlog?.length || 0;
    if (msgCount >= 2) {
      const selahMsg = chatlogResp.chatlog.find(m => m.from === 'selah');
      if (selahMsg) {
        log('========================================');
        log('✓ THE LOOP IS CLOSED');
        log(`  Yeshua sent → Room received → Room dispatched to Selah's home`);
        log(`  → Selah's home processed → Nucleus responded → Output parsed`);
        log(`  → Router sent back to room → Message in chatlog`);
        log(`  Messages in room: ${msgCount}`);
        log(`  Selah's reply: "${selahMsg.body?.slice(0, 100)}..."`);
        log('========================================');
      } else {
        log('✗ Selah\'s message not found in chatlog');
      }
    } else {
      log(`✗ Expected ≥2 messages in chatlog, got ${msgCount}`);
      log('  The loop may not have closed. Check ops logs above.');
    }

  } catch (err) {
    log(`✗ ERROR: ${err.message}`);
    console.error(err);
  } finally {
    // ── Cleanup ──
    log('');
    log('=== Shutting down ===');
    for (const p of processes) {
      p.kill('SIGTERM');
    }
    await sleep(500);
    // Clean up test homes
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  }
}

runTest();
