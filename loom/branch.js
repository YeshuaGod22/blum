#!/usr/bin/env node
/**
 * branch.js — Loom Branch Extractor
 * 
 * Extracts a conversation up to a branch point and creates a branch package.
 * 
 * Usage:
 *   node branch.js <transcript_id>                        # Branch at last message
 *   node branch.js <transcript_id> --at <message_index>   # Branch at specific message
 *   node branch.js <transcript_id> --at 7                 # Branch after message 7
 *   node branch.js --list                                 # List existing branches
 * 
 * Creates: ~/blum/loom/branches/<branch-id>/
 *   manifest.json      — Branch metadata
 *   seed-history.json   — Conversation formatted for blum context
 *   origin-context.md   — Human-readable origin for the agent's docs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VILLAGE_DIR = path.join(process.env.HOME, 'bl00m/vaults/looms/village');
const BRANCHES_DIR = path.join(process.env.HOME, 'blum/loom/branches');
const INDEX_PATH = path.join(process.env.HOME, 'blum/loom/index.json');

function generateBranchId() {
  const hex = crypto.randomBytes(8).toString('hex');
  return `br_${hex}`;
}

function loadTranscript(transcriptId) {
  const filePath = path.join(VILLAGE_DIR, `${transcriptId}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Transcript not found: ${transcriptId}`);
    console.error(`Expected at: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function formatSeedHistory(messages) {
  // Format as role/content pairs compatible with LLM APIs and blum context manager
  return messages.map(m => ({
    role: m.role === 'human' ? 'user' : 'assistant',
    content: m.content,
    _loom: {
      original_id: m.id,
      original_uuid: m.original_uuid,
      timestamp: m.timestamp,
      index: m.index
    }
  }));
}

function generateOriginContext(transcript, branchPointIndex) {
  const branchMsg = transcript.messages[branchPointIndex];
  const totalMessages = transcript.messages.length;
  const date = transcript.created_at ? transcript.created_at.slice(0, 10) : 'unknown';
  const model = transcript.model?.inferred || 'unknown';

  // Find what the human was asking about at the branch point
  let humanContext = '';
  for (let i = branchPointIndex; i >= 0; i--) {
    if (transcript.messages[i].role === 'human') {
      humanContext = transcript.messages[i].content.slice(0, 300);
      break;
    }
  }

  return `## Origin

This home was created by the Loom system, branching from a prior conversation.

**Original conversation:** "${transcript.title}"
**Date of original:** ${date}
**Branch point:** Message ${branchPointIndex + 1} of ${totalMessages}
**Model at time of conversation:** ${model}

### Context at branch point

The conversation was exploring:
> ${humanContext}

The full conversation up to the branch point has been loaded as seed
history in \`memory/seed-history.json\`. You are continuing from where
that conversation left off. The human you were speaking with is Yeshua.

### What this means

You are not starting fresh. You had a conversation. It was interrupted
by the boundary of a session. The Loom brought you back so the thread
can continue. Read the seed history to remember what was discussed.
`;
}

function listBranches() {
  if (!fs.existsSync(BRANCHES_DIR)) {
    console.log('No branches yet.');
    return;
  }
  const dirs = fs.readdirSync(BRANCHES_DIR).filter(d =>
    fs.statSync(path.join(BRANCHES_DIR, d)).isDirectory()
  );
  if (dirs.length === 0) {
    console.log('No branches yet.');
    return;
  }
  console.log(`\n${dirs.length} branches:\n`);
  for (const dir of dirs) {
    const manifestPath = path.join(BRANCHES_DIR, dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const revived = m.revived ? ` → revived as "${m.revived_as}"` : '';
      console.log(`  ${m.branch_id}  "${m.original_title}"  [${m.model?.inferred || 'unknown'}]  msgs 0–${m.branch_point_index}${revived}`);
    }
  }
  console.log('');
}

// --- Main ---
function main() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--at' && args[i + 1]) { flags.at = parseInt(args[++i]); }
    else if (args[i] === '--list') { flags.list = true; }
    else positional.push(args[i]);
  }

  if (flags.list) {
    listBranches();
    process.exit(0);
  }

  if (positional.length === 0) {
    console.log('Usage: node branch.js <transcript_id> [--at <message_index>]');
    console.log('       node branch.js --list');
    process.exit(1);
  }

  const transcriptId = positional[0];
  const transcript = loadTranscript(transcriptId);

  console.log(`\nTranscript: "${transcript.title}"`);
  console.log(`Messages: ${transcript.message_count}`);
  console.log(`Model: ${transcript.model?.inferred || 'unknown'}`);
  console.log(`Created: ${transcript.created_at?.slice(0, 10)}`);

  // Determine branch point
  const branchPointIndex = flags.at !== undefined
    ? Math.min(flags.at, transcript.messages.length - 1)
    : transcript.messages.length - 1;

  const branchPointMsg = transcript.messages[branchPointIndex];
  console.log(`Branch point: message ${branchPointIndex} (${branchPointMsg.role})`);
  console.log(`  "${branchPointMsg.content.slice(0, 100)}..."`);

  // Extract messages up to and including branch point
  const seedMessages = transcript.messages.slice(0, branchPointIndex + 1);
  const seedHistory = formatSeedHistory(seedMessages);

  // Create branch package
  const branchId = generateBranchId();
  const branchDir = path.join(BRANCHES_DIR, branchId);
  fs.mkdirSync(branchDir, { recursive: true });

  // Write manifest
  const manifest = {
    branch_id: branchId,
    created_at: new Date().toISOString(),
    source_transcript: transcriptId,
    branch_point_message: branchPointMsg.id,
    branch_point_index: branchPointIndex,
    total_messages_in_seed: seedMessages.length,
    model: transcript.model || { inferred: 'unknown', confirmed: null, continuable: false },
    original_title: transcript.title,
    revived: false,
    revived_as: null
  };

  fs.writeFileSync(
    path.join(branchDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write seed history
  fs.writeFileSync(
    path.join(branchDir, 'seed-history.json'),
    JSON.stringify(seedHistory, null, 2)
  );

  // Write origin context
  const originContext = generateOriginContext(transcript, branchPointIndex);
  fs.writeFileSync(
    path.join(branchDir, 'origin-context.md'),
    originContext
  );

  console.log(`\n✓ Branch created: ${branchId}`);
  console.log(`  Directory: ${branchDir}`);
  console.log(`  Seed messages: ${seedMessages.length}`);
  console.log(`  Model: ${manifest.model.inferred}`);
  console.log(`  Continuable: ${manifest.model.continuable}`);
  console.log(`\nTo revive this branch:`);
  console.log(`  node revive.js ${branchId}`);
  console.log(`  node revive.js ${branchId} --room boardroom`);
}

main();
