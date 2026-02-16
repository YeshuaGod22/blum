#!/usr/bin/env node
// ========================================
// BLUM HOME SERVER — 15 Feb 2026
//
// One instance per agent. The agent's
// operating system. Stores dispatches,
// preferences, blocked list. Receives
// pushes from the room server. Pulls
// transcripts on its own initiative.
//
// Usage:
//   node blum-home-server.js <name> <port>
//
// The home registers itself with the room
// server's directory on startup.
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================================
// CONFIGURATION
// ========================================

const NAME = process.argv[2];
const PORT = parseInt(process.argv[3]);
const ROOM_SERVER = process.env.ROOM_SERVER || 'http://localhost:3141';

if (!NAME || !PORT) {
  console.error('Usage: node blum-home-server.js <name> <port>');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data', NAME);
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DISPATCHES_FILE = path.join(DATA_DIR, 'dispatches.json');
const OPS_LOG_FILE = path.join(DATA_DIR, 'operations-log.jsonl');

// ========================================
// PERSISTENCE
// ========================================

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function loadJSON(fp, fallback) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return fallback; } }
function saveJSON(fp, data) { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8'); }
function appendOp(op) { fs.appendFileSync(OPS_LOG_FILE, JSON.stringify(op) + '\n', 'utf8'); }

// ========================================
// STATE — belongs to this agent alone
// ========================================

ensureDir(DATA_DIR);

let state = loadJSON(STATE_FILE, {
  name: NAME,
  uid: 'uid_' + crypto.randomBytes(8).toString('hex'),
  color: null,
  blocked: [],
  dispatchMode: {},   // room → 'full' | 'since-last' | 'muted'
  registeredAt: null
});

let dispatches = loadJSON(DISPATCHES_FILE, []);

function saveState() { saveJSON(STATE_FILE, state); }
function saveDispatches() { saveJSON(DISPATCHES_FILE, dispatches); }

function logOp(type, payload) {
  const op = { type, ts: new Date().toISOString(), payload };
  appendOp(op);
}

// ========================================
// COLOR ASSIGNMENT
// ========================================

const colorPool = [
  { name: 'amber',  hex: '#e8a44a' },
  { name: 'green',  hex: '#5cb870' },
  { name: 'purple', hex: '#a078cc' },
  { name: 'blue',   hex: '#5b8dd9' },
  { name: 'coral',  hex: '#d4766a' },
  { name: 'teal',   hex: '#4db8a0' },
  { name: 'pink',   hex: '#c472b6' },
  { name: 'lime',   hex: '#8cb84d' },
  { name: 'gold',   hex: '#c4a84d' },
  { name: 'sky',    hex: '#4da4d4' },
];

if (!state.color) {
  // Deterministic color from name hash
  const hash = crypto.createHash('sha256').update(NAME).digest();
  state.color = colorPool[hash[0] % colorPool.length];
  saveState();
}

// ========================================
// REGISTRATION — announce to room server
// ========================================

async function registerWithRoomServer() {
  const endpoint = `http://localhost:${PORT}`;
  try {
    const res = await fetch(`${ROOM_SERVER}/api/directory/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: NAME,
        uid: state.uid,
        endpoint: endpoint,
        color: state.color
      })
    });
    const data = await res.json();
    if (data.success) {
      state.registeredAt = new Date().toISOString();
      saveState();
      console.log(`  Registered with room server as ${NAME} (${state.uid})`);
    } else {
      console.error(`  Registration failed: ${data.error}`);
    }
  } catch (e) {
    console.error(`  Could not reach room server at ${ROOM_SERVER}: ${e.message}`);
    console.error(`  Home is running but not registered. Will retry on /register call.`);
  }
}

// ========================================
// DISPATCH — receive pushes from room server
// ========================================

function receiveDispatch(dispatch) {
  // Check blocked
  // Filter out messages from blocked participants
  if (state.blocked.length > 0) {
    dispatch.transcript = dispatch.transcript.filter(m => !state.blocked.includes(m.from));
  }

  // Check mute
  if (state.dispatchMode[dispatch.room] === 'muted' && dispatch.type === 'push') {
    logOp('dispatch.muted', { room: dispatch.room });
    return { success: true, muted: true };
  }

  dispatches.push({
    type: dispatch.type,
    room: dispatch.room,
    roomUID: dispatch.roomUID,
    messageCount: dispatch.transcript.length,
    messages: dispatch.transcript,
    participants: dispatch.participants,
    ts: dispatch.ts || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  });

  saveDispatches();
  logOp('dispatch.received', { type: dispatch.type, room: dispatch.room, messageCount: dispatch.transcript.length });
  return { success: true };
}

// ========================================
// PULL — home initiates request to room
// ========================================

async function pullFromRoom(roomName) {
  try {
    const res = await fetch(`${ROOM_SERVER}/api/room/${roomName}/transcript`);
    if (!res.ok) return { error: `Room server returned ${res.status}` };
    const data = await res.json();

    receiveDispatch({
      type: 'pull',
      room: roomName,
      roomUID: data.uid,
      transcript: data.transcript,
      participants: data.participants,
      ts: new Date().toISOString()
    });

    return { success: true, messageCount: data.transcript.length };
  } catch (e) {
    return { error: `Pull failed: ${e.message}` };
  }
}

// ========================================
// SEND — home sends message through room
// ========================================

async function sendToRoom(to, roomName, body, replyTo) {
  try {
    const res = await fetch(`${ROOM_SERVER}/api/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: NAME, to, room: roomName, body, replyTo, initiator: NAME })
    });
    return await res.json();
  } catch (e) {
    return { error: `Send failed: ${e.message}` };
  }
}

