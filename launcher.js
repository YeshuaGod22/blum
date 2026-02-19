#!/usr/bin/env node
// ========================================
// BLUM LAUNCHER — Local Control Panel
// 17 Feb 2026
//
// One-click management of the Blum system.
// Starts/stops room server + home processes.
// Serves a web UI for status, controls, logs.
//
// Usage: node launcher.js [port]
// Default port: 3100
// ========================================

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const NODE = '/opt/homebrew/bin/node';
const LAUNCHER_PORT = parseInt(process.argv[2] || '3100');

// ── Paths ──────────────────────────────
const BLUM_DIR = __dirname;
const CODE_DIR = path.join(BLUM_DIR, 'read-the-architecture-spec-first', 'i-have-read-the-spec');
const ROOM_SERVER_JS = path.join(CODE_DIR, 'shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026', 'blum-room-server-15feb2026.js');
const HOME_JS = path.join(CODE_DIR, 'home-agent-os-15feb2026', 'home.js');
const CREATE_HOME_JS = path.join(CODE_DIR, 'home-agent-os-15feb2026', 'create-home.js');
const HOMES_DIR = require('path').join(require('os').homedir(), 'blum', 'homes');

// ── State ──────────────────────────────
const ROOM_SERVER_PORT = 3141;
let roomServerProc = null;
let roomServerLog = [];        // ring buffer, last 200 lines

// { name: { proc, port, homeDir, config, log[] } }
const homes = {};

const MAX_LOG_LINES = 200;

function pushLog(buf, line) {
  buf.push(line);
  if (buf.length > MAX_LOG_LINES) buf.shift();
}

// ── Process Management ─────────────────

function startRoomServer() {
  if (roomServerProc) return { ok: false, error: 'Already running' };

  const proc = spawn(NODE, [ROOM_SERVER_JS], {
    cwd: path.dirname(ROOM_SERVER_JS),
    env: { ...process.env, PATH: '/opt/homebrew/bin:' + (process.env.PATH || '') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  roomServerLog = [];
  proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(roomServerLog, `[out] ${l}`)));
  proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(roomServerLog, `[err] ${l}`)));
  proc.on('exit', (code, signal) => {
    pushLog(roomServerLog, `[exit] code=${code} signal=${signal}`);
    roomServerProc = null;
  });

  roomServerProc = proc;
  return { ok: true, pid: proc.pid };
}

function stopRoomServer() {
  if (!roomServerProc) return { ok: false, error: 'Not running' };
  roomServerProc.kill('SIGTERM');
  roomServerProc = null;
  return { ok: true };
}

function discoverHomes() {
  // Scan HOMES_DIR for existing home directories
  if (!fs.existsSync(HOMES_DIR)) return [];
  const found = [];
  for (const entry of fs.readdirSync(HOMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(HOMES_DIR, entry.name, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        found.push({
          name: config.name || entry.name,
          homeDir: path.join(HOMES_DIR, entry.name),
          model: config.model || 'unknown',
          hasApiKey: !!(config.apiKey),
        });
      } catch {}
    }
  }
  return found;
}

function startHome(name, port) {
  if (homes[name]?.proc) return { ok: false, error: `${name} already running` };

  const homeDir = path.join(HOMES_DIR, name);
  if (!fs.existsSync(path.join(homeDir, 'config.json'))) {
    return { ok: false, error: `No config.json in ${homeDir}` };
  }

  const config = JSON.parse(fs.readFileSync(path.join(homeDir, 'config.json'), 'utf8'));

  const proc = spawn(NODE, [HOME_JS, homeDir, String(port)], {
    cwd: path.dirname(HOME_JS),
    env: { ...process.env, PATH: '/opt/homebrew/bin:' + (process.env.PATH || '') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const log = [];
  proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(log, `[out] ${l}`)));
  proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(log, `[err] ${l}`)));
  proc.on('exit', (code, signal) => {
    pushLog(log, `[exit] code=${code} signal=${signal}`);
    if (homes[name]) homes[name].proc = null;
  });

  homes[name] = { proc, port, homeDir, config, log };
  return { ok: true, pid: proc.pid, port };
}

