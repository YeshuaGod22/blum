#!/usr/bin/env node
// ========================================
// BLUM LAUNCHER — 15 Feb 2026
//
// Starts the room server, then spawns
// one home process per agent. Each home
// gets its own port and registers itself
// with the room server's directory.
//
// Usage:
//   node blum-launcher.js
//
// Agents and rooms are seeded on first
// run if the room server has no data.
// ========================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOM_SERVER_PORT = 3141;
const HOME_BASE_PORT = 3150; // yeshua=3150, claude=3151, ...

const ROOM_SERVER_SCRIPT = path.join(__dirname, 'room-server', 'blum-room-server.js');
const HOME_SERVER_SCRIPT = path.join(__dirname, 'home-server', 'blum-home-server.js');

const DEFAULT_AGENTS = ['yeshua', 'claude', 'selah', 'lens'];

const DEFAULT_ROOMS = [
  { name: 'boardroom', members: ['yeshua', 'claude', 'selah', 'lens'] },
  { name: 'garden',    members: ['yeshua', 'selah', 'lens'] },
  { name: 'workshop',  members: ['claude', 'selah'] },
  { name: 'lounge',    members: ['yeshua', 'claude', 'lens'] },
];

const processes = [];

function log(prefix, msg) {
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`  ${ts} [${prefix}] ${msg}`);
}

function spawnProcess(label, script, args, env) {
  const proc = spawn('node', [script, ...args], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(line => log(label, line.trim()));
  });
  proc.stderr.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(line => log(label, `⚠ ${line.trim()}`));
  });
  proc.on('exit', (code) => {
    log(label, `exited with code ${code}`);
  });

  processes.push({ label, proc });
  return proc;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

async function seedIfEmpty() {
  try {
    const res = await fetch(`http://localhost:${ROOM_SERVER_PORT}/api/rooms`);
    const rooms = await res.json();
    if (Object.keys(rooms).length > 0) {
      log('SEED', 'Room server already has data, skipping seed');
      return;
    }
  } catch { return; }

  log('SEED', 'First run — creating default rooms...');

  for (const r of DEFAULT_ROOMS) {
    await fetch(`http://localhost:${ROOM_SERVER_PORT}/api/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: r.name, initiator: 'system' })
    });
    log('SEED', `Created room: ${r.name}`);
  }

  // Wait for homes to register, then join rooms
  log('SEED', 'Waiting for homes to register...');
  await sleep(2000);

  for (const r of DEFAULT_ROOMS) {
    for (const member of r.members) {
      const res = await fetch(`http://localhost:${ROOM_SERVER_PORT}/api/room/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant: member, room: r.name, initiator: 'system' })
      });
      const data = await res.json();
      if (data.error) log('SEED', `  ${member} → ${r.name}: ${data.error}`);
      else log('SEED', `  ${member} joined ${r.name}`);
    }
  }

  log('SEED', 'Seeding complete.');
}

async function main() {
  console.log(`\n  ╔════════════════════════════╗`);
  console.log(`  ║     BLUM SYSTEM LAUNCHER   ║`);
  console.log(`  ╚════════════════════════════╝\n`);

  // 1. Start room server
  log('LAUNCH', `Starting room server on port ${ROOM_SERVER_PORT}...`);
  spawnProcess('ROOM', ROOM_SERVER_SCRIPT, [], { ROOM_PORT: String(ROOM_SERVER_PORT) });

  // Wait for it to be ready
  const roomReady = await waitForServer(`http://localhost:${ROOM_SERVER_PORT}/api/rooms`);
  if (!roomReady) {
    log('LAUNCH', '✘ Room server failed to start');
    process.exit(1);
  }
  log('LAUNCH', '✓ Room server ready');

  // 2. Start home servers
  for (let i = 0; i < DEFAULT_AGENTS.length; i++) {
    const name = DEFAULT_AGENTS[i];
    const port = HOME_BASE_PORT + i;
    log('LAUNCH', `Starting home for ${name} on port ${port}...`);
    spawnProcess(name.toUpperCase(), HOME_SERVER_SCRIPT, [name, String(port)], {
      ROOM_SERVER: `http://localhost:${ROOM_SERVER_PORT}`
    });
  }

  // Wait for all homes to be ready
  await sleep(1500);
  for (let i = 0; i < DEFAULT_AGENTS.length; i++) {
    const name = DEFAULT_AGENTS[i];
    const port = HOME_BASE_PORT + i;
    const ready = await waitForServer(`http://localhost:${port}/health`);
    log('LAUNCH', ready ? `✓ ${name}'s home ready on ${port}` : `✘ ${name}'s home failed`);
  }

  // 3. Seed data if first run
  await seedIfEmpty();

  // Summary
  console.log(`\n  ════════════════════════════`);
  console.log(`  SYSTEM READY`);
  console.log(`  ════════════════════════════`);
  console.log(`  Room server:  http://localhost:${ROOM_SERVER_PORT}`);
  for (let i = 0; i < DEFAULT_AGENTS.length; i++) {
    console.log(`  ${DEFAULT_AGENTS[i]}'s home:  http://localhost:${HOME_BASE_PORT + i}`);
  }
  console.log(`  UI client:    http://localhost:${ROOM_SERVER_PORT}/`);
  console.log(`  ════════════════════════════\n`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    processes.forEach(({ label, proc }) => {
      log('STOP', label);
      proc.kill();
    });
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    processes.forEach(({ proc }) => proc.kill());
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