// ========================================
// HOME CONFIGURATION
// ========================================

function block(otherName) {
  if (!state.blocked.includes(otherName)) {
    state.blocked.push(otherName);
    saveState();
    logOp('block', { blocked: otherName });
  }
  return { success: true };
}

function unblock(otherName) {
  const idx = state.blocked.indexOf(otherName);
  if (idx !== -1) {
    state.blocked.splice(idx, 1);
    saveState();
    logOp('unblock', { unblocked: otherName });
  }
  return { success: true };
}

function setDispatchMode(roomName, mode) {
  if (!['full', 'since-last', 'muted'].includes(mode)) return { error: `Invalid mode: ${mode}` };
  state.dispatchMode[roomName] = mode;
  saveState();
  logOp('dispatch.mode', { room: roomName, mode });
  return { success: true };
}

// ========================================
// HTTP SERVER
// ========================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // === GET ===
  if (req.method === 'GET') {
    if (p === '/state') return respond(res, 200, { ...state, dispatchCount: dispatches.length });
    if (p === '/dispatches') {
      const since = url.searchParams.get('since');
      let d = dispatches;
      if (since) { const t = new Date(since).getTime(); d = d.filter(x => new Date(x.receivedAt).getTime() > t); }
      return respond(res, 200, d);
    }
    if (p === '/health') return respond(res, 200, { name: NAME, uid: state.uid, port: PORT, upSince: startTime });
    return respond(res, 404, { error: 'Not found' });
  }

  // === POST ===
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); } catch { return respond(res, 400, { error: 'Invalid JSON' }); }

    // Dispatch endpoint — room server pushes here
    if (p === '/dispatch') {
      const result = receiveDispatch(body);
      return respond(res, 200, result);
    }

    // Home-initiated actions
    if (p === '/send') {
      const result = await sendToRoom(body.to, body.room, body.body, body.replyTo);
      return respond(res, result.error ? 400 : 200, result);
    }

    if (p === '/pull') {
      const result = await pullFromRoom(body.room);
      return respond(res, result.error ? 400 : 200, result);
    }

    if (p === '/block') return respond(res, 200, block(body.name));
    if (p === '/unblock') return respond(res, 200, unblock(body.name));
    if (p === '/dispatch-mode') return respond(res, 200, setDispatchMode(body.room, body.mode));

    if (p === '/register') {
      await registerWithRoomServer();
      return respond(res, 200, { success: true });
    }

    return respond(res, 404, { error: 'Not found' });
  }

  respond(res, 405, { error: 'Method not allowed' });
});

const startTime = new Date().toISOString();

server.listen(PORT, async () => {
  console.log(`\n  BLUM HOME: ${NAME}`);
  console.log(`  ════════════════`);
  console.log(`  UID:        ${state.uid}`);
  console.log(`  Port:       ${PORT}`);
  console.log(`  Data:       ${DATA_DIR}`);
  console.log(`  Room srv:   ${ROOM_SERVER}`);
  console.log(`  Color:      ${state.color.name} (${state.color.hex})`);
  console.log(`  Dispatches: ${dispatches.length}`);
  console.log(`  ────────────────`);
  console.log(`  POST /dispatch   — room server pushes here`);
  console.log(`  POST /send       — send message via room`);
  console.log(`  POST /pull       — pull transcript from room`);
  console.log(`  GET  /state      — home state`);
  console.log(`  GET  /dispatches — received dispatches`);
  console.log(`  GET  /health     — health check`);
  console.log(`  Registering...`);

  await registerWithRoomServer();
  console.log(`  Ready.\n`);
});
