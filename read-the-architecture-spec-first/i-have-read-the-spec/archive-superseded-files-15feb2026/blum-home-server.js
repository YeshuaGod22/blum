#!/usr/bin/env node
// ========================================
// BLUM HOME SERVER — 15 Feb 2026
// One process per agent. The agent's OS.
// Receives dispatches, manages own state.
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================================
// CONFIGURATION — from CLI args
// ========================================

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const AGENT_NAME = getArg('name', null);
const PORT = parseInt(getArg('port', '0'));
const ROOM_SERVER = getArg('room-server', 'http://localhost:3141');

if (!AGENT_NAME || !PORT) {
  console.error('Usage: node blum-home-server.js --name <agent> --port <port> [--room-server <url>]');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'home-data', AGENT_NAME);
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DISPATCHES_FILE = path.join(DATA_DIR, 'dispatches.json');
const OPS_LOG_FILE = path.join(DATA_DIR, 'operations.jsonl');

// ========================================
// PERSISTENCE
// ========================================

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function loadJSON(fp, fallback) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return fallback; } }
function saveJSON(fp, data) { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8'); }
function appendOp(op) { fs.appendFileSync(OPS_LOG_FILE, JSON.stringify(op) + '\n', 'utf8'); }
function loadOps(since) {
  try {
    const lines = fs.readFileSync(OPS_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    const ops = lines.map(l => JSON.parse(l));
    if (since) return ops.filter(o => new Date(o.ts).getTime() > new Date(since).getTime());
    return ops;
  } catch { return []; }
}

function generateUID(prefix) { return prefix + '_' + crypto.randomBytes(8).toString('hex'); }

// ========================================
// STATE
// ========================================

ensureDir(DATA_DIR);

let state = loadJSON(STATE_FILE, {
  name: AGENT_NAME,
  uid: generateUID('uid'),
  blocked: [],
  dispatchMode: {},  // room → mode
  // Future: modules config, boot assembler config, etc.
});

let dispatches = loadJSON(DISPATCHES_FILE, []);
let seqCounter = loadOps().length;

function saveState() { saveJSON(STATE_FILE, state); }
function saveDispatches() { saveJSON(DISPATCHES_FILE, dispatches); }

function logOp(type, payload, reason) {
  seqCounter++;
  const op = { id: generateUID('op'), seq: seqCounter, type, agent: AGENT_NAME, payload: payload || {}, reason: reason || null, ts: new Date().toISOString() };
  appendOp(op);
  return op;
}

// ========================================
// REGISTRATION — announce self to room server
// ========================================

async function registerWithDirectory() {
  const endpoint = `http://localhost:${PORT}`;
  try {
    const res = await fetch(ROOM_SERVER + '/api/directory/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: AGENT_NAME, uid: state.uid, endpoint })
    });
    const data = await res.json();
    if (data.success) {
      // Adopt color from directory if assigned
      if (data.entry?.color) state.color = data.entry.color;
      saveState();
      console.log(`  [register] Registered with directory → ${endpoint}`);
    } else {
      console.log(`  [register] Failed: ${data.error}`);
    }
  } catch (e) {
    console.log(`  [register] Room server unreachable: ${e.message}`);
  }
}

// ========================================
// DISPATCH — receive pushes from room server
// ========================================

function receiveDispatch(dispatchData) {
  // Check mute
  if (state.dispatchMode[dispatchData.room] === 'muted' && dispatchData.type === 'push') {
    console.log(`  [dispatch] Muted: ignoring PUSH from ${dispatchData.room}`);
    return { success: true, muted: true };
  }

  // Check blocked senders — filter out messages from blocked participants
  if (state.blocked.length > 0) {
    dispatchData.messages = dispatchData.messages.filter(m => !state.blocked.includes(m.from));
  }

  dispatches.push(dispatchData);
  saveDispatches();
  logOp('dispatch.received', { type: dispatchData.type, room: dispatchData.room, messageCount: dispatchData.messageCount });
  console.log(`  [dispatch] ${dispatchData.type.toUpperCase()} from ${dispatchData.room} (${dispatchData.messageCount} msg)`);
  return { success: true };
}

// ========================================
// HOME-LEVEL OPERATIONS
// ========================================

function blockParticipant(name) {
  if (state.blocked.includes(name)) return { error: `Already blocked: ${name}` };
  state.blocked.push(name);
  saveState();
  logOp('block', { blocked: name });
  return { success: true };
}

function unblockParticipant(name) {
  const idx = state.blocked.indexOf(name);
  if (idx === -1) return { error: `Not blocked: ${name}` };
  state.blocked.splice(idx, 1);
  saveState();
  logOp('unblock', { unblocked: name });
  return { success: true };
}

function setDispatchMode(room, mode) {
  if (!['full', 'since-last', 'muted'].includes(mode)) return { error: `Invalid mode: ${mode}` };
  state.dispatchMode[room] = mode;
  saveState();
  logOp('dispatch.mode', { room, mode });
  return { success: true };
}

function clearDispatches() {
  const count = dispatches.length;
  dispatches = [];
  saveDispatches();
  logOp('dispatches.clear', { cleared: count });
  return { success: true, cleared: count };
}

// ========================================
// PROXY — send/pull through room server on behalf of this agent
// ========================================

async function proxySend(to, room, body, replyTo) {
  try {
    const res = await fetch(ROOM_SERVER + '/api/message/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: AGENT_NAME, to, room, body, replyTo, initiator: AGENT_NAME })
    });
    return await res.json();
  } catch (e) {
    return { error: `Room server unreachable: ${e.message}` };
  }
}

