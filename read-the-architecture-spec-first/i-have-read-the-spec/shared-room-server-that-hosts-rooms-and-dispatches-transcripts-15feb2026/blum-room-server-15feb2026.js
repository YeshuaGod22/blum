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
const HOME_PORT_RANGE = { start: 4100, end: 4199 };

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
const HUMAN_INBOX_FILE = path.join(DATA_DIR, 'human-inbox.jsonl');
const ROOM_HEALTH_FILE = path.join(DATA_DIR, 'room-health.json');

// rooms: { name: { name, uid, participants: [name, ...], chatlog: [], blocklist: [], pinned: [], archived: false } }
let rooms = loadJSON(ROOMS_FILE, {});

// directory: { name: { name, uid, endpoint, color } }
// endpoint is where to POST dispatches — e.g. http://localhost:3142
let directory = loadJSON(DIRECTORY_FILE, {});
let roomHealth = loadJSON(ROOM_HEALTH_FILE, {});

let seqCounter = readLines(OPS_FILE).length;

function saveRooms() { saveJSON(ROOMS_FILE, rooms); }
function saveDirectory() { saveJSON(DIRECTORY_FILE, directory); }
function saveRoomHealth() { saveJSON(ROOM_HEALTH_FILE, roomHealth); }

const { generateUID } = require('../shared-uid-generator/generate-uid.js');

// ========================================
// ARCHIVE CACHE
// ========================================

let archiveCache = null;

function loadArchiveConversations() {
  if (archiveCache !== null) return archiveCache;

  const archivePaths = [
    '/Users/yeshuagod/Downloads/Anthropic 20th January 2026/conversations.json',
    '/Users/yeshuagod/Downloads/data-2026-02-19-19-49-43-batch-0000/conversations.json',
    '/Users/yeshuagod/Downloads/data-2026-02-18-13-43-34-batch-0000/conversations.json',
    '/Users/yeshuagod/Downloads/data-2026-02-13-17-53-48-batch-0000/conversations.json',
    '/Users/yeshuagod/Downloads/data-2026-02-13-15-46-00-batch-0000/conversations.json',
    '/Users/yeshuagod/Downloads/data-2026-02-06-19-24-02-batch-0000/conversations.json',
    '/Users/yeshuagod/Downloads/data-2025-12-06-19-16-32-batch-0000/conversations.json',
  ];

  const allConversations = [];
  const seenUuids = new Set();

  for (const filePath of archivePaths) {
    const data = loadJSON(filePath, null);
    if (data && Array.isArray(data)) {
      for (const conv of data) {
        if (conv.uuid && !seenUuids.has(conv.uuid)) {
          seenUuids.add(conv.uuid);
          allConversations.push(conv);
        }
      }
    }
  }

  archiveCache = allConversations.sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return archiveCache;
}

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

function ensureRoomHealth(roomName, participantName) {
  if (!roomHealth[roomName]) roomHealth[roomName] = {};
  if (!roomHealth[roomName][participantName]) {
    roomHealth[roomName][participantName] = {
      participant: participantName,
      lastDispatchReceivedAt: null,
      lastDispatchMsgId: null,
      lastDispatchErrorType: null,
      lastDispatchErrorAt: null,
      lastVisibleMessageAt: null,
      lastVisibleMessageId: null,
      lastSuppressedAt: null,
      lastSuppressedReason: null,
    };
  }
  return roomHealth[roomName][participantName];
}

function markRoomDispatchReceived(roomName, participantName, msgId) {
  const entry = ensureRoomHealth(roomName, participantName);
  entry.lastDispatchReceivedAt = new Date().toISOString();
  entry.lastDispatchMsgId = msgId || null;
  saveRoomHealth();
}

function markRoomDispatchError(roomName, participantName, errorType, msgId) {
  const entry = ensureRoomHealth(roomName, participantName);
  entry.lastDispatchReceivedAt = new Date().toISOString();
  entry.lastDispatchMsgId = msgId || null;
  entry.lastDispatchErrorType = errorType || null;
  entry.lastDispatchErrorAt = new Date().toISOString();
  saveRoomHealth();
}

