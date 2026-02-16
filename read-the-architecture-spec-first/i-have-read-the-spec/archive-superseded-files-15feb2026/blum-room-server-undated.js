#!/usr/bin/env node
// ========================================
// BLUM ROOM SERVER — 15 Feb 2026
// Rooms + Directory + Dispatch
// Knows homes only as endpoints
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3141');
const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const DIRECTORY_FILE = path.join(DATA_DIR, 'directory.json');
const OPS_LOG_FILE = path.join(DATA_DIR, 'room-operations.jsonl');

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

let rooms = loadJSON(ROOMS_FILE, {});
// directory: { name: { name, uid, endpoint, color } }
let directory = loadJSON(DIRECTORY_FILE, {});
let seqCounter = loadOps().length;

function saveRooms() { saveJSON(ROOMS_FILE, rooms); }
function saveDirectory() { saveJSON(DIRECTORY_FILE, directory); }

function logOp(type, initiator, target, payload, reason) {
  seqCounter++;
  const op = { id: generateUID('op'), seq: seqCounter, type, initiator: initiator || 'system', target, payload: payload || {}, reason: reason || null, ts: new Date().toISOString() };
  appendOp(op);
  return op;
}

// ========================================
// DISPATCH — push transcript to a home endpoint
// ========================================

async function pushToHome(participantName, roomName) {
  const entry = directory[participantName];
  const room = rooms[roomName];
  if (!entry || !entry.endpoint || !room) return;

  const payload = {
    type: 'push',
    room: roomName,
    roomUID: room.uid,
    messageCount: room.transcript.length,
    messages: room.transcript,
    ts: new Date().toISOString()
  };

  try {
    const url = entry.endpoint + '/dispatch';
    const body = JSON.stringify(payload);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    if (!res.ok) console.log(`  [dispatch] PUSH to ${participantName} (${url}) failed: ${res.status}`);
    else console.log(`  [dispatch] PUSH → ${participantName}@${roomName} (${room.transcript.length} msg)`);
  } catch (e) {
    console.log(`  [dispatch] PUSH to ${participantName} (${entry.endpoint}) UNREACHABLE: ${e.message}`);
  }
}

// ========================================
// DIRECTORY OPERATIONS
// ========================================

const colorPool = [
  { name: 'amber', hex: '#e8a44a' }, { name: 'green', hex: '#5cb870' },
  { name: 'purple', hex: '#a078cc' }, { name: 'blue', hex: '#5b8dd9' },
  { name: 'coral', hex: '#d4766a' }, { name: 'teal', hex: '#4db8a0' },
  { name: 'pink', hex: '#c472b6' }, { name: 'lime', hex: '#8cb84d' },
  { name: 'gold', hex: '#c4a84d' }, { name: 'sky', hex: '#4da4d4' },
];

function register(name, uid, endpoint) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  const isNew = !directory[name];
  const usedColors = Object.values(directory).map(e => e.color?.name);
  const color = isNew
    ? (colorPool.find(c => !usedColors.includes(c.name)) || colorPool[Object.keys(directory).length % colorPool.length])
    : directory[name].color;

  directory[name] = { name, uid: uid || directory[name]?.uid || generateUID('uid'), endpoint, color };
  saveDirectory();
  logOp('directory.register', name, name, { uid: directory[name].uid, endpoint });
  console.log(`  [directory] ${isNew ? 'Registered' : 'Updated'} ${name} → ${endpoint}`);
  return { success: true, entry: directory[name] };
}

function deregister(name, initiator, reason) {
  if (!directory[name]) return { error: `Unknown: ${name}` };
  // Also remove from all rooms
  for (const r of Object.values(rooms)) {
    const idx = r.participants.indexOf(name);
    if (idx !== -1) r.participants.splice(idx, 1);
  }
  saveRooms();
  const uid = directory[name].uid;
  delete directory[name];
  saveDirectory();
  logOp('directory.deregister', initiator || 'system', name, { uid }, reason);
  return { success: true };
}

function lookup(name) {
  return directory[name] || null;
}

// ========================================
// ROOM OPERATIONS
// ========================================

function createRoom(name, initiator) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  if (rooms[name]) return { error: `${name} already exists` };
  rooms[name] = { name, uid: generateUID('room'), participants: [], transcript: [], blocklist: [], pinned: [], archived: false };
  saveRooms();
  logOp('room.create', initiator || 'system', name, { uid: rooms[name].uid });
  return { success: true, room: rooms[name] };
}

function removeRoom(name, initiator, reason) {
  if (!rooms[name]) return { error: `Unknown room: ${name}` };
  const uid = rooms[name].uid;
  delete rooms[name];
  saveRooms();
  logOp('room.remove', initiator || 'system', name, { uid }, reason);
  return { success: true };
}

function archiveRoom(name, initiator, reason) {
  if (!rooms[name]) return { error: `Unknown room: ${name}` };
  rooms[name].archived = true;
  saveRooms();
  logOp('room.archive', initiator || 'system', name, {}, reason);
  return { success: true };
}

function joinRoom(participantName, roomName, initiator) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  if (!directory[participantName]) return { error: `Unknown participant: ${participantName}` };
  if (r.blocklist.includes(participantName)) return { error: `${participantName} is blocked from ${roomName}` };
  if (r.participants.includes(participantName)) return { error: `${participantName} already in ${roomName}` };
  r.participants.push(participantName);
  saveRooms();
  logOp('room.join', initiator || participantName, roomName, { participant: participantName });
  return { success: true };
}

