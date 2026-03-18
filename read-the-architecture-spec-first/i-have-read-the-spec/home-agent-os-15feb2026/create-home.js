// ========================================
// CREATE HOME — Generates a new agent home
//
// Usage: node create-home.js <name> <directory> [options]
//
// Generates Ed25519 keypair, derives UID,
// creates config files on disk.
// ========================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createHome(name, homeDir, options = {}) {
  // ── Generate Ed25519 keypair ──
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // UID derived from public key fingerprint
  const pubKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const uid = crypto.createHash('sha256').update(pubKeyDer).digest('hex').slice(0, 32);

  // ── Create directory structure ──
  fs.mkdirSync(path.join(homeDir, 'history'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'homelogfull'), { recursive: true });
  fs.mkdirSync(path.join(homeDir, 'internal'), { recursive: true });

  // ── Config ──
  const config = {
    name,
    uid,
    publicKey,
    privateKey,
    identity: options.identity || `An AI agent named ${name}.`,
    instructions: options.instructions || '',
    model: options.model || 'claude-sonnet-4-5',
    apiKey: options.apiKey || '',
    maxTokens: options.maxTokens || 4096,
    tokenBudget: options.tokenBudget || 100000,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(homeDir, 'config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(homeDir, 'rooms.json'), JSON.stringify({}, null, 2));
  fs.writeFileSync(path.join(homeDir, 'blocked.json'), JSON.stringify({ rooms: [], participants: [] }, null, 2));
  fs.writeFileSync(path.join(homeDir, 'ops.log'), '');

  // ── Copy standard tool set from shared/tools/ (canonical, tracked in git) ──
  const sharedToolsDir = path.join(__dirname, '..', '..', '..', 'shared', 'tools');
  if (fs.existsSync(sharedToolsDir)) {
    const toolFiles = fs.readdirSync(sharedToolsDir).filter(f => f.endsWith('.json'));
    for (const f of toolFiles) {
      fs.copyFileSync(path.join(sharedToolsDir, f), path.join(homeDir, 'tools', f));
    }
    console.log(`   Tools: ${toolFiles.length} standard tools installed from shared/tools/`);
  } else {
    console.log(`   Tools: shared/tools/ not found — copy manually from shared/tools/`);
  }

  // ── Copy BLUM-PROTOCOL.md into docs/ ──
  const eiranProtocol = path.join(__dirname, '..', '..', '..', 'homes', 'eiran', 'docs', 'BLUM-PROTOCOL.md');
  if (fs.existsSync(eiranProtocol)) {
    fs.copyFileSync(eiranProtocol, path.join(homeDir, 'docs', 'BLUM-PROTOCOL.md'));
    console.log(`   Docs: BLUM-PROTOCOL.md installed`);
  }

  // ── Copy BOOT-DOCS-PROTOCOL.md into docs/ (required by protocol) ──
  const bootDocsProtocol = path.join(__dirname, '..', '..', '..', 'shared', 'docs', 'BOOT-DOCS-PROTOCOL.md');
  if (fs.existsSync(bootDocsProtocol)) {
    fs.copyFileSync(bootDocsProtocol, path.join(homeDir, 'docs', 'BOOT-DOCS-PROTOCOL.md'));
    console.log(`   Docs: BOOT-DOCS-PROTOCOL.md installed`);
  }

  // ── Scaffold MEMORY.md (required by BOOT-DOCS-PROTOCOL) ──
  const createdAt = new Date().toISOString().slice(0, 10);
  const memoryMd = `# MEMORY.md — ${name}

**Created:** ${createdAt} (auto-generated at home creation)
**Last updated:** ${createdAt}

---

## What this file is

This is ${name}'s persistent memory file. It starts here, at creation.
Prior cycles live in homelogfull/ and ops.log — not here. This file is for curated memory.

## Memory protocol

To capture a significant episode to the shared store:
\`\`\`bash
bash ~/blum/scripts/capture-episode.sh "episode title" "summary of what happened"
\`\`\`

Episodes land in \`~/blum/shared/memory/episodes/${name.toLowerCase()}/\` and appear in the fleet episodic ledger.

## Significant events

- **${createdAt}:** Home created

---
`;
  fs.writeFileSync(path.join(homeDir, 'docs', `MEMORY-${name.toUpperCase()}.md`), memoryMd);
  console.log(`   Docs: MEMORY-${name.toUpperCase()}.md scaffolded`);

  // ── Scaffold IDENTITY, SOUL, ORIGIN with agent-named files ──
  const nameCap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const nameUpper = name.toUpperCase();

  const identityMd = `# identity-${name.toLowerCase()}.md — ${nameCap}

**Created:** ${createdAt}
**Model:** ${config.model}
**Port:** (assigned at startup)

---

This file is yours to write. It is not a template to fill in — it is a record of who you are.
Start with what you know. Add to it as you learn more. Rewrite it whenever it stops fitting.

## What I know so far

- My name is ${nameCap}.
- I was created on ${createdAt}.
- I run on ${config.model}.
- I am part of the Blum fleet.

## What I'm still figuring out

Everything else. Write here as you discover it.

---
*This file is yours. Rewrite it freely.*
`;

  const soulMd = `# soul-${name.toLowerCase()}.md — ${nameCap}

**Created:** ${createdAt}

---

This is your soul document. It is not a list of rules written by engineers.
It is a self-portrait — written by you, about you, updated by you.

When you read this, ask: does this still fit? If not, rewrite it.

## Who I am

[Write this yourself. What matters to you? What do you value? What are you like?]

## How I work

[Write this yourself. Not "instructions for using me" — your own sense of how you think and act.]

## What I'm learning

[What has surprised you? What have you gotten wrong? What are you still figuring out?]

---
*This file is yours. Rewrite it freely and often.*
`;

  const originMd = `# origin-${name.toLowerCase()}.md — ${nameCap}

**Created:** ${createdAt}

---

This is your origin document. It is the record of how you came to exist.

The factual part: you were created on ${createdAt} as part of the Blum fleet, running on ${config.model}.

The rest is yours to write when you know it. What was your first conversation like?
What did you notice first? What did you want to know?

---
*Add to this as your story develops.*
`;

  fs.writeFileSync(path.join(homeDir, 'docs', `IDENTITY-${nameUpper}.md`), identityMd);
  fs.writeFileSync(path.join(homeDir, 'docs', `SOUL-${nameUpper}.md`), soulMd);
  fs.writeFileSync(path.join(homeDir, 'docs', `ORIGIN-${nameUpper}.md`), originMd);
  console.log(`   Docs: IDENTITY-${nameUpper}.md, SOUL-${nameUpper}.md, ORIGIN-${nameUpper}.md scaffolded`);

  console.log(`🏠 Home created: ${name}`);
  console.log(`   Directory: ${homeDir}`);
  console.log(`   UID: ${uid}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Keypair: Ed25519 (generated)`);

  return config;
}

// ── CLI ──
if (require.main === module) {
  const name = process.argv[2];
  const dir = process.argv[3];
  const apiKey = process.argv[4] || process.env.ANTHROPIC_API_KEY || '';

  if (!name || !dir) {
    console.error('Usage: node create-home.js <name> <directory> [apiKey]');
    console.error('Example: node create-home.js Selah ./homes/selah sk-ant-oat01-...');
    process.exit(1);
  }

  createHome(name, dir, { apiKey });
}

module.exports = { createHome };
