#!/usr/bin/env node
// ========================================
// BLUM ROOM SERVER — 15 Feb 2026
// Persistent, agent-callable room system
// No dependencies — Node built-ins only
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3141;
const DATA_DIR = path.join(__dirname, 'data');
const PARTICIPANTS_FILE = path.join(DATA_DIR, 'participants.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const OPS_LOG_FILE = path.join(DATA_DIR, 'operations-log.jsonl');

// ========================================
// PERSISTENCE
// ========================================

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filepath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

function appendOp(op) {
  fs.appendFileSync(OPS_LOG_FILE, JSON.stringify(op) + '\n', 'utf8');
}

function loadOps(since) {
  try {
    const lines = fs.readFileSync(OPS_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    const ops = lines.map(l => JSON.parse(l));
    if (since) {
      const sinceTime = new Date(since).getTime();
      return ops.filter(o => new Date(o.ts).getTime() > sinceTime);
    }
    return ops;
  } catch {
    return [];
  }
}

// ========================================
// STATE
// ========================================

ensureDataDir();

let participants = loadJSON(PARTICIPANTS_FILE, {});
let rooms = loadJSON(ROOMS_FILE, {});
let seqCounter = loadOps().length;

function save() {
  saveJSON(PARTICIPANTS_FILE, participants);
  saveJSON(ROOMS_FILE, rooms);
}

function generateUID(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

function logOp(type, initiator, target, payload, reason) {
  seqCounter++;
  const op = {
    id: generateUID('op'),
    seq: seqCounter,
    type,
    initiator: initiator || 'system',
    target,
    payload: payload || {},
    reason: reason || null,
    ts: new Date().toISOString()
  };
  appendOp(op);
  return op;
}

// ========================================
// COLOR POOL
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

function assignColor() {
  const usedColors = Object.values(participants).map(p => p.color?.name);
  const available = colorPool.find(c => !usedColors.includes(c.name));
  return available || colorPool[Object.keys(participants).length % colorPool.length];
}

// ========================================
// OPERATIONS — PARTICIPANTS
// ========================================

function createParticipant(name, initiator) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  if (participants[name]) return { error: `${name} already exists` };
  const color = assignColor();
  participants[name] = {
    name,
    uid: generateUID('uid'),
    color,
    dispatches: [],
    blocked: [],
    dispatchMode: {} // room → mode (full|since-last|muted)
  };
  save();
  logOp('participant.create', initiator || name, name, { uid: participants[name].uid });
  return { success: true, participant: participants[name] };
}

function removeParticipant(name, initiator, reason) {
  if (!participants[name]) return { error: `Unknown: ${name}` };
  // Leave all rooms
  for (const rName of Object.keys(rooms)) {
    const idx = rooms[rName].participants.indexOf(name);
    if (idx !== -1) rooms[rName].participants.splice(idx, 1);
  }
  const uid = participants[name].uid;
  delete participants[name];
  save();
  logOp('participant.remove', initiator || 'system', name, { uid }, reason);
  return { success: true };
}

// ========================================
// OPERATIONS — ROOMS
// ========================================

function createRoom(name, initiator) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  if (rooms[name]) return { error: `${name} already exists` };
  rooms[name] = {
    name,
    uid: generateUID('room'),
    participants: [],
    transcript: [],
    blocklist: [],
    pinned: [],
    archived: false
  };
  save();
  logOp('room.create', initiator || 'system', name, { uid: rooms[name].uid });
  return { success: true, room: rooms[name] };
}

function removeRoom(name, initiator, reason) {
  if (!rooms[name]) return { error: `Unknown room: ${name}` };
  const uid = rooms[name].uid;
  delete rooms[name];
  save();
  logOp('room.remove', initiator || 'system', name, { uid }, reason);
  return { success: true };
}

function archiveRoom(name, initiator, reason) {
  if (!rooms[name]) return { error: `Unknown room: ${name}` };
  rooms[name].archived = true;
  save();
  logOp('room.archive', initiator || 'system', name, {}, reason);
  return { success: true };
}

// ========================================
// OPERATIONS — MEMBERSHIP
// ========================================

function joinRoom(participantName, roomName, initiator) {
  const p = participants[participantName];
  const r = rooms[roomName];
  if (!p) return { error: `Unknown participant: ${participantName}` };
  if (!r) return { error: `Unknown room: ${roomName}` };
  if (r.blocklist.includes(participantName)) return { error: `${participantName} is blocked from ${roomName}` };
  if (r.participants.includes(participantName)) return { error: `${participantName} already in ${roomName}` };
  r.participants.push(participantName);
  save();
  logOp('room.join', initiator || participantName, roomName, { participant: participantName });
  return { success: true };
}

function leaveRoom(participantName, roomName, initiator, reason) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  const idx = r.participants.indexOf(participantName);
  if (idx === -1) return { error: `${participantName} not in ${roomName}` };
  r.participants.splice(idx, 1);
  save();
  const opType = (initiator && initiator !== participantName) ? 'room.kick' : 'room.leave';
  logOp(opType, initiator || participantName, roomName, { participant: participantName }, reason);
  return { success: true };
}