function leaveRoom(participantName, roomName, initiator, reason) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  const idx = r.participants.indexOf(participantName);
  if (idx === -1) return { error: `${participantName} not in ${roomName}` };
  r.participants.splice(idx, 1);
  saveRooms();
  const opType = (initiator && initiator !== participantName) ? 'room.kick' : 'room.leave';
  logOp(opType, initiator || participantName, roomName, { participant: participantName }, reason);
  return { success: true };
}

function addToBlocklist(participantName, roomName, initiator, reason) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  if (r.blocklist.includes(participantName)) return { error: `Already blocked` };
  r.blocklist.push(participantName);
  const idx = r.participants.indexOf(participantName);
  if (idx !== -1) r.participants.splice(idx, 1);
  saveRooms();
  logOp('room.blocklist.add', initiator || 'system', roomName, { participant: participantName }, reason);
  return { success: true };
}

function removeFromBlocklist(participantName, roomName, initiator) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  const idx = r.blocklist.indexOf(participantName);
  if (idx === -1) return { error: `Not blocked` };
  r.blocklist.splice(idx, 1);
  saveRooms();
  logOp('room.blocklist.remove', initiator || 'system', roomName, { participant: participantName });
  return { success: true };
}

// ========================================
// MESSAGE OPERATIONS
// ========================================

function sendMessage(fromName, toName, roomName, body, replyTo, initiator) {
  const from = directory[fromName];
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
    if (quoted) { msg.replyTo = replyTo; msg.quoteFrom = quoted.from; msg.quoteBody = quoted.body; }
  }

  if (toName && toName !== 'broadcast') {
    const to = directory[toName];
    if (!to) return { error: `Unknown: ${toName}` };
    if (!room.participants.includes(toName)) return { error: `${toName} not in ${roomName}` };
    msg.to = toName;
    msg.toUID = to.uid;
    msg.toAddress = toName + '@' + roomName;
  }

  room.transcript.push(msg);
  saveRooms();
  logOp('message.send', initiator || fromName, roomName, { msgId: msg.id, from: fromName, to: toName || null });

  // Dispatch — push to addressed recipient's home
  if (msg.to) {
    pushToHome(msg.to, roomName);
  }

  return { success: true, msg };
}

function withdrawMessage(msgId, roomName, initiator, reason) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  const msg = room.transcript.find(m => m.id === msgId);
  if (!msg) return { error: `Message not found` };
  msg.withdrawn = true; msg.withdrawnBy = initiator; msg.withdrawnAt = new Date().toISOString();
  saveRooms();
  logOp('message.withdraw', initiator, roomName, { msgId }, reason);
  return { success: true };
}

function pinMessage(msgId, roomName, initiator) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (!room.transcript.find(m => m.id === msgId)) return { error: `Message not found` };
  if (!room.pinned.includes(msgId)) { room.pinned.push(msgId); saveRooms(); logOp('message.pin', initiator, roomName, { msgId }); }
  return { success: true };
}

function unpinMessage(msgId, roomName, initiator) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  const idx = room.pinned.indexOf(msgId);
  if (idx !== -1) { room.pinned.splice(idx, 1); saveRooms(); logOp('message.unpin', initiator, roomName, { msgId }); }
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
    res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // Static — serve client
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'blum-room-client-15feb2026.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch { res.writeHead(404); res.end('Client not found'); }
    return;
  }

  // GET
  if (req.method === 'GET') {
    if (p === '/api/state') return respond(res, 200, { rooms, directory });
    if (p === '/api/rooms') return respond(res, 200, rooms);
    if (p === '/api/directory') return respond(res, 200, directory);
    if (p.match(/^\/api\/room\/[^/]+\/transcript$/)) {
      const name = p.split('/')[3];
      if (!rooms[name]) return respond(res, 404, { error: `Unknown room: ${name}` });
      return respond(res, 200, { room: name, transcript: rooms[name].transcript });
    }
    if (p === '/api/operations') return respond(res, 200, loadOps(url.searchParams.get('since')));
    return respond(res, 404, { error: 'Not found' });
  }

  // POST
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); } catch { return respond(res, 400, { error: 'Invalid JSON' }); }

    const routes = {
      '/api/directory/register': () => register(body.name, body.uid, body.endpoint),
      '/api/directory/deregister': () => deregister(body.name, body.initiator, body.reason),
      '/api/directory/lookup': () => { const e = lookup(body.name); return e ? { success: true, entry: e } : { error: 'Not found' }; },

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

      // Pull — home requests transcript, room responds, then pushes to home
      '/api/dispatch/pull': () => {
        const r = rooms[body.room];
        if (!r) return { error: `Unknown room: ${body.room}` };
        if (!r.participants.includes(body.participant)) return { error: `${body.participant} not in ${body.room}` };
        pushToHome(body.participant, body.room);
        logOp('dispatch.pull', body.initiator || body.participant, body.room, { participant: body.participant });
        return { success: true, transcript: r.transcript };
      },
    };

    const handler = routes[p];
    if (!handler) return respond(res, 404, { error: 'Not found' });
    const result = handler();
    // Handle async results (pushToHome is async)
    if (result instanceof Promise) {
      const resolved = await result;
      return respond(res, resolved?.error ? 400 : 200, resolved);
    }
    return respond(res, result.error ? 400 : 200, result);
  }

  respond(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`\n  BLUM ROOM SERVER`);
  console.log(`  ════════════════`);
  console.log(`  Port:       ${PORT}`);
  console.log(`  Data:       ${DATA_DIR}`);
  console.log(`  Rooms:      ${Object.keys(rooms).length}`);
  console.log(`  Directory:  ${Object.keys(directory).length} entries`);
  console.log(`  Ops logged: ${seqCounter}`);
  console.log(`  Ready.\n`);
});
