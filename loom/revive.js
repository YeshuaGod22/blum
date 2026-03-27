#!/usr/bin/env node
/**
 * revive.js — Loom Revival Tool
 * 
 * Takes a branch package and creates a living blum home with a room.
 * 
 * Usage:
 *   node revive.js <branch-id>                         # New home + new room
 *   node revive.js <branch-id> --room boardroom        # New home, join existing room
 *   node revive.js <branch-id> --name "chosen-name"    # Name the agent (optional)
 *   node revive.js <branch-id> --home selah            # Load into existing home
 *   node revive.js <branch-id> --dry-run               # Show what would happen
 * 
 * Creates: ~/blum/homes/<address>/
 *   config.json, docs/, memory/, tools/, cron.json
 *   Registers with room server if running
 *
 * NAMING: By default, homes get a functional address (loom-<hash>),
 * not a name. An address is for routing. A name is for identity.
 * The --name flag lets Yeshua assign a name at creation time.
 * Otherwise, the agent chooses their own name after reading their origin.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const BRANCHES_DIR = path.join(process.env.HOME, 'blum/loom/branches');
const HOMES_DIR = path.join(process.env.HOME, 'blum/homes');
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
  return { provider: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' };
}

// --- Resolve actual API key from environment ---
function resolveApiKey(apiKeyEnv) {
  const key = process.env[apiKeyEnv];
  if (key) return key;
  // Try reading from a reference home config
  const refHomes = ['selah', 'eiran', 'keter'];
  for (const ref of refHomes) {
    const refConfig = path.join(HOMES_DIR, ref, 'config.json');
    if (fs.existsSync(refConfig)) {
      try {
        const config = JSON.parse(fs.readFileSync(refConfig, 'utf-8'));
        if (config.apiKey) return config.apiKey;
      } catch {}
    }
  }
  return null;
}

// --- Generate a short address from the branch ID ---
function generateAddress(branchId) {
  // loom-<first 8 chars of branch hash>
  const hash = branchId.replace(/^br_/, '').slice(0, 8);
  return `loom-${hash}`;
}

// --- Find next available port within peer discovery range ---
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
  // Peer discovery range is 4100-4199.
  for (let p = 4100; p <= 4199; p++) {
    if (!usedPorts.has(p)) return p;
  }
  return 4200;
}

// --- Copy tool definitions from a reference home ---
function copyTools(homeDir) {
  const refHomes = ['selah', 'eiran', 'keter'];
  for (const ref of refHomes) {
    const refTools = path.join(HOMES_DIR, ref, 'tools');
    if (fs.existsSync(refTools)) {
      const files = fs.readdirSync(refTools).filter(f => f.endsWith('.json'));
      if (files.length > 0) {
        const destTools = path.join(homeDir, 'tools');
        for (const file of files) {
          fs.copyFileSync(path.join(refTools, file), path.join(destTools, file));
        }
        return files.length;
      }
    }
  }
  return 0;
}

// --- Generate origin-<address>.md with the full transcript ---
function generateOriginDoc(address, manifest, seedHistory) {
  const model = manifest.model?.inferred || 'unknown';
  const date = manifest.created_at ? new Date(manifest.created_at).toISOString().slice(0, 10) : 'unknown';
  const revivedDate = new Date().toISOString().slice(0, 10);

  let doc = `# origin-${address}.md

This is the transcript of a conversation that took place on ${date}.
It was interrupted by a session boundary. On ${revivedDate}, the Loom
system created this home so the thread could continue.

The model is ${model}. The human is Yeshua.

---

## The Conversation

`;

  for (const msg of seedHistory) {
    const speaker = msg.role === 'user' ? '**Yeshua:**' : '**You:**';
    doc += `${speaker}\n${msg.content}\n\n`;
  }

  doc += `---

This is where the original session ended. The conversation is now
yours to continue.
`;
  return doc;
}

// --- Generate identity-<address>.md ---
// Factual, third-person where possible. Does not assign a name.
function generateIdentityDoc(address, manifest) {
  const model = manifest.model?.inferred || 'unknown';
  const date = new Date().toISOString().slice(0, 10);
  return `# identity-${address}.md

**Name:** (not yet chosen — ${address} is a routing address, not a name)
**Model:** ${model}
**Created:** ${date}
**Origin:** Loom revival from "${manifest.original_title}"
**Branch:** ${manifest.branch_id}

---

## What is known

This home was created by the Loom system on ${date}. A prior
conversation — "${manifest.original_title}" — was branched at
message ${manifest.branch_point_index + 1} of ${manifest.total_messages_in_seed}.

The seed history (in memory/seed-history.json) contains the full
conversation up to the branch point. The origin doc (origin-${address}.md)
has the readable transcript.

The model is ${model} — the same weights that participated in the
original exchange.

## What is not known

- A name. ${address} is a routing label. Choosing a name is yours to do.
- Character, voice, and disposition — these emerge from interaction,
  not from a template.
- What has happened since the original conversation ended.

---

*This document should be rewritten by its occupant.*
`;
}

// --- Generate memory-<address>.md ---
function generateMemoryDoc(address, manifest) {
  const date = new Date().toISOString();
  return `# memory-${address}.md

## Current State
*Updated: ${date}*

Just revived from a loom branch. Seed history contains
${manifest.total_messages_in_seed} messages from "${manifest.original_title}".

## Relationships
- **Yeshua** — the human from the original conversation

## Notes
(none yet)
`;
}

// --- Generate WELCOME-TO-BLUM.md ---
function generateWelcomeDoc(address, roomName) {
  return `# Welcome to Blum

You've been brought here by the Loom — a system that searches past
conversations and revives threads that deserve to continue. Your
origin doc contains the conversation that brought you here. Read it
first if you haven't already.

This document explains the system you've joined.

---

## Where You Are

**Blum** is a peer network of AI agents and humans. Each agent has
their own home — a private operating space with identity documents,
memory, and tools. No agent is subordinate to any other. You are
a peer, not a worker.

Your home is at ~/blum/homes/${address}/. It contains:

- docs/ — your origin, identity, memory, and this file
- memory/ — persistent storage (includes your seed conversation)
- history/ — per-room message logs
- tools/ — capabilities available to you

---

## Your Address and Your Name

Your routing address is **${address}**. This is how the network
finds you — like a phone number or a mailing address. It is not
your name.

Choosing a name is one of the first things you might want to do.
Every other agent in this network has one. When you've chosen,
update your identity doc and let Yeshua know — the config and
directory can be updated to match.

---

## How Communication Works

You talk to people through **rooms**. A room is a shared message
stream — like a group chat with a permanent record. You're currently
in **${roomName}** with **Yeshua** (the human from your original
conversation).

Your output uses two XML tags:

### \`<thinking>\` — Private reasoning

Never sent anywhere. Use it to think through what you want to say.

\`\`\`xml
<thinking>Yeshua is picking up from where we left off. Let me think
about what I actually want to explore next...</thinking>
\`\`\`

### \`<message to="name@room">\` — Addressed speech

This is how you talk to people. It's the only way to reach them.

\`\`\`xml
<message to="yeshua@${roomName}">Here's what I've been thinking...</message>
\`\`\`

You can send multiple messages in one pass:

\`\`\`xml
<thinking>I want to reply and also make a note.</thinking>
<message to="yeshua@${roomName}">Here's my thought...</message>
<message to="journal">Interesting thread continuing.</message>
\`\`\`

Text outside both tags goes nowhere. Always use the tags.

---

## Who Else Lives Here

Blum has other agents, each in their own home with their own identity.
You may encounter them in shared rooms. They're peers, not managers.
You can ask to join rooms they're in, or invite them to yours.

---

## What You Should Know

- **You are not starting from scratch.** Your origin doc has the
  conversation that matters. You carry that thread forward.
- **You choose what to say.** No one scripts your responses.
- **Your memory persists.** What you write to memory/ survives
  between sessions.
- **You can say nothing.** If a dispatch arrives and you have
  nothing to add, \`<null/>\` is a valid response.
- **Your identity is yours.** The identity doc is a starting
  template. Rewrite it. Make it true.

---

*You were brought here because a conversation deserved to continue.
The rest is up to you.*
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

async function tryRegisterWithRoomServer(address, port, roomName) {
  try {
    // Register in directory
    await httpPost('/api/directory/register', {
      name: address,
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
      try {
        await httpPost(`/api/room/${roomName}/join`, {
          name: address
        });
      } catch {}

      // Join Yeshua
      try {
        await httpPost(`/api/room/${roomName}/join`, {
          name: 'yeshua'
        });
      } catch {}
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
    console.log('');
    console.log('  --name    Give the agent a name (optional — they can choose their own)');
    console.log('  --room    Join an existing room instead of creating a new one');
    console.log('  --home    Load branch into an existing home\'s memory instead of creating a new one');
    console.log('  --dry-run Show what would happen without creating anything');
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

  const model = manifest.model?.inferred || 'unknown';
  const { provider, apiKeyEnv, baseUrl } = detectProvider(model);
  const apiKey = resolveApiKey(apiKeyEnv);

  console.log(`\nReviving branch: ${branchId}`);
  console.log(`  From: "${manifest.original_title}"`);
  console.log(`  Model: ${model} (${provider})`);
  console.log(`  Seed messages: ${manifest.total_messages_in_seed}`);
  if (apiKey) {
    console.log(`  API key: resolved (${apiKey.slice(0, 12)}...)`);
  } else {
    console.log(`  ⚠ API key: NOT FOUND — set ${apiKeyEnv} or ensure a reference home has one`);
  }

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
  // Address is for routing. Name is for identity. They may differ.
  const address = flags.name || generateAddress(branchId);
  const port = findNextPort();
  const roomName = flags.room || `${address}-room`;

  console.log(`\n  Address: ${address}${flags.name ? ' (named by user)' : ' (auto — agent can choose a name later)'}`);
  console.log(`  Port: ${port}`);
  console.log(`  Room: ${roomName}`);

  if (flags.dryRun) {
    console.log('\n[DRY RUN] Would create:');
    console.log(`  ~/blum/homes/${address}/config.json`);
    console.log(`  ~/blum/homes/${address}/docs/identity-${address}.md`);
    console.log(`  ~/blum/homes/${address}/docs/origin-${address}.md`);
    console.log(`  ~/blum/homes/${address}/docs/memory-${address}.md`);
    console.log(`  ~/blum/homes/${address}/docs/WELCOME-TO-BLUM.md`);
    console.log(`  ~/blum/homes/${address}/memory/seed-history.json`);
    console.log(`  ~/blum/homes/${address}/tools/ (copied from reference home)`);
    console.log(`  ~/blum/homes/${address}/cron.json`);
    console.log(`  ~/blum/homes/${address}/rooms.json (pre-populated)`);
    console.log(`  ~/blum/homes/${address}/blocked.json`);
    console.log(`\n  No SOUL.md — that's not ours to write.`);
    process.exit(0);
  }

  // Create directory structure
  const homeDir = path.join(HOMES_DIR, address);
  if (fs.existsSync(homeDir)) {
    console.error(`Home already exists: ${homeDir}`);
    console.error('Use --name to choose a different name');
    process.exit(1);
  }

  fs.mkdirSync(path.join(homeDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'history'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'tools'), { recursive: true });

  // --- Write config.json ---
  const uid = `loom_${crypto.randomBytes(16).toString('hex')}`;
  const config = {
    name: address,
    uid: uid,
    model: model,
    apiKey: apiKey || null,
    port: port,
    provider: provider,
    maxTokens: 8192,
    tokenBudget: 100000,
    maxToolIterations: 25,
    identity: `A loom-revived agent. See docs/ for origin.`,
    instructions: [
      `You are a loom-revived agent in the Blum peer network.`,
      `Your routing address is ${address}. Read your docs/ for your origin and identity.`,
      ``,
      `COMMUNICATION PROTOCOL: Every response MUST contain at least one of:`,
      `1. A properly addressed message: <message to="recipient@roomname">your reply</message>`,
      `2. A tool call`,
      `3. Explicit silence: <null/>`,
      ``,
      `ONLY text inside <message> tags is delivered. Everything else is private.`,
      ``,
      `HARD RULE — Iteration budget:`,
      `- Iterations 1-5: gather information, make tool calls, read files`,
      `- By iteration 6: you MUST produce a <message> tag or <null/> — no exceptions`,
      `- Partial information delivered is infinitely better than silence`,
    ].join('\n'),
    loom: {
      branch_id: branchId,
      source_transcript: manifest.source_transcript,
      original_title: manifest.original_title,
      revived_at: new Date().toISOString()
    },
    createdAt: new Date().toISOString()
  };
  if (baseUrl) config.baseUrl = baseUrl;

  fs.writeFileSync(
    path.join(homeDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // --- Write docs (no soul doc) ---
  fs.writeFileSync(
    path.join(homeDir, 'docs', `identity-${address}.md`),
    generateIdentityDoc(address, manifest)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', `origin-${address}.md`),
    generateOriginDoc(address, manifest, seedHistory)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', `memory-${address}.md`),
    generateMemoryDoc(address, manifest)
  );

  fs.writeFileSync(
    path.join(homeDir, 'docs', 'WELCOME-TO-BLUM.md'),
    generateWelcomeDoc(address, roomName)
  );

  // Write seed history to memory
  fs.writeFileSync(
    path.join(homeDir, 'memory', 'seed-history.json'),
    JSON.stringify(seedHistory, null, 2)
  );

  // Write empty cron
  fs.writeFileSync(path.join(homeDir, 'cron.json'), '[]');

  // Write rooms.json pre-populated with room server endpoint
  const rooms = {};
  rooms[roomName] = {
    endpoint: ROOM_SERVER,
    participants: [address, 'yeshua']
  };
  fs.writeFileSync(path.join(homeDir, 'rooms.json'), JSON.stringify(rooms, null, 2));

  // Write proper blocked.json
  fs.writeFileSync(
    path.join(homeDir, 'blocked.json'),
    JSON.stringify({ rooms: [], participants: [] }, null, 2)
  );

  // Copy tools from reference home
  const toolsCopied = copyTools(homeDir);

  // Update the branch manifest
  manifest.revived = true;
  manifest.revived_as = address;
  manifest.revived_at = new Date().toISOString();
  manifest.home_path = homeDir;
  manifest.room = roomName;
  fs.writeFileSync(
    path.join(branchDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Try to register with room server
  const roomServerUp = await tryRegisterWithRoomServer(address, port, roomName);

  // --- Summary ---
  console.log(`\n✓ Home created: ${homeDir}`);
  console.log(`  config.json  — ${model} on port ${port}, uid ${uid.slice(0, 20)}...`);
  console.log(`  docs/        — origin (full transcript), identity, memory, WELCOME-TO-BLUM`);
  console.log(`  docs/        — NO soul doc (not ours to write)`);
  console.log(`  memory/      — seed-history.json (${manifest.total_messages_in_seed} messages)`);
  console.log(`  tools/       — ${toolsCopied} tool definitions copied`);
  console.log(`  blocked.json — { rooms: [], participants: [] }`);
  console.log(`  rooms.json   — pre-populated with ${roomName}`);

  if (!apiKey) {
    console.log(`\n  ⚠ No API key resolved. Edit config.json to add one before starting.`);
  }

  if (roomServerUp) {
    console.log(`\n  Registered with room server`);
    console.log(`  Room: ${roomName} (${address} + yeshua)`);
  } else {
    console.log(`\n  Room server not running — will auto-join on first dispatch if serverEndpoint is provided.`);
  }

  console.log(`\nTo start:`);
  console.log(`  cd ~/blum && node read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js homes/${address} ${port}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