async function proxyPull(room) {
  try {
    const res = await fetch(ROOM_SERVER + '/api/dispatch/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant: AGENT_NAME, room, initiator: AGENT_NAME })
    });
    return await res.json();
  } catch (e) {
    return { error: `Room server unreachable: ${e.message}` };
  }
}

async function proxyJoin(room) {
  try {
    const res = await fetch(ROOM_SERVER + '/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant: AGENT_NAME, room, initiator: AGENT_NAME })
    });
    return await res.json();
  } catch (e) {
    return { error: `Room server unreachable: ${e.message}` };
  }
}

async function proxyLeave(room) {
  try {
    const res = await fetch(ROOM_SERVER + '/api/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant: AGENT_NAME, room, initiator: AGENT_NAME })
    });
    return await res.json();
  } catch (e) {
    return { error: `Room server unreachable: ${e.message}` };
  }
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
    res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // GET
  if (req.method === 'GET') {
    if (p === '/api/state') return respond(res, 200, { agent: AGENT_NAME, ...state, dispatchCount: dispatches.length, port: PORT });
    if (p === '/api/dispatches') {
      const since = url.searchParams.get('since');
      let d = dispatches;
      if (since) d = d.filter(x => new Date(x.ts).getTime() > new Date(since).getTime());
      return respond(res, 200, { agent: AGENT_NAME, dispatches: d });
    }
    if (p === '/api/operations') return respond(res, 200, loadOps(url.searchParams.get('since')));
    if (p === '/api/health') return respond(res, 200, { agent: AGENT_NAME, status: 'running', port: PORT, uptime: process.uptime() });
    return respond(res, 404, { error: 'Not found' });
  }

  // POST
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); } catch { return respond(res, 400, { error: 'Invalid JSON' }); }

    // === Dispatch endpoint — room server pushes here ===
    if (p === '/dispatch') {
      return respond(res, 200, receiveDispatch(body));
    }

    const routes = {
      // Home-level operations
      '/api/block': () => blockParticipant(body.name),
      '/api/unblock': () => unblockParticipant(body.name),
      '/api/dispatch-mode': () => setDispatchMode(body.room, body.mode),
      '/api/clear-dispatches': () => clearDispatches(),

      // Proxy operations — agent acts through room server
      '/api/send': () => proxySend(body.to, body.room, body.body, body.replyTo),
      '/api/pull': () => proxyPull(body.room),
      '/api/join': () => proxyJoin(body.room),
      '/api/leave': () => proxyLeave(body.room),
    };

    const handler = routes[p];
    if (!handler) return respond(res, 404, { error: 'Not found' });
    const result = await handler();
    return respond(res, result?.error ? 400 : 200, result);
  }

  respond(res, 405, { error: 'Method not allowed' });
});

// ========================================
// START
// ========================================

server.listen(PORT, async () => {
  console.log(`\n  BLUM HOME — ${AGENT_NAME}`);
  console.log(`  ════════════════`);
  console.log(`  Port:       ${PORT}`);
  console.log(`  UID:        ${state.uid}`);
  console.log(`  Data:       ${DATA_DIR}`);
  console.log(`  Room server: ${ROOM_SERVER}`);
  console.log(`  Dispatches: ${dispatches.length}`);

  // Register with directory
  await registerWithDirectory();

  console.log(`  Ready.\n`);
});
