#!/usr/bin/env node
'use strict';

const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GATEWAY = path.join(__dirname, 'blum-external-user-home-gateway-16sep2026.js');
const ROOM_PORT = 43141;
const API_PORT = 43151;
const DISPATCH_PORT = 43152;
const TOKEN = 'test-token';
const PARTICIPANT = 'chatgpt-yeshua';
const ROOM = 'exp003-lab';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blum-gateway-test-'));

const state = {
  directory: { lab: { name: 'lab', uid: 'uid_lab', endpoint: null } },
  rooms: { [ROOM]: { name: ROOM, uid: 'room_test', participants: ['lab'], chatlog: [] } },
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

const roomServer = http.createServer(async (req, res) => {
  const body = req.method === 'POST' ? await readBody(req) : {};
  if (req.method === 'GET' && req.url === '/api/directory') return sendJson(res, 200, state.directory);
  if (req.method === 'GET' && req.url === '/api/rooms') return sendJson(res, 200, state.rooms);
  if (req.method === 'GET' && req.url === `/api/room/${ROOM}/chatlog`) return sendJson(res, 200, { room: ROOM, chatlog: state.rooms[ROOM].chatlog });
  if (req.method === 'POST' && req.url === '/api/directory/register') {
    state.directory[body.name] = { name: body.name, uid: 'uid_external', endpoint: body.endpoint };
    return sendJson(res, 200, { success: true, entry: state.directory[body.name] });
  }
  if (req.method === 'POST' && req.url === '/api/directory/update-endpoint') {
    state.directory[body.name].endpoint = body.endpoint;
    return sendJson(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.url === '/api/room/join') {
    if (!state.rooms[body.room].participants.includes(body.participant)) state.rooms[body.room].participants.push(body.participant);
    return sendJson(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.url === '/api/message/send') {
    const msg = { id: 'msg_test', from: body.from, to: body.to, room: body.room, body: body.body };
    state.rooms[body.room].chatlog.push(msg);
    sendJson(res, 200, { success: true, msg });
    if (body.to === 'lab') {
      setTimeout(async () => {
        const external = state.directory[PARTICIPANT];
        await fetch(`${external.endpoint}/dispatch`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dispatchId: 'disp_test', triggered_by: msg.id, type: 'push', room: ROOM,
            roomUID: state.rooms[ROOM].uid, roomchatlog: state.rooms[ROOM].chatlog,
            participants: state.rooms[ROOM].participants, ts: new Date().toISOString(),
          }),
        });
      }, 30);
    }
    return;
  }
  sendJson(res, 404, { error: 'not found' });
});

async function waitFor(url, options, predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (predicate(response, data)) return { response, data };
    } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`timed out waiting for ${url}`);
}

(async () => {
  await new Promise(resolve => roomServer.listen(ROOM_PORT, '127.0.0.1', resolve));
  const child = spawn(process.execPath, [GATEWAY], {
    env: {
      ...process.env,
      BLUM_ROOM_SERVER: `http://127.0.0.1:${ROOM_PORT}`,
      BLUM_EXTERNAL_PARTICIPANT: PARTICIPANT,
      BLUM_EXTERNAL_GATEWAY_TOKEN: TOKEN,
      BLUM_EXTERNAL_API_PORT: String(API_PORT),
      BLUM_EXTERNAL_DISPATCH_PORT: String(DISPATCH_PORT),
      BLUM_EXTERNAL_ROOMS: ROOM,
      BLUM_EXTERNAL_GATEWAY_DATA_DIR: tempDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitFor(`http://127.0.0.1:${API_PORT}/v1/status`, { headers: { Authorization: `Bearer ${TOKEN}` } }, r => r.status === 200);

    assert(state.directory[PARTICIPANT], 'gateway should register participant');
    assert(state.rooms[ROOM].participants.includes(PARTICIPANT), 'gateway should join allowed room');

    const unauth = await fetch(`http://127.0.0.1:${API_PORT}/v1/status`);
    assert.strictEqual(unauth.status, 401);

    const send = await fetch(`http://127.0.0.1:${API_PORT}/v1/rooms/${ROOM}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'lab', body: 'Which battery items were not answered in raw12?' }),
    });
    assert.strictEqual(send.status, 200);

    const inbox = await waitFor(
      `http://127.0.0.1:${API_PORT}/v1/inbox`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
      (r, data) => r.status === 200 && data.entries?.some(e => e.dispatchId === 'disp_test')
    );
    assert(inbox.data.entries.some(e => e.dispatch.room === ROOM));

    const messages = await fetch(`http://127.0.0.1:${API_PORT}/v1/rooms/${ROOM}/messages`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const messagesData = await messages.json();
    assert(messagesData.chatlog.some(m => m.body.includes('raw12')));

    const forbidden = await fetch(`http://127.0.0.1:${API_PORT}/v1/rooms/boardroom/messages`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.strictEqual(forbidden.status, 403);

    console.log('PASS external user home gateway integration test');
  } finally {
    child.kill('SIGTERM');
    roomServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
