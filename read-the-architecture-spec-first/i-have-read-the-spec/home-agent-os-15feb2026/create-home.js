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