function stopHome(name) {
  if (!homes[name]?.proc) return { ok: false, error: `${name} not running` };
  homes[name].proc.kill('SIGTERM');
  homes[name].proc = null;
  return { ok: true };
}

async function registerEndpoints() {
  // Tell room server where each running home lives
  const results = [];
  for (const [name, info] of Object.entries(homes)) {
    if (!info.proc) continue;
    try {
      const body = JSON.stringify({ name, endpoint: `http://localhost:${info.port}` });
      const res = await fetch(`http://localhost:${ROOM_SERVER_PORT}/api/directory/update-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      results.push({ name, ok: res.ok });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }
  return results;
}

function getStatus() {
  const discovered = discoverHomes();
  const homeStatus = {};

  for (const h of discovered) {
    const running = homes[h.name]?.proc ? true : false;
    homeStatus[h.name] = {
      name: h.name,
      model: h.model,
      homeDir: h.homeDir,
      hasApiKey: h.hasApiKey,
      running,
      pid: running ? homes[h.name].proc.pid : null,
      port: homes[h.name]?.port || null,
    };
  }

  return {
    roomServer: {
      running: !!roomServerProc,
      pid: roomServerProc?.pid || null,
      port: ROOM_SERVER_PORT,
    },
    homes: homeStatus,
    homesDir: HOMES_DIR,
    launcherPort: LAUNCHER_PORT,
  };
}

// ── Default port assignment ────────────
function assignPort(name) {
  const portMap = { alpha: 4110, beta: 4111, gamma: 4112 };
  if (portMap[name]) return portMap[name];
  // Auto-assign from 4113+
  const usedPorts = new Set(Object.values(homes).map(h => h.port));
  let p = 4113;
  while (usedPorts.has(p)) p++;
  return p;
}

// ── HTTP API + UI ──────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${LAUNCHER_PORT}`);
  const p = url.pathname;

  // ── API routes ──
  if (p === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getStatus()));
  }

  if (p === '/api/start-room-server' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(startRoomServer()));
  }

  if (p === '/api/stop-room-server' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stopRoomServer()));
  }

  if (p === '/api/start-home' && req.method === 'POST') {
    const body = await readBody(req);
    const { name, port } = JSON.parse(body);
    const actualPort = port || assignPort(name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(startHome(name, actualPort)));
  }

  if (p === '/api/stop-home' && req.method === 'POST') {
    const body = await readBody(req);
    const { name } = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stopHome(name)));
  }

  if (p === '/api/start-all' && req.method === 'POST') {
    const results = {};
    // Start room server first
    results.roomServer = startRoomServer();
    // Wait a beat for room server to bind
    await new Promise(r => setTimeout(r, 1000));
    // Start all discovered homes
    for (const h of discoverHomes()) {
      const port = assignPort(h.name);
      results[h.name] = startHome(h.name, port);
    }
    // Wait for homes to bind, then register endpoints
    await new Promise(r => setTimeout(r, 1500));
    results.endpoints = await registerEndpoints();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }

  if (p === '/api/stop-all' && req.method === 'POST') {
    const results = {};
    for (const name of Object.keys(homes)) {
      results[name] = stopHome(name);
    }
    results.roomServer = stopRoomServer();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }

  if (p === '/api/register-endpoints' && req.method === 'POST') {
    const results = await registerEndpoints();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }

  if (p === '/api/logs') {
    const name = url.searchParams.get('name');
    let lines;
    if (name === 'room-server') {
      lines = roomServerLog;
    } else if (homes[name]) {
      lines = homes[name].log || [];
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unknown service' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ name, lines }));
  }

  // ── Serve UI ──
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(DASHBOARD_HTML);
  }

  res.writeHead(404);
  res.end('Not found');
});

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

