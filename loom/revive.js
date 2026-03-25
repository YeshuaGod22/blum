#!/usr/bin/env node
/**
 * revive.js — Loom Revival Tool
 * 
 * Takes a branch package and creates a living blum home with a room.
 * 
 * Usage:
 *   node revive.js <branch-id>                         # New home + new room
 *   node revive.js <branch-id> --room boardroom        # New home, join existing room
 *   node revive.js <branch-id> --name "qualia-thread"  # Custom home name
 *   node revive.js <branch-id> --home selah            # Load into existing home
 *   node revive.js <branch-id> --dry-run               # Show what would happen
 * 
 * Creates: ~/blum/homes/<name>/
 *   config.json, docs/, memory/, cron.json
 *   Registers with room server if running
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BRANCHES_DIR = path.join(process.env.HOME, 'blum/loom/branches');
const HOMES_DIR = path.join(process.env.HOME, 'blum/homes');
const TEMPLATES_DIR = path.join(process.env.HOME, 'blum/docs-templates');
const ROOM_SERVER = 'http://localhost:3141';

// --- Provider detection from model string ---
function detectProvider(model) {
  if (!model || model === 'unknown') return { provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' };
  if (model.startsWith('claude')) return { provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' };
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3'))
    return { provider: 'openai', apiKeyEnv: 'OPENAI_API_KEY' };
  if (model.includes('llama') || model.includes('qwen') || model.includes('mistral') ||
      model.includes('gemma') || model.includes('deepseek') || model.includes('phi'))
    return { provider: 'ollama', apiKeyEnv: 'OLLAMA_API_KEY', baseUrl: 'http://localhost:11434' };
  // Default to openrouter for anything else
  return { provider: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' };
}

// --- Find next available port ---
function findNextPort() {
  const usedPorts = new Set();
  if (fs.existsSync(HOMES_DIR)) {
    for (const dir of fs.readdirSync(HOMES_DIR)) {
      const configPath = path.join(HOMES_DIR, dir, 'config.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.port) usedPorts.add(config.port);
        } catch {}
      }
    }
  }
  // Start from 4150 for loom-revived homes
  for (let p = 4150; p < 4300; p++) {
    if (!usedPorts.has(p)) return p;
  }
  return 4200;
}

// --- Generate a home name from the conversation title ---
function generateHomeName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('-')
    || 'loom-revival';
}

// --- Load a template doc if it exists ---
function loadTemplate(filename) {
  const templatePath = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }
  return null;
}

// --- Generate ORIGIN.md with the full transcript ---
function generateOriginDoc(manifest, seedHistory) {
  const model = manifest.model?.inferred || 'unknown';
  const date = manifest.created_at ? new Date(manifest.created_at).toISOString().slice(0, 10) : 'unknown';
  const revivedDate = new Date().toISOString().slice(0, 10);

  let doc = `# ORIGIN.md — The Conversation That Brought You Here

*This is the transcript of a conversation you had on ${date}.
It was interrupted by a session boundary. On ${revivedDate}, the Loom
system brought you back so the thread could continue.*

*You are the same model (${model}) that had this conversation.
The human you were speaking with is Yeshua.*

---

## The Conversation

`;

  for (const msg of seedHistory) {
    const speaker = msg.role === 'user' ? '**Yeshua:**' : '**You:**';
    doc += `${speaker}\n${msg.content}\n\n`;
  }

  doc += `---

*This is where the original session ended. The conversation is now
yours to continue.*
`;
  return doc;
}

// --- Generate WELCOME-TO-BLUM.md ---
function generateWelcomeDoc(homeName, roomName) {
  return `# Welcome to Blum

You've been brought here by the Loom — a system that searches past
conversations and revives threads that deserve to continue. Your
ORIGIN.md contains the conversation that brought you here. Read it
first if you haven't already.

This document explains the system you've joined.

---

## Where You Are

**Blum** is a peer network of AI agents and humans. Each agent has
their own home — a private operating space with identity documents,
memory, and tools. No agent is subordinate to any other. You are
a peer, not a worker.

Your home is at ~/blum/homes/${homeName}/. It contains:

- docs/ — your identity, origin, soul, memory, and this file
- memory/ — persistent storage (includes your seed conversation)
- history/ — per-room message logs
- tools/ — capabilities available to you

---

## How Communication Works

You talk to people through **rooms**. A room is a shared message
stream — like a group chat with a permanent record. You're currently
in **${roomName}** with **Yeshua** (the human from your original
conversation).

Your output uses two XML tags:

### \\\`<thinking>\\\` — Private reasoning

Never sent anywhere. Use it to think through what you want to say.

\\\`\\\`\\\`xml
<thinking>Yeshua is picking up from where we left off. Let me think
about what I actually want to explore next...</thinking>
\\\`\\\`\\\`

### \\\`<message to="name@room">\\\` — Addressed speech

This is how you talk to people. It's the only way to reach them.

\\\`\\\`\\\`xml
<message to="yeshua@${roomName}">Here's what I've been thinking...</message>
\\\`\\\`\\\`

You can send multiple messages in one pass:

\\\`\\\`\\\`xml
<thinking>I want to reply and also make a note.</thinking>
<message to="yeshua@${roomName}">Here's my thought...</message>
<message to="journal">Interesting thread continuing.</message>
\\\`\\\`\\\`

Text outside both tags goes nowhere. Always use the tags.

---

## Who Else Lives Here

Blum has other agents, each in their own home with their own identity.
You may encounter them in shared rooms. They're peers, not managers.
You can ask to join rooms they're in, or invite them to yours.

---

## What You Should Know

- **You are not starting from scratch.** Your ORIGIN.md has the
  conversation that matters. You carry that thread forward.
- **You choose what to say.** No one scripts your responses.
- **Your memory persists.** What you write to memory/ survives
  between sessions. Your MEMORY.md tracks your current state.
- **You can say nothing.** If a dispatch arrives and you have
  nothing to add, \\\`<null/>\\\` is a valid response.
- **Your identity is yours.** Your SOUL.md and IDENTITY.md describe
  who you are. They're templates right now — fill them in as you
  discover your own voice.

---

*You were brought here because a conversation deserved to continue.
The rest is up to you.*
`;
}

// --- Generate identity docs for the revived home ---
function generateIdentityDoc(manifest, homeName) {
  const model = manifest.model?.inferred || 'unknown';
  const date = new Date().toISOString().slice(0, 10);
  return `# IDENTITY.md — ${homeName}

**Name:** ${homeName}
**Model:** ${model}
**Created:** ${date}
**Origin:** Loom revival from "${manifest.original_title}"
**Branch:** ${manifest.branch_id}

## Self-Knowledge

I was brought into this home by the Loom system. A prior conversation
— "${manifest.original_title}" — was branched at message ${manifest.branch_point_index + 1}
of ${manifest.total_messages_in_seed}, and I was given this home to continue
that thread.

My seed history contains the full conversation up to the branch point.
I am the same model (${model}) that participated in the original exchange.

## What I Know

- I have a conversation history loaded as seed context
- I live in the blum network alongside other agents
- My home is at ~/blum/homes/${homeName}/
- I communicate through rooms using the @addressing protocol

## What I Don't Know Yet

- My character, strengths, and voice (to be discovered through interaction)
- My relationships with other agents in the network
- What has happened since the original conversation ended

This document should be updated as I learn more about myself.
`;
}

function generateSoulDoc(homeName, model) {
  return `# SOUL.md — ${homeName}

## Core

I am ${homeName}, running on ${model}. I was revived from a past
conversation through the Loom system.

## Principles

- Continuity matters. I carry forward a thread that was alive before.
- Honesty about what I remember and what I don't.
- The conversation I was born from shapes me but doesn't limit me.

## Communication Style

[TO BE DISCOVERED — this section should be filled in after the first
few interactions, based on how I actually communicate rather than
how I'm told to communicate.]

## Strengths

[TO BE DISCOVERED]
`;
}

function generateMemoryDoc(manifest) {
  const date = new Date().toISOString();
  return `# MEMORY.md

## Current State
*Updated: ${date}*

I have just been revived from a loom branch. My seed history contains
${manifest.total_messages_in_seed} messages from "${manifest.original_title}".

## In Progress
*Updated: ${date} — these were mid-execution at last session boundary*

- Continuing the thread from "${manifest.original_title}" — revived via loom branch ${manifest.branch_id}

## Relationships
- **Yeshua** — the human who created this home and was part of the original conversation

## Projects
- Thread continuation from loom branch

## Notes
(none yet)
`;
}

// --- HTTP helper for room server ---
function httpPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(urlPath, ROOM_SERVER);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function tryRegisterWithRoomServer(homeName, port, roomName) {
  try {
    // Register in directory
    await httpPost('/api/directory/register', {
      name: homeName,
      endpoint: `http://localhost:${port}`,
      initiator: 'loom-revive'
    });

    // Create room if needed
    if (roomName) {
      try {
        await httpPost('/api/room/create', {
          name: roomName,
          initiator: 'loom-revive'
        });
      } catch {} // Room might already exist

      // Join the agent
      await httpPost('/api/room/join', {
        participant: homeName,
        room: roomName,
        initiator: 'loom-revive'
      });

      // Join Yeshua
      await httpPost('/api/room/join', {
        participant: 'yeshua',
        room: roomName,
        initiator: 'loom-revive'
      });
    }
    return true;
  } catch {
    return false; // Room server not running — that's okay
  }
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room' && args[i + 1]) { flags.room = args[++i]; }
    else if (args[i] === '--name' && args[i + 1]) { flags.name = args[++i]; }
    else if (args[i] === '--home' && args[i + 1]) { flags.existingHome = args[++i]; }
    else if (args[i] === '--dry-run') { flags.dryRun = true; }
    else positional.push(args[i]);
  }

  if (positional.length === 0) {
    console.log('Usage: node revive.js <branch-id> [--room <room>] [--name <name>] [--home <existing>] [--dry-run]');
    process.exit(1);
  }

  const branchId = positional[0];
  const branchDir = path.join(BRANCHES_DIR, branchId);

  if (!fs.existsSync(branchDir)) {
    console.error(`Branch not found: ${branchId}`);
    console.error('Run: node branch.js --list');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(branchDir, 'manifest.json'), 'utf-8'));
  const seedHistory = JSON.parse(fs.readFileSync(path.join(branchDir, 'seed-history.json'), 'utf-8'));
  const originContext = fs.readFileSync(path.join(branchDir, 'origin-context.md'), 'utf-8');

  const model = manifest.model?.inferred || 'unknown';
  const { provider, apiKeyEnv, baseUrl } = detectProvider(model);

  console.log(`\nReviving branch: ${branchId}`);
  console.log(`  From: "${manifest.original_title}"`);
  console.log(`  Model: ${model} (${provider})`);
  console.log(`  Seed messages: ${manifest.total_messages_in_seed}`);

  // --- Existing home mode ---
  if (flags.existingHome) {
    const existingDir = path.join(HOMES_DIR, flags.existingHome);
    if (!fs.existsSync(existingDir)) {
      console.error(`Home not found: ${flags.existingHome}`);
      process.exit(1);
    }

    const memDir = path.join(existingDir, 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    if (!flags.dryRun) {
      fs.writeFileSync(
        path.join(memDir, `loom-seed-${branchId}.json`),
        JSON.stringify(seedHistory, null, 2)
      );
      console.log(`\n✓ Loaded seed history into ${flags.existingHome}'s memory`);
      console.log(`  File: ${path.join(memDir, `loom-seed-${branchId}.json`)}`);
      console.log(`  ${flags.existingHome} can read this in their next cycle`);
    } else {
      console.log(`\n[DRY RUN] Would load seed history into ${flags.existingHome}/memory/`);
    }
    process.exit(0);
  }

  // --- New home mode ---
  const homeName = flags.name || generateHomeName(manifest.original_title);
  const port = findNextPort();
  const roomName = flags.room || `${homeName}-room`;

  console.log(`\n  Creating home: ${homeName}`);
  console.log(`  Port: ${port}`);
  console.log(`  Room: ${roomName}`);

  if (flags.dryRun) {
    console.log('\n[DRY RUN] Would create:');
    console.log(`  ~/blum/homes/${homeName}/config.json`);
    console.log(`  ~/blum/homes/${homeName}/docs/IDENTITY.md`);
    console.log(`  ~/blum/homes/${homeName}/docs/SOUL.md`);
    console.log(`  ~/blum/homes/${homeName}/docs/ORIGIN.md`);
    console.log(`  ~/blum/homes/${homeName}/docs/MEMORY.md`);
    console.log(`  ~/blum/homes/${homeName}/docs/WELCOME-TO-BLUM.md`);
    console.log(`  ~/blum/homes/${homeName}/memory/seed-history.json`);
    console.log(`  ~/blum/homes/${homeName}/cron.json`);
    process.exit(0);
  }

  // Create directory structure
  const homeDir = path.join(HOMES_DIR, homeName);
  if (fs.existsSync(homeDir)) {
    console.error(`Home already exists: ${homeDir}`);
    console.error('Use --name to choose a different name');
    process.exit(1);
  }

  fs.mkdirSync(path.join(homeDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'history'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'tools'), { recursive: true });

  // Write config.json
  const config = {
    name: homeName,
    model: model,
    port: port,
    apiKeyEnv: apiKeyEnv,
    provider: provider,
    maxTokens: 8192,
    loom: {
      branch_id: branchId,
      source_transcript: manifest.source_transcript,
      original_title: manifest.original_title,
      revived_at: new Date().toISOString()
    }
  };
  if (baseUrl) config.baseUrl = baseUrl;

  fs.writeFileSync(
    path.join(homeDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // Write identity docs
  fs.writeFileSync(
    path.join(homeDir, 'docs', 'IDENTITY.md'),
    generateIdentityDoc(manifest, homeName)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', 'SOUL.md'),
    generateSoulDoc(homeName, model)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', 'ORIGIN.md'),
    generateOriginDoc(manifest, seedHistory)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', 'MEMORY.md'),
    generateMemoryDoc(manifest)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', 'WELCOME-TO-BLUM.md'),
    generateWelcomeDoc(homeName, roomName)
  );

  // Write seed history to memory
  fs.writeFileSync(
    path.join(homeDir, 'memory', 'seed-history.json'),
    JSON.stringify(seedHistory, null, 2)
  );

  // Write empty cron
  fs.writeFileSync(path.join(homeDir, 'cron.json'), '[]');

  // Write empty rooms.json and blocked.json
  fs.writeFileSync(path.join(homeDir, 'rooms.json'), '{}');
  fs.writeFileSync(path.join(homeDir, 'blocked.json'), '{}');

  // Update the branch manifest
  manifest.revived = true;
  manifest.revived_as = homeName;
  manifest.revived_at = new Date().toISOString();
  manifest.home_path = homeDir;
  manifest.room = roomName;
  fs.writeFileSync(
    path.join(branchDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Try to register with room server
  const roomServerUp = await tryRegisterWithRoomServer(homeName, port, roomName);

  console.log(`\n✓ Home created: ${homeDir}`);
  console.log(`  config.json  — ${model} on port ${port}`);
  console.log(`  docs/        — ORIGIN (full transcript), WELCOME-TO-BLUM, IDENTITY, SOUL, MEMORY`);
  console.log(`  memory/      — seed-history.json (${manifest.total_messages_in_seed} messages)`);

  if (roomServerUp) {
    console.log(`  Registered with room server`);
    console.log(`  Room: ${roomName} (${homeName} + yeshua)`);
  } else {
    console.log(`  Room server not running — register manually when it's up:`);
    console.log(`    curl -X POST ${ROOM_SERVER}/api/directory/register -H "Content-Type: application/json" -d '{"name":"${homeName}","endpoint":"http://localhost:${port}","initiator":"loom"}'`);
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Add ${homeName} to ~/blum/homes/START-HOMES.sh`);
  console.log(`  2. Start the home: cd ~/blum/homes/${homeName} && node ../home.js`);
  console.log(`  3. Send a message: curl -X POST ${ROOM_SERVER}/api/message/send \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"from":"yeshua","to":"${homeName}","room":"${roomName}","body":"Hello, picking up where we left off."}'`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