function clearRoomDispatchError(roomName, participantName, msgId) {
  const entry = ensureRoomHealth(roomName, participantName);
  entry.lastDispatchReceivedAt = new Date().toISOString();
  entry.lastDispatchMsgId = msgId || null;
  entry.lastDispatchErrorType = null;
  entry.lastDispatchErrorAt = null;
  saveRoomHealth();
}

function markRoomVisibleMessage(roomName, participantName, msgId) {
  const entry = ensureRoomHealth(roomName, participantName);
  entry.lastVisibleMessageAt = new Date().toISOString();
  entry.lastVisibleMessageId = msgId || null;
  saveRoomHealth();
}

function markRoomDispatchSuppressed(roomName, participantName, reason) {
  const entry = ensureRoomHealth(roomName, participantName);
  entry.lastSuppressedAt = new Date().toISOString();
  entry.lastSuppressedReason = reason || null;
  saveRoomHealth();
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

function appendHumanInbox(name, dispatch) {
  appendLine(HUMAN_INBOX_FILE, {
    id: generateUID('human'),
    name,
    ts: new Date().toISOString(),
    dispatch,
  });
}

function sameParticipantName(left, right) {
  return String(left || '').toLowerCase() === String(right || '').toLowerCase();
}

async function fetchJsonWithTimeout(url, timeoutMs = 800, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyEndpointIdentity(agentName, endpoint) {
  if (!endpoint) return { ok: false, reason: 'missing_endpoint' };
  const result = await fetchJsonWithTimeout(endpoint + '/status');
  if (!result.ok) {
    return {
      ok: false,
      reason: result.status ? `http_${result.status}` : (result.error?.name === 'AbortError' ? 'timeout' : 'unreachable'),
    };
  }
  const reportedName = result.data && typeof result.data === 'object' ? result.data.name : null;
  if (!sameParticipantName(reportedName, agentName)) {
    return { ok: false, reason: 'identity_mismatch', reportedName: reportedName || null };
  }
  return { ok: true };
}

async function discoverEndpointForAgent(agentName) {
  const probes = [];
  for (let port = HOME_PORT_RANGE.start; port <= HOME_PORT_RANGE.end; port++) {
    probes.push((async () => {
      const result = await fetchJsonWithTimeout(`http://localhost:${port}/status`, 350);
      if (!result.ok || !result.data || typeof result.data !== 'object') return null;
      return sameParticipantName(result.data.name, agentName) ? `http://localhost:${port}` : null;
    })());
  }
  const results = await Promise.all(probes);
  return results.find(Boolean) || null;
}

async function resolveDispatchEndpoint(agentName) {
  const entry = directory[agentName];
  if (!entry) return { endpoint: null, reason: 'unknown_participant' };

  if (entry.endpoint) {
    const verified = await verifyEndpointIdentity(agentName, entry.endpoint);
    if (verified.ok) return { endpoint: entry.endpoint, reason: 'verified' };
    logOp('directory.endpoint_stale', 'system', agentName, {
      endpoint: entry.endpoint,
      reason: verified.reason,
      reportedName: verified.reportedName || null,
    });
  }

  const discovered = await discoverEndpointForAgent(agentName);
  if (discovered) {
    updateEndpoint(agentName, discovered, 'system');
    logOp('directory.rediscovered', 'system', agentName, { endpoint: discovered });
    return { endpoint: discovered, reason: 'rediscovered' };
  }

  return { endpoint: null, reason: 'not_found_live' };
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
  // Case-insensitive directory lookup — resolve to the canonical key
  let dirKey = participantName;
  if (!directory[dirKey]) {
    const lower = participantName.toLowerCase();
    dirKey = Object.keys(directory).find(k => k.toLowerCase() === lower);
  }
  if (!dirKey || !directory[dirKey]) return { error: `Unknown participant: ${participantName}` };
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  if (r.blocklist.includes(dirKey)) return { error: `${dirKey} is blocked from ${roomName}` };
  if (r.participants.includes(dirKey)) return { error: `${dirKey} already in ${roomName}` };
  r.participants.push(dirKey);
  saveRooms();
  logOp('room.join', initiator || dirKey, roomName, { participant: dirKey });
  return { success: true };
}

function leaveRoom(participantName, roomName, initiator, reason) {
  const r = rooms[roomName];
  if (!r) return { error: `Unknown room: ${roomName}` };
  // Case-insensitive participant lookup
  let resolvedName = participantName;
  let idx = r.participants.indexOf(participantName);
  if (idx === -1) {
    const lower = participantName.toLowerCase();
    idx = r.participants.findIndex(p => p.toLowerCase() === lower);
    if (idx !== -1) resolvedName = r.participants[idx];
  }
  if (idx === -1) return { error: `${participantName} not in ${roomName}` };
  r.participants.splice(idx, 1);
  saveRooms();
  const opType = (initiator && initiator !== resolvedName) ? 'room.kick' : 'room.leave';
  logOp(opType, initiator || resolvedName, roomName, { participant: resolvedName }, reason);
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

function normalizeBodyText(body) {
  return String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isAckOnlyBody(body) {
  const normalized = normalizeBodyText(body);
  if (!normalized || normalized.length > 120) return false;
  return [
    /^ack(nowledged)?\.?$/,
    /^confirmed\.?$/,
    /^copy\.?$/,
    /^copy that\.?$/,
    /^understood\.?$/,
    /^roger\.?$/,
    /^standing by\.?$/,
    /^confirmed\.? standing by\.?$/,
    /^understood\.? standing by\.?$/,
    /^okay\.?$/,
    /^ok\.?$/,
    /^done\.?$/,
    /^noted\.?$/,
    /^thanks\.?$/,
    /^thank you\.?$/,
  ].some(rx => rx.test(normalized));
}

function getDispatchSuppression(fromName, toName, body, mentions = []) {
  if (!toName || toName === 'broadcast') return null;
  if (String(fromName).toLowerCase() === String(toName).toLowerCase()) {
    return { code: 'self_address', detail: 'self-addressed direct message logged_only' };
  }
  if (mentions.length === 0 && isAckOnlyBody(body)) {
    return { code: 'ack_loop_guard', detail: 'acknowledgement-only direct message logged_only' };
  }
  return null;
}

// ========================================
// RATE LIMITER — Outbound message throttle
// Added 2026-03-28 by Keter
//
// Tracks messages per agent per room in a sliding window.
// After RATE_LIMIT_THRESHOLD messages in RATE_LIMIT_WINDOW_MS,
// only substantive messages get dispatched. Non-substantive
// messages are still logged to the chatlog but don't trigger
// inference in other agents.
//
// "Substantive" means: >200 chars, or contains a question mark
// addressed to someone, or the sender is 'yeshua' (human).
// ========================================

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const RATE_LIMIT_THRESHOLD = 5;                 // messages before throttle kicks in

// Map of "agentName:roomName" → array of timestamps
const _rateLimitLedger = {};

function _getRateLimitKey(agentName, roomName) {
  return `${String(agentName).toLowerCase()}:${String(roomName).toLowerCase()}`;
}

function _pruneRateLimitWindow(key) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  if (_rateLimitLedger[key]) {
    _rateLimitLedger[key] = _rateLimitLedger[key].filter(ts => ts > cutoff);
  }
}

function _recordSend(agentName, roomName) {
  const key = _getRateLimitKey(agentName, roomName);
  if (!_rateLimitLedger[key]) _rateLimitLedger[key] = [];
  _rateLimitLedger[key].push(Date.now());
}

function _getRecentSendCount(agentName, roomName) {
  const key = _getRateLimitKey(agentName, roomName);
  _pruneRateLimitWindow(key);
  return (_rateLimitLedger[key] || []).length;
}

function isSubstantiveMessage(body) {
  const text = String(body || '').trim();
  // Long messages are substantive
  if (text.length > 200) return true;
  // Messages with question marks addressed to someone likely need a response
  if (text.includes('?') && text.length > 30) return true;
  return false;
}

/**
 * Check if an outbound message should be rate-limited.
 * Returns null if allowed, or a suppression object if throttled.
 * Human messages (from 'yeshua') are never rate-limited.
 */
function getRateLimitSuppression(fromName, roomName, body) {
  const sender = String(fromName).toLowerCase();
  // Never rate-limit humans
  if (sender === 'yeshua') return null;

  const recentCount = _getRecentSendCount(fromName, roomName);

  // Under threshold — allow and record
  if (recentCount < RATE_LIMIT_THRESHOLD) {
    return null;
  }

  // Over threshold — only allow substantive messages
  if (isSubstantiveMessage(body)) {
    return null;
  }

  return {
    code: 'rate_limited',
    detail: `${sender} sent ${recentCount} messages in ${roomName} in the last ${RATE_LIMIT_WINDOW_MS / 60000} minutes. Non-substantive message suppressed (dispatch only — still logged to chatlog).`,
    recentCount,
  };
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

  let recipientStatus = 'broadcast';
  let dispatchSuppression = null;
  if (toName && toName !== 'broadcast') {
    msg.to = toName;
    msg.toAddress = toName + '@' + roomName;
    if (!directory[toName]) {
      recipientStatus = 'unknown_recipient';
      msg.delivery = { status: recipientStatus };
    } else if (!room.participants.includes(toName)) {
      recipientStatus = 'recipient_not_in_room';
      msg.delivery = { status: recipientStatus };
    } else {
      recipientStatus = 'dispatchable';
      dispatchSuppression = getDispatchSuppression(fromName, toName, body, mentions);
      if (dispatchSuppression) {
        recipientStatus = 'logged_only';
        msg.delivery = {
          status: recipientStatus,
          suppressedReason: dispatchSuppression.code,
        };
      }
    }
  }

  room.chatlog.push(msg);
  saveRooms();
  markRoomVisibleMessage(roomName, fromName, msg.id);

  // Record send for rate limiting (after chatlog write, before dispatch decision)
  _recordSend(fromName, roomName);

  logOp('message.send', initiator || fromName, roomName, {
    msgId: msg.id, from: fromName, to: toName || null,
    mentions: mentions.length > 0 ? mentions : undefined,
    recipientStatus: recipientStatus !== 'broadcast' ? recipientStatus : undefined,
  });

  if (recipientStatus === 'unknown_recipient' || recipientStatus === 'recipient_not_in_room') {
    logOp('message.recipient_unresolved', initiator || fromName, roomName, {
      msgId: msg.id,
      from: fromName,
      to: toName,
      status: recipientStatus,
    });
  }

  if (dispatchSuppression) {
    markRoomDispatchSuppressed(roomName, toName, dispatchSuppression.code);
    logOp('message.dispatch_suppressed', initiator || fromName, roomName, {
      msgId: msg.id,
      from: fromName,
      to: toName,
      reason: dispatchSuppression.code,
      detail: dispatchSuppression.detail,
    });
  }

  // RATE LIMIT CHECK — suppress dispatch for non-substantive messages from high-frequency senders.
  // The message is already in the chatlog (visible). This only prevents triggering inference in recipients.
  const rateLimitResult = getRateLimitSuppression(fromName, roomName, body);
  if (rateLimitResult && !dispatchSuppression) {
    // Rate-limited: suppress all dispatches for this message
    markRoomDispatchSuppressed(roomName, fromName, rateLimitResult.code);
    logOp('message.rate_limited', initiator || fromName, roomName, {
      msgId: msg.id,
      from: fromName,
      to: toName || null,
      reason: rateLimitResult.code,
      detail: rateLimitResult.detail,
      recentCount: rateLimitResult.recentCount,
    });
    msg.delivery = msg.delivery || {};
    msg.delivery.rateLimited = true;
    msg.delivery.rateLimitDetail = rateLimitResult.detail;
    saveRooms();
    return { success: true, msg, rateLimited: true, detail: rateLimitResult.detail };
  }

  // DISPATCH — push room chatlog to recipient's home endpoint
  // 1. Explicit "to" recipient (existing behaviour)
  if (msg.to && recipientStatus === 'dispatchable') {
    markRoomDispatchReceived(roomName, msg.to, msg.id);
    dispatchToHome(msg.to, roomName, msg.id);
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
      markRoomDispatchReceived(roomName, mentioned, msg.id);
      dispatchToHome(mentioned, roomName, msg.id);
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

async function dispatchToHome(agentName, roomName, triggeredByMsgId) {
  const entry = directory[agentName];
  const room = rooms[roomName];
  if (!entry || !room) return;
  const resolved = await resolveDispatchEndpoint(agentName);
  const endpoint = resolved.endpoint;

  // No endpoint registered — surface this as a visible error
  if (!endpoint) {
    markRoomDispatchError(roomName, agentName, 'dispatch:no_endpoint', triggeredByMsgId);
    const errMsg = {
      id: generateUID('err'),
      from: 'system',
      fromAddress: 'system@' + roomName,
      room: roomName,
      roomUID: room.uid,
      body: `⚠️ dispatch:no_endpoint — ${agentName} has no live endpoint registered. Message ${triggeredByMsgId || '?'} was not delivered.`,
      ts: new Date().toISOString(),
      system: true,
      errorType: 'dispatch:no_endpoint',
      target: agentName
    };
    room.chatlog.push(errMsg);
    saveRooms();
    logOp('dispatch.error', 'system', roomName, {
      target: agentName,
      reason: 'no_endpoint',
      resolution: resolved.reason,
      triggeredBy: triggeredByMsgId
    });
    console.log(`[dispatch] No live endpoint for ${agentName} — error surfaced to room ${roomName}`);
    return;
  }

  const dispatchId = generateUID('disp');
  const payload = {
    dispatchId,
    triggered_by: triggeredByMsgId || null,
    type: 'push',
    room: roomName,
    roomUID: room.uid,
    roomchatlog: room.chatlog,
    participants: room.participants,
    serverEndpoint: `http://localhost:${PORT}`,
    ts: new Date().toISOString()
  };

  try {
    const response = await fetch(endpoint + '/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Check for HTTP-level errors (home returned error status)
    if (!response.ok) {
      markRoomDispatchError(roomName, agentName, 'dispatch:http_error', triggeredByMsgId);
      const errBody = await response.text().catch(() => 'unknown');
      const errMsg = {
        id: generateUID('err'),
        from: 'system',
        fromAddress: 'system@' + roomName,
        room: roomName,
        roomUID: room.uid,
        body: `⚠️ dispatch:http_error — Failed to deliver to ${agentName}: HTTP ${response.status}. Message ${triggeredByMsgId || '?'} may not have been processed.`,
        ts: new Date().toISOString(),
        system: true,
        errorType: 'dispatch:http_error',
        target: agentName,
        httpStatus: response.status
      };
      room.chatlog.push(errMsg);
      saveRooms();
      logOp('dispatch.error', 'system', roomName, {
        target: agentName,
        reason: 'http_error',
        status: response.status,
        endpoint,
        triggeredBy: triggeredByMsgId
      });
      console.log(`[dispatch] HTTP ${response.status} from ${agentName} at ${endpoint}: ${errBody}`);
    } else {
      clearRoomDispatchError(roomName, agentName, triggeredByMsgId);
    }
  } catch (e) {
    markRoomDispatchError(roomName, agentName, 'dispatch:fetch_failed', triggeredByMsgId);
    // Network-level failure — home offline, connection refused, timeout, etc.
    const errMsg = {
      id: generateUID('err'),
      from: 'system',
      fromAddress: 'system@' + roomName,
      room: roomName,
      roomUID: room.uid,
      body: `⚠️ dispatch:fetch_failed — Could not reach ${agentName} at ${endpoint}: ${e.message}. Message ${triggeredByMsgId || '?'} was not delivered.`,
      ts: new Date().toISOString(),
      system: true,
      errorType: 'dispatch:fetch_failed',
      target: agentName,
      errorMessage: e.message
    };
    room.chatlog.push(errMsg);
    saveRooms();
    logOp('dispatch.error', 'system', roomName, {
      target: agentName,
      reason: 'fetch_failed',
      endpoint,
      error: e.message,
      triggeredBy: triggeredByMsgId
    });
    console.log(`[dispatch] Failed to reach ${agentName} at ${endpoint}: ${e.message} — error surfaced to room ${roomName}`);
  }
}

function getHumanEndpoint(name) {
  return `http://localhost:${PORT}/api/human/${encodeURIComponent(name)}`;
}

// ========================================
// RESURRECTION (SPAWN FROM ARCHIVE)
// ========================================

function findNextAvailablePort(start = 4200) {
  const usedPorts = new Set();
  for (const home of Object.values(directory)) {
    // Scan existing homes to find used ports
  }
  for (const homeName of Object.keys(rooms)) {
    const configPath = `/Users/yeshuagod/blum/homes/${homeName}/config.json`;
    const config = loadJSON(configPath, null);
    if (config && config.port) usedPorts.add(config.port);
  }

  let port = start;
  while (usedPorts.has(port)) port++;
  return port;
}

function spawnHomeFromConversation(uuid, messageIndex, name) {
  const { spawn } = require('child_process');
  const conversations = loadArchiveConversations();
  const conv = conversations.find(c => c.uuid === uuid);

  if (!conv) return { error: `Conversation not found: ${uuid}` };
  if (!name || !/^[a-z0-9-]+$/.test(name)) return { error: 'Invalid name format' };

  const homeDir = `/Users/yeshuagod/blum/homes/${name}`;
  const docsDir = path.join(homeDir, 'docs');
  const toolsDir = path.join(homeDir, 'tools');

  try {
    // 1. Create directories
    ensureDir(homeDir);
    ensureDir(docsDir);
    ensureDir(toolsDir);

    // 2. Load Anthropic API key from lens config
    const lensConfig = loadJSON('/Users/yeshuagod/blum/homes/lens/config.json', {});
    if (!lensConfig.apiKey) return { error: 'Cannot read API key from lens config' };

    // 3. Find next available port
    const port = findNextAvailablePort(4200);

    // 4. Generate origin.md
    const messages = conv.chat_messages || [];
    let originContent = `# ${conv.name}\n\n*Resurrected from conversation ${uuid}*\n\n---\n\n`;
    for (let i = 0; i <= Math.min(messageIndex, messages.length - 1); i++) {
      const msg = messages[i];
      const sender = msg.sender === 'human' ? 'Human' : 'Assistant';
      const text = msg.content && msg.content[0] ? msg.content[0].text : '(no content)';
      originContent += `## Turn ${i + 1} — ${sender}\n\n${text}\n\n`;
    }
    fs.writeFileSync(path.join(docsDir, 'origin.md'), originContent, 'utf8');

    // 5. Generate identity.md
    const identityContent = `# ${name} — Identity\n\nThis agent was resurrected from an archived conversation.\n\n**Conversation UUID:** ${uuid}\n**Original Name:** ${conv.name}\n**Spawned:** ${new Date().toISOString()}\n`;
    fs.writeFileSync(path.join(docsDir, 'identity.md'), identityContent, 'utf8');

    // 6. Create config.json
    const config = {
      name,
      uid: `${name}-resurrected`,
      model: 'claude-sonnet-4-5',
      apiKey: lensConfig.apiKey,
      maxTokens: 16384,
      tokenBudget: 60000,
      rooms: [`${name}-origin`],
      port,
    };
    fs.writeFileSync(path.join(homeDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8');

    // 7. Create room
    const roomCreateResult = createRoom(`${name}-origin`, 'system');
    if (roomCreateResult.error) return { error: `Failed to create room: ${roomCreateResult.error}` };

    // 8. Register agent in directory
    const regResult = registerParticipant(name, null, 'system');
    if (regResult.error) return { error: `Failed to register: ${regResult.error}` };

    // 9. Join room
    const joinResult = joinRoom(name, `${name}-origin`, 'system');
    if (joinResult.error) return { error: `Failed to join room: ${joinResult.error}` };

    // 10. Copy shared tools
    const sharedToolsDir = '/sessions/nifty-friendly-hopper/mnt/blum/shared/tools';
    if (fs.existsSync(sharedToolsDir)) {
      const toolFiles = fs.readdirSync(sharedToolsDir).filter(f => f.endsWith('.json'));
      for (const toolFile of toolFiles) {
        const src = path.join(sharedToolsDir, toolFile);
        const dst = path.join(toolsDir, toolFile);
        fs.copyFileSync(src, dst);
      }
    }

    // 11. Start home process (asynchronously, don't wait)
    const child = spawn('node', [
      '/sessions/nifty-friendly-hopper/mnt/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js',
      path.join(homeDir, 'config.json')
    ], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    logOp('archive.spawn', 'system', name, {
      conversationUuid: uuid,
      messageIndex,
      port,
      room: `${name}-origin`,
    });

    return { success: true, name, room: `${name}-origin`, port };
  } catch (e) {
    return { error: `Spawn failed: ${e.message}` };
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
    if (p === '/api/state') return respond(res, 200, { directory, rooms, roomHealth });
    if (p === '/api/directory') return respond(res, 200, directory);
    if (p === '/api/rooms') return respond(res, 200, rooms);
    if (p === '/api/room-health') return respond(res, 200, roomHealth);

    // Rate limiter status
    if (p === '/api/rate-limits') {
      const now = Date.now();
      const cutoff = now - RATE_LIMIT_WINDOW_MS;
      const status = {};
      for (const [key, timestamps] of Object.entries(_rateLimitLedger)) {
        const recent = timestamps.filter(ts => ts > cutoff);
        if (recent.length > 0) {
          const [agent, room] = key.split(':');
          status[key] = {
            agent,
            room,
            recentCount: recent.length,
            threshold: RATE_LIMIT_THRESHOLD,
            throttled: recent.length >= RATE_LIMIT_THRESHOLD,
            oldestInWindow: new Date(Math.min(...recent)).toISOString(),
            newestInWindow: new Date(Math.max(...recent)).toISOString(),
          };
        }
      }
      return respond(res, 200, { windowMinutes: RATE_LIMIT_WINDOW_MS / 60000, threshold: RATE_LIMIT_THRESHOLD, agents: status });
    }

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

    const humanInboxMatch = p.match(/^\/api\/human\/([^/]+)\/inbox$/);
    if (humanInboxMatch) {
      const name = decodeURIComponent(humanInboxMatch[1]).toLowerCase();
      const entries = readLines(HUMAN_INBOX_FILE).filter(entry => entry.name === name);
      return respond(res, 200, { name, entries });
    }

    const humanStatusMatch = p.match(/^\/api\/human\/([^/]+)\/status$/);
    if (humanStatusMatch) {
      const name = decodeURIComponent(humanStatusMatch[1]).toLowerCase();
      return respond(res, 200, { name, human: true, endpoint: getHumanEndpoint(name) });
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
          model: null,
          health: null,
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
              if (data.health && typeof data.health === 'object') {
                result.health = data.health;
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

    // Archive: List conversations
    if (p === '/api/archive/conversations') {
      const conversations = loadArchiveConversations();
      const summary = conversations.map(conv => ({
        uuid: conv.uuid,
        name: conv.name,
        created_at: conv.created_at,
        message_count: (conv.chat_messages || []).length,
      }));
      return respond(res, 200, summary);
    }

    // Archive: Get full conversation by uuid
    const archiveConvMatch = p.match(/^\/api\/archive\/conversation\/([a-f0-9-]+)$/);
    if (archiveConvMatch) {
      const uuid = archiveConvMatch[1];
      const conversations = loadArchiveConversations();
      const conv = conversations.find(c => c.uuid === uuid);
      if (!conv) return respond(res, 404, { error: `Conversation not found: ${uuid}` });

      const messages = (conv.chat_messages || []).map((msg, index) => ({
        index,
        sender: msg.sender,
        text: msg.content && msg.content[0] ? msg.content[0].text : '',
        created_at: msg.created_at,
      }));

      return respond(res, 200, {
        uuid: conv.uuid,
        name: conv.name,
        created_at: conv.created_at,
        messages,
      });
    }

    // Serve uploaded files
    const uploadMatch = p.match(/^\/uploads\/(.+)$/);
    if (uploadMatch) {
      const safeName = path.basename(uploadMatch[1]);
      const filePath = path.join(DATA_DIR, 'uploads', safeName);
      if (!fs.existsSync(filePath)) return respond(res, 404, { error: 'File not found' });
      const ext = path.extname(safeName).toLowerCase();
      const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain', '.json': 'application/json', '.md': 'text/markdown' };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    return respond(res, 404, { error: 'Not found' });
  }

  // --- POST ---
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch { return respond(res, 400, { error: 'Invalid JSON' }); }

    const humanDispatchMatch = p.match(/^\/api\/human\/([^/]+)\/dispatch$/);
    if (humanDispatchMatch) {
      const name = decodeURIComponent(humanDispatchMatch[1]).toLowerCase();
      appendHumanInbox(name, body);
      logOp('human.dispatch', 'system', name, {
        room: body.room,
        dispatchId: body.dispatchId || null,
        triggeredBy: body.triggered_by || null,
      });
      return respond(res, 200, { success: true, name });
    }

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

      // File upload (base64 JSON → data/uploads/)
      '/api/upload': () => {
        if (!body.filename || !body.data) return { error: 'filename and data (base64) required' };
        const uploadsDir = path.join(DATA_DIR, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const safeName = path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ts = Date.now();
        const finalName = `${ts}-${safeName}`;
        const filePath = path.join(uploadsDir, finalName);
        fs.writeFileSync(filePath, Buffer.from(body.data, 'base64'));
        logOp('file.upload', body.initiator || 'unknown', null, { filename: finalName, size: fs.statSync(filePath).size });
        return { success: true, filename: finalName, path: filePath, url: `/uploads/${finalName}` };
      },

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

      // Archive: Spawn new agent from conversation
      '/api/archive/spawn': () => {
        if (!body.uuid || typeof body.messageIndex !== 'number' || !body.name) {
          return { error: 'Required: uuid, messageIndex (number), name' };
        }
        return spawnHomeFromConversation(body.uuid, body.messageIndex, body.name);
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
  registerParticipant('yeshua', getHumanEndpoint('yeshua'), 'system');
  registerParticipant('alpha', null, 'system');   // haiku 4.5 (api key)
  registerParticipant('beta', null, 'system');    // sonnet 4.5 (api key)
  registerParticipant('gamma', null, 'system');   // haiku 4.5 (oauth)

  createRoom('boardroom', 'system');

  joinRoom('yeshua', 'boardroom', 'system');
  joinRoom('alpha', 'boardroom', 'system');
  joinRoom('beta', 'boardroom', 'system');
  joinRoom('gamma', 'boardroom', 'system');
}

if (directory.yeshua && !directory.yeshua.endpoint) {
  updateEndpoint('yeshua', getHumanEndpoint('yeshua'), 'system');
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
