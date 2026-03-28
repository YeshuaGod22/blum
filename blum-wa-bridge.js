#!/usr/bin/env node
// ========================================
// BLUM WhatsApp Bridge  (wacli-direct)
// 27 Mar 2026
//
// Self-contained: talks to wacli CLI directly.
// No OpenClaw dependency.
//
// 1. Spawns `wacli sync --follow` to stay connected
// 2. Polls `wacli messages list` for new inbound messages
// 3. Parses /commands or routes plain text to current room
// 4. Replies via `wacli send text`
//
// Commands:
//   /room <name>     — switch current room
//   /rooms           — list all rooms
//   /status          — fleet health check
//   /history [n]     — last n messages (default 10)
//   /help            — show commands
//
// Usage:
//   node blum-wa-bridge.js [--self-jid 447504836504@s.whatsapp.net]
//
// Requires: wacli authenticated (`wacli auth` first)
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync, spawn } = require('child_process');
// ── Config ────────────────────────────────
const ROOM_SERVER = 'http://localhost:3141';
const SENDER = 'yeshua';
const STATE_FILE = path.join(__dirname, 'shared', 'wa-bridge-state.json');
const POLL_INTERVAL_MS = 5000; // check for new messages every 5s
const HTTP_PORT = 3142; // status/manual endpoint

// Parse --self-jid from args, or default to the number from the screenshot
let SELF_JID = '159347682357288@lid';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--self-jid' && process.argv[i + 1]) {
    SELF_JID = process.argv[i + 1];
  }
}

// ── State ─────────────────────────────────
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { currentRoom: 'boardroom', lastSeenId: null, lastSeenTs: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
// ── wacli helpers ─────────────────────────
function wacli(args) {
  try {
    const out = execSync(`wacli ${args}`, { encoding: 'utf-8', timeout: 30000 });
    return JSON.parse(out);
  } catch (e) {
    console.error(`[wacli] Error: ${e.message}`);
    return null;
  }
}

function waReply(text) {
  try {
    // Use spawnSync with argv array to preserve newlines
    // (shell string interpolation mangles them)
    const r = spawnSync('wacli', ['send', 'text', '--to', SELF_JID, '--message', text], {
      timeout: 15000, encoding: 'utf-8',
    });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || `exit ${r.status}`);
    return true;
  } catch (e) {
    console.error(`[wacli:send] Error: ${e.message}`);
    return false;
  }
}