function addToBlocklist(participantName, roomName, initiator, reason) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  if (r.blocklist.includes(participantName)) return { error: `${participantName} already blocked` };
  r.blocklist.push(participantName);
  // Also remove from room if present
  const idx = r.participants.indexOf(participantName);
  if (idx !== -1) r.participants.splice(idx, 1);
  save();
  logOp('room.blocklist.add', initiator || 'system', roomName, { participant: participantName }, reason);
  return { success: true };
}

function removeFromBlocklist(participantName, roomName, initiator) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  const idx = r.blocklist.indexOf(participantName);
  if (idx === -1) return { error: `${participantName} not blocked` };
  r.blocklist.splice(idx, 1);
  save();
  logOp('room.blocklist.remove', initiator || 'system', roomName, { participant: participantName });
  return { success: true };
}

// ========================================
// OPERATIONS — MESSAGES
// ========================================

function sendMessage(fromName, toName, roomName, body, replyTo, initiator) {
  const from = participants[fromName];
  const room = rooms[roomName];
  if (!from) return { error: `Unknown: ${fromName}` };
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (room.archived) return { error: `${roomName} is archived` };
  if (!room.participants.includes(fromName)) return { error: `${fromName} not in ${roomName}` };

  const msg = {
    id: generateUID('msg'),
    from: fromName,
    fromUID: from.uid,
    fromAddress: fromName + '@' + roomName,
    room: roomName,
    roomUID: room.uid,
    body,
    ts: new Date().toISOString(),
    withdrawn: false
  };

  if (replyTo) {
    const quoted = room.transcript.find(m => m.id === replyTo);
    if (quoted) {
      msg.replyTo = replyTo;
      msg.quoteFrom = quoted.from;
      msg.quoteBody = quoted.body;
    }
  }

  if (toName && toName !== 'broadcast') {
    const to = participants[toName];
    if (!to) return { error: `Unknown: ${toName}` };
    if (!room.participants.includes(toName)) return { error: `${toName} not in ${roomName}` };
    msg.to = toName;
    msg.toUID = to.uid;
    msg.toAddress = toName + '@' + roomName;
  }

  room.transcript.push(msg);
  save();
  logOp('message.send', initiator || fromName, roomName, {
    msgId: msg.id, from: fromName, to: toName || null, replyTo: replyTo || null
  });

  // Push dispatch
  if (msg.to) {
    dispatchToHome(msg.to, roomName, 'push');
  }

  return { success: true, msg };
}

function withdrawMessage(msgId, roomName, initiator, reason) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  const msg = room.transcript.find(m => m.id === msgId);
  if (!msg) return { error: `Message not found: ${msgId}` };
  msg.withdrawn = true;
  msg.withdrawnBy = initiator;
  msg.withdrawnAt = new Date().toISOString();
  save();
  logOp('message.withdraw', initiator, roomName, { msgId }, reason);
  return { success: true };
}

function pinMessage(msgId, roomName, initiator) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (!room.transcript.find(m => m.id === msgId)) return { error: `Message not found: ${msgId}` };
  if (!room.pinned.includes(msgId)) {
    room.pinned.push(msgId);
    save();
    logOp('message.pin', initiator, roomName, { msgId });
  }
  return { success: true };
}

