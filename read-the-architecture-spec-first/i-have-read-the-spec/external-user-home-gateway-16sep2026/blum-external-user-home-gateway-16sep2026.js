#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOM_SERVER = process.env.BLUM_ROOM_SERVER || 'http://127.0.0.1:3141';
const PARTICIPANT = (process.env.BLUM_EXTERNAL_PARTICIPANT || 'chatgpt-yeshua').toLowerCase();
const API_TOKEN = process.env.BLUM_EXTERNAL_GATEWAY_TOKEN || '';
const API_BIND = process.env.BLUM_EXTERNAL_API_BIND || '127.0.0.1';
const API_PORT = Number(process.env.BLUM_EXTERNAL_API_PORT || 3151);
const DISPATCH_BIND = process.env.BLUM_EXTERNAL_DISPATCH_BIND || '127.0.0.1';
const DISPATCH_PORT = Number(process.env.BLUM_EXTERNAL_DISPATCH_PORT || 3152);
const ALLOWED_ROOMS = new Set(
  (process.env.BLUM_EXTERNAL_ROOMS || 'exp003-lab')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);
const DATA_DIR = process.env.BLUM_EXTERNAL_GATEWAY_DATA_DIR || path.join(__dirname, 'data');
const INBOX_FILE = path.join(DATA_DIR, `${PARTICIPANT}-inbox.jsonl`);
const MAX_BODY_BYTES = 1024 * 1024;

if (!API_TOKEN) {
  console.error('BLUM_EXTERNAL_GATEWAY_TOKEN is required');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(match && safeEqual(match[1], API_TOKEN));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('invalid JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

async function roomRequest(method, pathname, body) {
  const response = await fetch(new URL(pathname, ROOM_SERVER), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { payload = { raw: text }; }
  if (!response.ok || payload.error) {
    const error = new Error(payload.error || `room server returned HTTP ${response.status}`);
    error.statusCode = response.status || 502;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function assertAllowedRoom(room) {
  if (!ALLOWED_ROOMS.has(room)) {
    const error = new Error(`room not allowed: ${room}`);
    error.statusCode = 403;
    throw error;
  }
}

function appendDispatch(dispatch) {
  const record = {
    dispatchId: dispatch.dispatchId || null,
    triggeredBy: dispatch.triggered_by || null,
    room: dispatch.room || null,
    roomUID: dispatch.roomUID || null,
    receivedAt: new Date().toISOString(),
    dispatch,
  };
  fs.appendFileSync(INBOX_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

function readInbox() {
  if (!fs.existsSync(INBOX_FILE)) return [];
  return fs.readFileSync(INBOX_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function bootstrap() {
  const dispatchEndpoint = `http://${DISPATCH_BIND}:${DISPATCH_PORT}`;
  const directory = await roomRequest('GET', '/api/directory');
  const existing = directory[PARTICIPANT];

  if (!existing) {
    await roomRequest('POST', '/api/directory/register', {
      name: PARTICIPANT,
      endpoint: dispatchEndpoint,
      initiator: PARTICIPANT,
    });
  } else if (existing.endpoint !== dispatchEndpoint) {
    await roomRequest('POST', '/api/directory/update-endpoint', {
      name: PARTICIPANT,
      endpoint: dispatchEndpoint,
      initiator: PARTICIPANT,
    });
  }

  const rooms = await roomRequest('GET', '/api/rooms');
  for (const roomName of ALLOWED_ROOMS) {
    const room = rooms[roomName];
    if (!room) throw new Error(`required room does not exist: ${roomName}`);
    if (!room.participants.includes(PARTICIPANT)) {
      await roomRequest('POST', '/api/room/join', {
        participant: PARTICIPANT,
        room: roomName,
        initiator: PARTICIPANT,
      });
    }
  }
}

const dispatchServer = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/dispatch') {
    return json(res, 404, { error: 'not found' });
  }
  try {
    const dispatch = await readJsonBody(req);
    if (!dispatch.dispatchId || !dispatch.room || !Array.isArray(dispatch.roomchatlog)) {
      return json(res, 400, { error: 'invalid Blum dispatch payload' });
    }
    if (!ALLOWED_ROOMS.has(dispatch.room)) {
      return json(res, 403, { error: `dispatch room not allowed: ${dispatch.room}` });
    }
    const record = appendDispatch(dispatch);
    return json(res, 200, { success: true, dispatchId: record.dispatchId });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message });
  }
});

const apiServer = http.createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return json(res, 401, { error: 'unauthorized' });
  }

  const url = new URL(req.url, `http://${API_BIND}:${API_PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/v1/status') {
      const directory = await roomRequest('GET', '/api/directory');
      const rooms = await roomRequest('GET', '/api/rooms');
      return json(res, 200, {
        participant: PARTICIPANT,
        roomServer: ROOM_SERVER,
        allowedRooms: [...ALLOWED_ROOMS],
        registered: Boolean(directory[PARTICIPANT]),
        memberships: [...ALLOWED_ROOMS].filter(name => rooms[name]?.participants?.includes(PARTICIPANT)),
        inboxCount: readInbox().length,
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/inbox') {
      const after = url.searchParams.get('after');
      const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
      let entries = readInbox();
      if (after) entries = entries.filter(entry => entry.receivedAt > after);
      return json(res, 200, { participant: PARTICIPANT, entries: entries.slice(-limit) });
    }

    const messagesMatch = /^\/v1\/rooms\/([^/]+)\/messages$/.exec(url.pathname);
    if (req.method === 'GET' && messagesMatch) {
      const room = decodeURIComponent(messagesMatch[1]);
      assertAllowedRoom(room);
      const payload = await roomRequest('POST', '/api/room/pull', {
        participant: PARTICIPANT,
        room,
        initiator: PARTICIPANT,
      });
      return json(res, 200, payload);
    }

    const sendMatch = /^\/v1\/rooms\/([^/]+)\/send$/.exec(url.pathname);
    if (req.method === 'POST' && sendMatch) {
      const room = decodeURIComponent(sendMatch[1]);
      assertAllowedRoom(room);
      const body = await readJsonBody(req);
      if (!body.body || typeof body.body !== 'string') {
        return json(res, 400, { error: 'body.body string is required' });
      }
      const payload = await roomRequest('POST', '/api/message/send', {
        from: PARTICIPANT,
        to: body.to || null,
        room,
        body: body.body,
        replyTo: body.replyTo || null,
        initiator: PARTICIPANT,
      });
      return json(res, 200, payload);
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    return json(res, error.statusCode || 502, {
      error: error.message,
      upstream: error.payload || undefined,
    });
  }
});

async function start() {
  await new Promise((resolve, reject) => {
    dispatchServer.once('error', reject);
    dispatchServer.listen(DISPATCH_PORT, DISPATCH_BIND, resolve);
  });

  try {
    await bootstrap();
  } catch (error) {
    dispatchServer.close();
    throw error;
  }

  await new Promise((resolve, reject) => {
    apiServer.once('error', reject);
    apiServer.listen(API_PORT, API_BIND, resolve);
  });

  console.log(`Blum external user home gateway`);
  console.log(`participant: ${PARTICIPANT}`);
  console.log(`dispatch:    http://${DISPATCH_BIND}:${DISPATCH_PORT}/dispatch`);
  console.log(`external API http://${API_BIND}:${API_PORT}/v1/...`);
  console.log(`rooms:       ${[...ALLOWED_ROOMS].join(', ')}`);
}

function shutdown() {
  apiServer.close(() => {});
  dispatchServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(error => {
  console.error(`Gateway failed to start: ${error.message}`);
  process.exit(1);
});