// ── HTTP fetch (for room server) ──────────
function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = opts.body || null;
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, json: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, text: data }); }
      });
    });
    req.on('error', e => reject(e));
    if (payload) req.write(payload);
    req.end();
  });
}
// ── Command handlers ──────────────────────
async function handleCommand(text) {
  const state = loadState();
  const trimmed = text.trim();

  if (/^\/help$/i.test(trimmed)) {
    return [
      'Blum WhatsApp Bridge',
      '',
      'Commands:',
      '/room <name> — Switch to a different room (e.g. /room cochairs)',
      '/rooms — Show all available rooms and who\'s in them',
      '/status — Check which agent homes are up or down',
      '/history [n] — Show the last n messages in the current room (default 10)',
      '/help — Show this message',
      '',
      `You're currently in: ${state.currentRoom}`,
      '',
      'Anything you type that isn\'t a command gets sent to the current room as yeshua.',
    ].join('\n');
  }

  const roomMatch = trimmed.match(/^\/room\s+(\S+)$/i);
  if (roomMatch) {
    const name = roomMatch[1].toLowerCase();
    const res = await fetchJson(`${ROOM_SERVER}/api/rooms`);
    if (!res.ok) return 'Room server unreachable';
    const rooms = res.json;
    if (!rooms[name]) {
      return `Room "${name}" not found.\nAvailable: ${Object.keys(rooms).join(', ')}`;
    }
    state.currentRoom = name;
    saveState(state);
    const participants = rooms[name].participants || [];
    return `Now in: ${name}\n${participants.join(', ')}`;
  }

  if (/^\/rooms$/i.test(trimmed)) {
    const res = await fetchJson(`${ROOM_SERVER}/api/rooms`);
    if (!res.ok) return 'Room server unreachable';
    const lines = Object.entries(res.json).map(([name, room]) => {
      const p = (room.participants || []).length;
      const marker = name === state.currentRoom ? ' <' : '';
      return `${name} (${p})${marker}`;
    });
    return `Rooms:\n${lines.join('\n')}`;
  }

  if (/^\/status$/i.test(trimmed)) {
    const res = await fetchJson(`${ROOM_SERVER}/api/directory`);
    if (!res.ok) return 'Room server unreachable';
    const dir = res.json;
    const agents = Object.keys(dir);
    let up = 0, down = 0, downList = [];
    const probes = agents.map(async (name) => {
      const entry = dir[name];
      if (!entry.endpoint) { down++; downList.push(name); return; }
      try {
        const r = await fetchJson(`${entry.endpoint}/status`);
        if (r.ok) up++; else { down++; downList.push(name); }
      } catch { down++; downList.push(name); }
    });
    await Promise.all(probes);
    let msg = `${up}/${agents.length} homes up`;
    if (down > 0) msg += `\nDown: ${downList.join(', ')}`;
    msg += `\nRoom: ${state.currentRoom}`;
    return msg;
  }

  const histMatch = trimmed.match(/^\/history(?:\s+(\d+))?$/i);
  if (histMatch) {
    const limit = parseInt(histMatch[1] || '10', 10);
    const res = await fetchJson(`${ROOM_SERVER}/api/rooms`);
    if (!res.ok) return 'Room server unreachable';
    const room = res.json[state.currentRoom];
    if (!room) return `Room "${state.currentRoom}" not found`;
    const chatlog = room.chatlog || [];
    const recent = chatlog.slice(-limit);
    if (recent.length === 0) return `No messages in ${state.currentRoom}`;
    const lines = recent.map(m => {
      const time = m.ts ? new Date(m.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '??:??';
      const to = m.to ? ` > ${m.to}` : '';
      const body = (m.body || '').slice(0, 200);
      return `[${time}] ${m.from}${to}: ${body}`;
    });
    return `${state.currentRoom} (last ${recent.length}):\n\n${lines.join('\n\n')}`;
  }

  // Plain text → send to current room
  const sendRes = await fetchJson(`${ROOM_SERVER}/api/message/send`, {
    method: 'POST',
    body: JSON.stringify({ from: SENDER, room: state.currentRoom, body: trimmed, to: null }),
  });
  if (!sendRes.ok) return `Send failed: ${JSON.stringify(sendRes.json || sendRes.text)}`;
  return `[${state.currentRoom}] sent`;
}

// ── Sync helper (one-shot, releases lock when done) ──
function syncOnce() {
  try {
    execSync('wacli sync', { timeout: 30000, encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    // sync may warn but still succeed; only log real errors
    if (!/already up.to.date/i.test(e.message)) {
      console.error(`[sync] ${e.stderr || e.message}`);
    }
  }
}

// ── Polling loop ─────────────────────────
let polling = false;

async function pollMessages() {
  if (polling) return;
  polling = true;
  try {
    // Sync first (one-shot — grabs new messages, then releases lock)
    syncOnce();

    const state = loadState();
    const afterFlag = state.lastSeenTs ? `--after "${state.lastSeenTs}"` : '--limit 1';
    const raw = wacli(`messages list --chat "${SELF_JID}" ${afterFlag} --json`);
    // wacli wraps in { success, data: { messages: [...] } }
    const messages = raw?.data?.messages || raw?.messages || (Array.isArray(raw) ? raw : null);
    if (!messages || !Array.isArray(messages)) { polling = false; return; }

    // Filter to only messages we haven't processed
    const newMsgs = messages.filter(m => {
      if (m.MsgID === state.lastSeenId) return false;
      // Only process messages FROM us (self-chat)
      if (m.FromMe !== true) return false;
      // Skip if older than lastSeenTs
      if (state.lastSeenTs && m.Timestamp && m.Timestamp <= state.lastSeenTs) return false;
      return true;
    });

    for (const msg of newMsgs) {
      const body = (msg.Text || msg.DisplayText || '').trim();
      if (!body || body === '(message)') continue;
      // Skip messages that look like bridge replies (our own output)
      if (body.startsWith('Blum WhatsApp Bridge') || (body.startsWith('[') && body.includes('sent'))) continue;

      console.log(`[poll] New message: "${body.slice(0, 80)}"`);
      try {
        const reply = await handleCommand(body);
        if (reply) {
          waReply(reply);
          console.log(`[poll] Replied: "${reply.slice(0, 80)}…"`);
        }
      } catch (e) {
        console.error(`[poll] Handler error: ${e.message}`);
        waReply(`Error: ${e.message}`);
      }

      // Update watermark
      state.lastSeenId = msg.MsgID || null;
      state.lastSeenTs = msg.Timestamp || state.lastSeenTs;
      saveState(state);
    }
  } catch (e) {
    console.error(`[poll] Error: ${e.message}`);
  }
  polling = false;
}

// ── HTTP status endpoint ─────────────────
function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/status') {
      const state = loadState();
      const authResult = wacli('auth status --json');
      res.writeHead(200);
      res.end(JSON.stringify({
        bridge: 'blum-wa-bridge',
        version: 'wacli-direct',
        currentRoom: state.currentRoom,
        lastSeenTs: state.lastSeenTs,
        selfJid: SELF_JID,
        waAuth: authResult,
        syncMode: 'one-shot-per-cycle',
        uptime: process.uptime(),
      }));
      return;
    }

    // POST /send — manual send endpoint (for other Blum components)
    if (req.method === 'POST' && req.url === '/send') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { text } = JSON.parse(body);
          if (!text) { res.writeHead(400); res.end('{"error":"missing text"}'); return; }
          const ok = waReply(text);
          res.writeHead(ok ? 200 : 500);
          res.end(JSON.stringify({ sent: ok }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('{"error":"not found"}');
  });

  server.listen(HTTP_PORT, () => {
    console.log(`[http] Status server on port ${HTTP_PORT}`);
  });
}

// ── Main ─────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   BLUM WhatsApp Bridge (wacli)       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Self JID:  ${SELF_JID}`);
  console.log(`  Room srv:  ${ROOM_SERVER}`);
  console.log(`  Poll:      ${POLL_INTERVAL_MS}ms`);
  console.log(`  HTTP:      :${HTTP_PORT}`);
  console.log('');

  // Check wacli auth
  const auth = wacli('auth status --json');
  if (!auth || auth.authenticated === false) {
    console.error('⚠  wacli is NOT authenticated.');
    console.error('   Run: wacli auth     (scan QR code)');
    console.error('   Bridge will start anyway — polling will fail until auth completes.');
    console.error('');
  } else {
    console.log('✓  wacli authenticated');
  }

  // Check room server
  try {
    const r = await fetchJson(`${ROOM_SERVER}/api/rooms`);
    if (r.ok) {
      const rooms = Object.keys(r.json);
      console.log(`✓  Room server reachable (${rooms.length} rooms)`);
    } else {
      console.error('⚠  Room server responded but not OK');
    }
  } catch {
    console.error('⚠  Room server unreachable at ' + ROOM_SERVER);
  }

  const state = loadState();
  console.log(`✓  Current room: ${state.currentRoom}`);
  console.log('');

  // Start components
  startHttpServer();

  // Start polling (sync + poll in each cycle — no persistent lock)
  console.log('[poll] Starting message poll loop (sync-then-poll each cycle)…');
  setInterval(pollMessages, POLL_INTERVAL_MS);

  // Initial poll
  setTimeout(pollMessages, 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[bridge] Shutting down…');
    process.exit(0);
  });
  process.on('SIGTERM', () => process.exit(0));
}

main().catch(e => {
  console.error(`[fatal] ${e.message}`);
  process.exit(1);
});