function unpinMessage(msgId, roomName, initiator) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  const idx = room.pinned.indexOf(msgId);
  if (idx !== -1) {
    room.pinned.splice(idx, 1);
    save();
    logOp('message.unpin', initiator, roomName, { msgId });
  }
  return { success: true };
}

// ========================================
// OPERATIONS — DISPATCH
// ========================================

function dispatchToHome(agentName, roomName, type) {
  const agent = participants[agentName];
  const room = rooms[roomName];
  if (!agent || !room) return;

  // Check mute
  if (agent.dispatchMode[roomName] === 'muted' && type === 'push') return;

  agent.dispatches.push({
    type,
    room: roomName,
    roomUID: room.uid,
    messageCount: room.transcript.length,
    messages: [...room.transcript],
    ts: new Date().toISOString()
  });
  save();
}

function pullFromRoom(agentName, roomName, initiator) {
  const agent = participants[agentName];
  const room = rooms[roomName];
  if (!agent) return { error: `Unknown: ${agentName}` };
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (!room.participants.includes(agentName)) return { error: `${agentName} not in ${roomName}` };
  dispatchToHome(agentName, roomName, 'pull');
  logOp('dispatch.pull', initiator || agentName, roomName, { participant: agentName });
  return { success: true };
}

function setDispatchMode(agentName, roomName, mode, initiator) {
  const agent = participants[agentName];
  if (!agent) return { error: `Unknown: ${agentName}` };
  if (!['full', 'since-last', 'muted'].includes(mode)) return { error: `Invalid mode: ${mode}` };
  agent.dispatchMode[roomName] = mode;
  save();
  logOp('dispatch.mode', initiator || agentName, roomName, { participant: agentName, mode });
  return { success: true };
}

// ========================================
// OPERATIONS — LOCAL (home-level)
// ========================================

function blockParticipant(blocker, blocked, initiator) {
  const p = participants[blocker];
  if (!p) return { error: `Unknown: ${blocker}` };
  if (!p.blocked.includes(blocked)) {
    p.blocked.push(blocked);
    save();
    logOp('participant.block', initiator || blocker, blocker, { blocked });
  }
  return { success: true };
}

function unblockParticipant(blocker, blocked, initiator) {
  const p = participants[blocker];
  if (!p) return { error: `Unknown: ${blocker}` };
  const idx = p.blocked.indexOf(blocked);
  if (idx !== -1) {
    p.blocked.splice(idx, 1);
    save();
    logOp('participant.unblock', initiator || blocker, blocker, { blocked });
  }
  return { success: true };
}

