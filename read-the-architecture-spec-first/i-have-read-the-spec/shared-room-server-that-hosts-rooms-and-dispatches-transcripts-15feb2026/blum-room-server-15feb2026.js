#!/usr/bin/env node
// ========================================
// BLUM ROOM SERVER — 15 Feb 2026
//
// Rooms + Directory only.
// No home state. Homes are separate processes.
// When a message is addressed to someone,
// this server POSTs the room chatlog to their
// home endpoint (looked up in the directory).
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3141;
const DATA_DIR = path.join(__dirname, 'data');

// ========================================
// PERSISTENCE HELPERS
// ========================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch { return fallback; }
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

function appendLine(filepath, obj) {
  fs.appendFileSync(filepath, JSON.stringify(obj) + '\n', 'utf8');
}

function readLines(filepath, since) {
  try {
    const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n').filter(Boolean);
    const parsed = lines.map(l => JSON.parse(l));
    if (since) {
      const t = new Date(since).getTime();
      return parsed.filter(o => new Date(o.ts).getTime() > t);
    }
    return parsed;
  } catch { return []; }
}

// ========================================
// STATE
// ========================================

ensureDir(DATA_DIR);

const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const DIRECTORY_FILE = path.join(DATA_DIR, 'directory.json');
const OPS_FILE = path.join(DATA_DIR, 'operations.jsonl');

// rooms: { name: { name, uid, participants: [name, ...], chatlog: [], blocklist: [], pinned: [], archived: false } }
let rooms = loadJSON(ROOMS_FILE, {});

// directory: { name: { name, uid, endpoint, color } }
// endpoint is where to POST dispatches — e.g. http://localhost:3142
let directory = loadJSON(DIRECTORY_FILE, {});

let seqCounter = readLines(OPS_FILE).length;

function saveRooms() { saveJSON(ROOMS_FILE, rooms); }
function saveDirectory() { saveJSON(DIRECTORY_FILE, directory); }

const { generateUID } = require('../shared-uid-generator/generate-uid.js');

function logOp(type, initiator, target, payload, reason) {
  seqCounter++;
  const op = {
    id: generateUID('op'), seq: seqCounter, type,
    initiator: initiator || 'system', target,
    payload: payload || {}, reason: reason || null,
    ts: new Date().toISOString()
  };
  appendLine(OPS_FILE, op);
  return op;
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

function assignColor() {
  const used = Object.values(directory).map(d => d.color?.name);
  return colorPool.find(c => !used.includes(c.name)) ||
    colorPool[Object.keys(directory).length % colorPool.length];
}

function registerParticipant(name, endpoint, initiator) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  if (directory[name]) return { error: `${name} already registered` };
  directory[name] = {
    name, uid: generateUID('uid'),
    endpoint: endpoint || null,
    color: assignColor()
  };
  saveDirectory();
  logOp('directory.register', initiator || name, name, { uid: directory[name].uid, endpoint });
  return { success: true, entry: directory[name] };
}