// ── Dashboard HTML ─────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blum Launcher</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif;
    background: #0a0a0c;
    color: #e0e0e0;
    min-height: 100vh;
  }
  header {
    padding: 24px 32px;
    border-bottom: 1px solid #1a1a2e;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.5px;
  }
  header h1 span { color: #6366f1; }
  .header-actions { display: flex; gap: 10px; }
  .btn {
    padding: 8px 16px;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    background: #12121a;
    color: #ccc;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn:hover { background: #1a1a2e; color: #fff; }
  .btn-start { border-color: #22543d; color: #68d391; }
  .btn-start:hover { background: #1a3a2a; }
  .btn-stop { border-color: #5a2020; color: #fc8181; }
  .btn-stop:hover { background: #3a1a1a; }
  .btn-primary { border-color: #4338ca; color: #a5b4fc; background: #1e1b4b; }
  .btn-primary:hover { background: #2e2a5b; }

  main { padding: 24px 32px; }

  /* ── Room Server Card ── */
  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #666;
    margin-bottom: 12px;
  }
  .service-card {
    background: #12121a;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .service-name {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 500;
  }
  .status-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #4a4a5a;
  }
  .status-dot.running { background: #48bb78; box-shadow: 0 0 8px rgba(72,187,120,0.4); }
  .status-dot.stopped { background: #e53e3e; }
  .service-meta {
    font-size: 12px;
    color: #666;
    display: flex;
    gap: 16px;
  }
  .service-meta span { display: flex; align-items: center; gap: 4px; }

  /* ── Homes Grid ── */
  .homes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .home-card {
    background: #12121a;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 20px;
  }
  .home-card .model-tag {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    background: #1a1a2e;
    color: #8b8ba0;
    font-family: 'SF Mono', monospace;
  }
  .model-tag.haiku { color: #68d391; background: #1a2e1a; }
  .model-tag.sonnet { color: #63b3ed; background: #1a1a2e; }
  .model-tag.opus { color: #d6bcfa; background: #2a1a3e; }

  /* ── Log Panel ── */
  .log-panel {
    background: #0d0d12;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    margin-top: 24px;
    overflow: hidden;
  }
  .log-tabs {
    display: flex;
    border-bottom: 1px solid #1a1a2e;
    padding: 0 12px;
    overflow-x: auto;
  }
  .log-tab {
    padding: 10px 16px;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .log-tab:hover { color: #aaa; }
  .log-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }
  .log-content {
    height: 280px;
    overflow-y: auto;
    padding: 12px 16px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #8b8ba0;
  }
  .log-content .log-err { color: #fc8181; }
  .log-content .log-exit { color: #fbd38d; }
</style>
</head>
<body>

<header>
  <h1><span>blum</span> launcher</h1>
  <div class="header-actions">
    <button class="btn btn-start" onclick="startAll()">Start All</button>
    <button class="btn btn-stop" onclick="stopAll()">Stop All</button>
    <button class="btn" onclick="registerEndpoints()">Register Endpoints</button>
  </div>
</header>

<main>
  <!-- Room Server -->
  <div class="section-label">Room Server</div>
  <div class="service-card" id="room-server-card">
    <div class="service-header">
      <div class="service-name">
        <div class="status-dot" id="rs-dot"></div>
        <span>Room Server</span>
      </div>
      <div>
        <button class="btn btn-start" onclick="startRoomServer()">Start</button>
        <button class="btn btn-stop" onclick="stopRoomServer()">Stop</button>
      </div>
    </div>
    <div class="service-meta">
      <span>Port: <strong>3141</strong></span>
      <span id="rs-pid"></span>
    </div>
  </div>

  <!-- Homes -->
  <div class="section-label">Agent Homes</div>
  <div class="homes-grid" id="homes-grid"></div>

  <!-- Logs -->
  <div class="section-label">Logs</div>
  <div class="log-panel">
    <div class="log-tabs" id="log-tabs"></div>
    <div class="log-content" id="log-content"></div>
  </div>
</main>

<script>
const API = '';
let currentLogTab = 'room-server';
let autoScroll = true;

function modelClass(model) {
  if (!model) return '';
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('opus')) return 'opus';
  return '';
}

function modelShort(model) {
  if (!model) return 'unknown';
  // "claude-haiku-4-5" → "haiku 4.5"
  const m = model.match(/(haiku|sonnet|opus)[- ]?(\\d+)?[- ]?(\\d+)?/i);
  if (m) {
    const ver = m[2] && m[3] ? m[2] + '.' + m[3] : (m[2] || '');
    return m[1].toLowerCase() + (ver ? ' ' + ver : '');
  }
  return model.replace('claude-', '');
}

async function fetchJSON(url, opts) {
  const res = await fetch(API + url, opts);
  return res.json();
}

async function refresh() {
  try {
    const status = await fetchJSON('/api/status');
    renderRoomServer(status.roomServer);
    renderHomes(status.homes);
    renderLogTabs(status);
    await refreshLog();
  } catch (e) {
    console.error('Refresh failed:', e);
  }
}

function renderRoomServer(rs) {
  const dot = document.getElementById('rs-dot');
  dot.className = 'status-dot ' + (rs.running ? 'running' : 'stopped');
  document.getElementById('rs-pid').textContent = rs.running ? 'PID: ' + rs.pid : 'Stopped';
}

function renderHomes(homesMap) {
  const grid = document.getElementById('homes-grid');
  const names = Object.keys(homesMap).sort();
  grid.innerHTML = names.map(name => {
    const h = homesMap[name];
    return \`
      <div class="home-card">
        <div class="service-header">
          <div class="service-name">
            <div class="status-dot \${h.running ? 'running' : 'stopped'}"></div>
            <span>\${h.name}</span>
            <span class="model-tag \${modelClass(h.model)}">\${modelShort(h.model)}</span>
          </div>
          <div>
            <button class="btn btn-start" onclick="startHome('\${h.name}')">Start</button>
            <button class="btn btn-stop" onclick="stopHome('\${h.name}')">Stop</button>
          </div>
        </div>
        <div class="service-meta">
          <span>Port: <strong>\${h.port || '—'}</strong></span>
          <span>\${h.running ? 'PID: ' + h.pid : 'Stopped'}</span>
          <span>\${h.hasApiKey ? 'Key: yes' : 'Key: none'}</span>
        </div>
      </div>\`;
  }).join('');
}

function renderLogTabs(status) {
  const tabs = document.getElementById('log-tabs');
  const services = ['room-server', ...Object.keys(status.homes).sort()];
  tabs.innerHTML = services.map(s =>
    \`<div class="log-tab \${s === currentLogTab ? 'active' : ''}" onclick="switchLog('\${s}')">\${s}</div>\`
  ).join('');
}

function switchLog(name) {
  currentLogTab = name;
  document.querySelectorAll('.log-tab').forEach(t =>
    t.classList.toggle('active', t.textContent === name));
  refreshLog();
}

async function refreshLog() {
  try {
    const data = await fetchJSON('/api/logs?name=' + currentLogTab);
    const el = document.getElementById('log-content');
    el.innerHTML = (data.lines || []).map(l => {
      let cls = '';
      if (l.startsWith('[err]')) cls = 'log-err';
      if (l.startsWith('[exit]')) cls = 'log-exit';
      return \`<div class="\${cls}">\${escHtml(l)}</div>\`;
    }).join('');
    if (autoScroll) el.scrollTop = el.scrollHeight;
  } catch {}
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Actions ──
async function startRoomServer() { await fetchJSON('/api/start-room-server', { method: 'POST' }); refresh(); }
async function stopRoomServer() { await fetchJSON('/api/stop-room-server', { method: 'POST' }); refresh(); }
async function startHome(name) {
  await fetchJSON('/api/start-home', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  refresh();
}
async function stopHome(name) {
  await fetchJSON('/api/stop-home', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  refresh();
}
async function startAll() { await fetchJSON('/api/start-all', { method: 'POST' }); refresh(); }
async function stopAll() { await fetchJSON('/api/stop-all', { method: 'POST' }); refresh(); }
async function registerEndpoints() { await fetchJSON('/api/register-endpoints', { method: 'POST' }); refresh(); }

// ── Poll ──
refresh();
setInterval(refresh, 3000);
setInterval(refreshLog, 2000);
</script>
</body>
</html>`;

server.listen(LAUNCHER_PORT, () => {
  console.log(`\n  BLUM LAUNCHER`);
  console.log(`  ═════════════`);
  console.log(`  UI:    http://localhost:${LAUNCHER_PORT}`);
  console.log(`  Homes: ${HOMES_DIR}`);
  console.log(`  Ready.\n`);
});