// ========================================
// HTTP SERVER
// ========================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function respond(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filepath, contentType) {
  try {
    const content = fs.readFileSync(filepath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // Static files
  if (p === '/' || p === '/index.html') {
    serveStatic(res, path.join(__dirname, 'blum-room-client-15feb2026.html'), 'text/html');
    return;
  }

  // === GET endpoints ===
  if (req.method === 'GET') {
    if (p === '/api/state') {
      return respond(res, 200, { participants, rooms });
    }
    if (p === '/api/participants') {
      return respond(res, 200, participants);
    }
    if (p === '/api/rooms') {
      return respond(res, 200, rooms);
    }
    if (p.startsWith('/api/room/') && p.endsWith('/transcript')) {
      const name = p.split('/')[3];
      if (!rooms[name]) return respond(res, 404, { error: `Unknown room: ${name}` });
      return respond(res, 200, { room: name, transcript: rooms[name].transcript });
    }
    if (p.startsWith('/api/participant/') && p.endsWith('/dispatches')) {
      const name = p.split('/')[3];
      if (!participants[name]) return respond(res, 404, { error: `Unknown: ${name}` });
      const since = url.searchParams.get('since');
      let dispatches = participants[name].dispatches;
      if (since) {
        const sinceTime = new Date(since).getTime();
        dispatches = dispatches.filter(d => new Date(d.ts).getTime() > sinceTime);
      }
      return respond(res, 200, { participant: name, dispatches });
    }
    if (p === '/api/operations') {
      const since = url.searchParams.get('since');
      return respond(res, 200, loadOps(since));
    }
    return respond(res, 404, { error: 'Not found' });
  }

  // === POST endpoints ===
  if (req.method === 'POST') {
    let body;
    try {
      body = await parseBody(req);
    } catch (e) {
      return respond(res, 400, { error: 'Invalid JSON' });
    }

    const routes = {
      '/api/participant/create': () => createParticipant(body.name, body.initiator),
      '/api/participant/remove': () => removeParticipant(body.name, body.initiator, body.reason),
      '/api/participant/block': () => blockParticipant(body.participant, body.blocked, body.initiator),
      '/api/participant/unblock': () => unblockParticipant(body.participant, body.blocked, body.initiator),

      '/api/room/create': () => createRoom(body.name, body.initiator),
      '/api/room/remove': () => removeRoom(body.name, body.initiator, body.reason),
      '/api/room/archive': () => archiveRoom(body.name, body.initiator, body.reason),

      '/api/room/join': () => joinRoom(body.participant, body.room, body.initiator),
      '/api/room/leave': () => leaveRoom(body.participant, body.room, body.initiator, body.reason),
      '/api/room/kick': () => leaveRoom(body.participant, body.room, body.initiator, body.reason),
      '/api/room/blocklist/add': () => addToBlocklist(body.participant, body.room, body.initiator, body.reason),
      '/api/room/blocklist/remove': () => removeFromBlocklist(body.participant, body.room, body.initiator),

      '/api/message/send': () => sendMessage(body.from, body.to, body.room, body.body, body.replyTo, body.initiator),
      '/api/message/withdraw': () => withdrawMessage(body.msgId, body.room, body.initiator, body.reason),
      '/api/message/pin': () => pinMessage(body.msgId, body.room, body.initiator),
      '/api/message/unpin': () => unpinMessage(body.msgId, body.room, body.initiator),

      '/api/dispatch/pull': () => pullFromRoom(body.participant, body.room, body.initiator),
      '/api/dispatch/mode': () => setDispatchMode(body.participant, body.room, body.mode, body.initiator),
    };

    const handler = routes[p];
    if (!handler) return respond(res, 404, { error: 'Not found' });

    const result = handler();
    return respond(res, result.error ? 400 : 200, result);
  }

  respond(res, 405, { error: 'Method not allowed' });
});

// ========================================
// SEED DEFAULT DATA (only if empty)
// ========================================

if (Object.keys(participants).length === 0 && Object.keys(rooms).length === 0) {
  console.log('Seeding default data...');
  createParticipant('yeshua', 'system');
  createParticipant('claude', 'system');
  createParticipant('selah', 'system');
  createParticipant('lens', 'system');

  createRoom('boardroom', 'system');
  createRoom('garden', 'system');
  createRoom('workshop', 'system');
  createRoom('lounge', 'system');

  joinRoom('yeshua', 'boardroom', 'system');
  joinRoom('claude', 'boardroom', 'system');
  joinRoom('selah', 'boardroom', 'system');
  joinRoom('lens', 'boardroom', 'system');

  joinRoom('yeshua', 'garden', 'system');
  joinRoom('selah', 'garden', 'system');
  joinRoom('lens', 'garden', 'system');

  joinRoom('claude', 'workshop', 'system');
  joinRoom('selah', 'workshop', 'system');

  joinRoom('yeshua', 'lounge', 'system');
  joinRoom('claude', 'lounge', 'system');
  joinRoom('lens', 'lounge', 'system');
  console.log('Default data seeded.');
}

// ========================================
// START
// ========================================

server.listen(PORT, () => {
  console.log(`\n  BLUM ROOM SERVER`);
  console.log(`  ════════════════`);
  console.log(`  Port:     ${PORT}`);
  console.log(`  Data:     ${DATA_DIR}`);
  console.log(`  UI:       http://localhost:${PORT}/`);
  console.log(`  API:      http://localhost:${PORT}/api/state`);
  console.log(`  Ops log:  ${OPS_LOG_FILE}`);
  console.log(`  ────────────────`);
  console.log(`  ${Object.keys(participants).length} participants, ${Object.keys(rooms).length} rooms`);
  console.log(`  ${seqCounter} operations logged`);
  console.log(`  Ready.\n`);
});