function deregisterParticipant(name, initiator, reason) {
  if (!directory[name]) return { error: `Unknown: ${name}` };
  // Remove from all rooms
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

function updateEndpoint(name, endpoint, initiator) {
  if (!directory[name]) return { error: `Unknown: ${name}` };
  directory[name].endpoint = endpoint;
  saveDirectory();
  logOp('directory.update-endpoint', initiator || name, name, { endpoint });
  return { success: true };
}

function lookupParticipant(name) {
  return directory[name] || null;
}

// ========================================
// ROOM OPERATIONS
// ========================================

function createRoom(name, initiator) {
  name = name.toLowerCase().replace(/\s+/g, '-');
  if (!name) return { error: 'Name required' };
  if (rooms[name]) return { error: `${name} already exists` };
  rooms[name] = {
    name, uid: generateUID('room'),
    participants: [], chatlog: [],
    blocklist: [], pinned: [], archived: false
  };
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

// ========================================
// MEMBERSHIP OPERATIONS
// ========================================

function joinRoom(participantName, roomName, initiator) {
  if (!directory[participantName]) return { error: `Unknown participant: ${participantName}` };
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
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
// @MENTION EXTRACTION
// ========================================

/**
 * Extract @mentions from a message body.
 * Matches @name patterns where name is a registered participant in the room.
 * Case-insensitive. Returns deduplicated array of lowercase participant names.
 *
 * Matches: @keter @selah @alpha @claude-code
 * Does not match: email@addresses (requires whitespace or start-of-string before @)
 */
function extractMentions(body, roomParticipants) {
  if (!body || !roomParticipants || roomParticipants.length === 0) return [];

  // Build a set of known participant names (lowercase) for fast lookup
  const knownNames = new Set(roomParticipants.map(p => p.toLowerCase()));

  // Match @name patterns — name can contain letters, numbers, hyphens
  // Must be preceded by whitespace, start of string, or punctuation (not letters/numbers)
  const mentionRegex = /(?:^|[\s,;:!?.()\[\]{}])@([a-z0-9][-a-z0-9]*)/gi;
  const found = new Set();

  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    const name = match[1].toLowerCase();
    if (knownNames.has(name)) {
      found.add(name);
    }
  }

  return Array.from(found);
}

// ========================================
// MESSAGE OPERATIONS
// ========================================

function sendMessage(fromName, toName, roomName, body, replyTo, initiator) {
  if (!directory[fromName]) return { error: `Unknown: ${fromName}` };
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (room.archived) return { error: `${roomName} is archived` };
  if (!room.participants.includes(fromName)) return { error: `${fromName} not in ${roomName}` };

  // Extract @mentions from body
  const mentions = extractMentions(body, room.participants);

  // Room stamps the address
  const msg = {
    id: generateUID('msg'),
    from: fromName,
    fromAddress: fromName + '@' + roomName,
    room: roomName, roomUID: room.uid,
    body, ts: new Date().toISOString(),
    withdrawn: false
  };

  // Add mentions to message if any found
  if (mentions.length > 0) {
    msg.mentions = mentions;
  }

  if (replyTo) {
    const quoted = room.chatlog.find(m => m.id === replyTo);
    if (quoted) {
      msg.replyTo = replyTo;
      msg.quoteFrom = quoted.from;
      msg.quoteBody = quoted.body;
    }
  }

  if (toName && toName !== 'broadcast') {
    if (!directory[toName]) return { error: `Unknown: ${toName}` };
    if (!room.participants.includes(toName)) return { error: `${toName} not in ${roomName}` };
    msg.to = toName;
    msg.toAddress = toName + '@' + roomName;
  }

  room.chatlog.push(msg);
  saveRooms();
  logOp('message.send', initiator || fromName, roomName, {
    msgId: msg.id, from: fromName, to: toName || null,
    mentions: mentions.length > 0 ? mentions : undefined
  });

  // DISPATCH — push room chatlog to recipient's home endpoint
  // 1. Explicit "to" recipient (existing behaviour)
  if (msg.to) {
    dispatchToHome(msg.to, roomName);
  }

  // 2. @mentioned participants (new behaviour)
  // Dispatch to each mentioned participant who isn't already the explicit
  // "to" recipient and isn't the sender (don't ping yourself)
  const alreadyDispatched = new Set();
  if (msg.to) alreadyDispatched.add(msg.to.toLowerCase());
  alreadyDispatched.add(fromName.toLowerCase());

  for (const mentioned of mentions) {
    if (!alreadyDispatched.has(mentioned)) {
      alreadyDispatched.add(mentioned); // prevent double dispatch
      dispatchToHome(mentioned, roomName);
    }
  }

  return { success: true, msg };
}

function withdrawMessage(msgId, roomName, initiator, reason) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  const msg = room.chatlog.find(m => m.id === msgId);
  if (!msg) return { error: `Message not found` };
  msg.withdrawn = true;
  msg.withdrawnBy = initiator;
  msg.withdrawnAt = new Date().toISOString();
  saveRooms();
  logOp('message.withdraw', initiator, roomName, { msgId }, reason);
  return { success: true };
}

function pinMessage(msgId, roomName, initiator) {
  const room = rooms[roomName];
  if (!room) return { error: `Unknown room: ${roomName}` };
  if (!room.chatlog.find(m => m.id === msgId)) return { error: `Not found` };
  if (!room.pinned.includes(msgId)) {
    room.pinned.push(msgId);
    saveRooms();
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
    saveRooms();
    logOp('message.unpin', initiator, roomName, { msgId });
  }
  return { success: true };
}

// ========================================
// DISPATCH — push to home endpoint
// ========================================

async function dispatchToHome(agentName, roomName) {
  const entry = directory[agentName];
  const room = rooms[roomName];
  if (!entry || !room) return;
  if (!entry.endpoint) return; // no home registered yet

  const dispatchId = generateUID('disp');
  const payload = {
    dispatchId,
    type: 'push',
    room: roomName,
    roomUID: room.uid,
    roomchatlog: room.chatlog,
    participants: room.participants,
    serverEndpoint: `http://localhost:${PORT}`,
    ts: new Date().toISOString()
  };

  try {
    await fetch(entry.endpoint + '/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Home offline — that's fine. Not our problem.
    console.log(`[dispatch] Failed to reach ${agentName} at ${entry.endpoint}: ${e.message}`);
  }
}

// ========================================
// HTTP SERVER
// ========================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // --- GET ---
  if (req.method === 'GET') {
    // Full state (for UI client)
    if (p === '/api/state') return respond(res, 200, { directory, rooms });
    if (p === '/api/directory') return respond(res, 200, directory);
    if (p === '/api/rooms') return respond(res, 200, rooms);

    // Single room chatlog
    const roomMatch = p.match(/^\/api\/room\/([^/]+)\/chatlog$/);
    if (roomMatch) {
      const name = roomMatch[1];
      if (!rooms[name]) return respond(res, 404, { error: `Unknown room: ${name}` });
      return respond(res, 200, { room: name, chatlog: rooms[name].chatlog });
    }

    // Operations log
    if (p === '/api/operations') {
      return respond(res, 200, readLines(OPS_FILE, url.searchParams.get('since')));
    }

    // Fleet health endpoint
    if (p === '/api/fleet') {
      const fleet = [];
      const fetchPromises = Object.entries(directory).map(async ([name, entry]) => {
        // Default values
        const result = {
          name,
          uid: entry.uid,
          port: null,
          alive: false,
          model: null
        };
        
        // Extract port from endpoint if available
        if (entry.endpoint) {
          try {
            const url = new URL(entry.endpoint);
            result.port = parseInt(url.port);
          } catch (e) {
            // If URL parsing fails, keep port as null
          }
        }
        
        // If endpoint exists, try to fetch status
        if (entry.endpoint) {
          try {
            const response = await fetch(`${entry.endpoint}/status`, {
              timeout: 1000 // 1 second timeout
            });
            if (response.ok) {
              const data = await response.json();
              result.alive = true;
              // Extract model from response if available
              if (data.model) {
                result.model = data.model;
              }
              // Also update port if we got it from the response
              if (data.port) {
                result.port = data.port;
              }
            }
          } catch (e) {
            // Home is offline or unreachable - keep alive: false
          }
        } else {
          // No endpoint registered - consider it not alive
          result.alive = false;
        }
        
        return result;
      });
      
      // Wait for all fetches to complete with Promise.allSettled
      const results = await Promise.allSettled(fetchPromises);
      
      // Extract successful results
      const fleetResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      // Sort by name for consistent ordering
      fleetResults.sort((a, b) => a.name.localeCompare(b.name));
      
      return respond(res, 200, fleetResults);
    }

    // Single room chatlog
    const roomMatch = p.match(/^\/api\/room\/([^/]+)\/chatlog$/);
    if (roomMatch) {
      const name = roomMatch[1];
      if (!rooms[name]) return respond(res, 404, { error: `Unknown room: ${name}` });
      return respond(res, 200, { room: name, chatlog: rooms[name].chatlog });
    }

    return respond(res, 404, { error: 'Not found' });
  }

  // --- POST ---
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch { return respond(res, 400, { error: 'Invalid JSON' }); }

    const routes = {
      // Directory
      '/api/directory/register': () => registerParticipant(body.name, body.endpoint, body.initiator),
      '/api/directory/deregister': () => deregisterParticipant(body.name, body.initiator, body.reason),
      '/api/directory/update-endpoint': () => updateEndpoint(body.name, body.endpoint, body.initiator),
      '/api/directory/lookup': () => {
        const r = lookupParticipant(body.name);
        return r ? { success: true, entry: r } : { error: `Not found: ${body.name}` };
      },

      // Rooms
      '/api/room/create': () => createRoom(body.name, body.initiator),
      '/api/room/remove': () => removeRoom(body.name, body.initiator, body.reason),
      '/api/room/archive': () => archiveRoom(body.name, body.initiator, body.reason),

      // Membership
      '/api/room/join': () => joinRoom(body.participant, body.room, body.initiator),
      '/api/room/leave': () => leaveRoom(body.participant, body.room, body.initiator, body.reason),
      '/api/room/blocklist/add': () => addToBlocklist(body.participant, body.room, body.initiator, body.reason),
      '/api/room/blocklist/remove': () => removeFromBlocklist(body.participant, body.room, body.initiator),

      // Messages
      '/api/message/send': () => sendMessage(body.from, body.to, body.room, body.body, body.replyTo, body.initiator),
      '/api/message/withdraw': () => withdrawMessage(body.msgId, body.room, body.initiator, body.reason),
      '/api/message/pin': () => pinMessage(body.msgId, body.room, body.initiator),
      '/api/message/unpin': () => unpinMessage(body.msgId, body.room, body.initiator),

      // Pull (home requests room chatlog)
      '/api/room/pull': () => {
        const agent = body.participant;
        const roomName = body.room;
        if (!directory[agent]) return { error: `Unknown: ${agent}` };
        if (!rooms[roomName]) return { error: `Unknown room: ${roomName}` };
        if (!rooms[roomName].participants.includes(agent)) return { error: `${agent} not in ${roomName}` };
        const dispatchId = generateUID('disp');
        logOp('dispatch.pull', body.initiator || agent, roomName, { participant: agent, dispatchId });
        return { success: true, dispatchId, room: roomName, roomchatlog: rooms[roomName].chatlog };
      },
    };

    const handler = routes[p];
    if (!handler) return respond(res, 404, { error: 'Not found' });
    const result = handler();
    return respond(res, result.error ? 400 : 200, result);
  }

  respond(res, 405, { error: 'Method not allowed' });
});

// ========================================
// SEED (only if empty)
// ========================================

if (Object.keys(directory).length === 0 && Object.keys(rooms).length === 0) {
  console.log('Seeding default data...');
  registerParticipant('yeshua', null, 'system');
  registerParticipant('alpha', null, 'system');   // haiku 4.5 (api key)
  registerParticipant('beta', null, 'system');    // sonnet 4.5 (api key)
  registerParticipant('gamma', null, 'system');   // haiku 4.5 (oauth)

  createRoom('boardroom', 'system');

  joinRoom('yeshua', 'boardroom', 'system');
  joinRoom('alpha', 'boardroom', 'system');
  joinRoom('beta', 'boardroom', 'system');
  joinRoom('gamma', 'boardroom', 'system');
}

// ========================================
// START
// ========================================

server.listen(PORT, () => {
  console.log(`\n  BLUM ROOM SERVER`);
  console.log(`  ════════════════`);
  console.log(`  Port:       ${PORT}`);
  console.log(`  Data:       ${DATA_DIR}`);
  console.log(`  API:        http://localhost:${PORT}/api/state`);
  console.log(`  ────────────────`);
  console.log(`  ${Object.keys(directory).length} registered, ${Object.keys(rooms).length} rooms`);
  console.log(`  Ready.\n`);
});
