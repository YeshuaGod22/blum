#!/usr/bin/env node

/**
 * Blum portable DAE lab bundle builder v0 — 12 Sep 2026
 *
 * Provider-free. Network-free. Reads local Blum + DAE checkouts and stages a
 * reproducible static bundle with a SHA-256 inventory.
 *
 * Usage:
 *   node build-portable-dae-lab-bundle-v0-12sep2026.mjs \
 *     --blum-root /path/to/blum \
 *     --dae-root /path/to/DevelopmentalAttractorEngineering \
 *     --out /path/to/blum-dae-lab-bundle \
 *     --profile portable-analysis|full-witness
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PINNED_DAE_COMMIT = 'e2d484b41461013832c00e9f1ba3549ac0ef2517';
const BUNDLE_SCHEMA_VERSION = 'blum-portable-lab-bundle-v0';
const LAB_REL = 'read-the-architecture-spec-first/i-have-read-the-spec/experimental-lineage-console-11sep2026';
const DAE_EXP_REL = 'experiments/EXP-003-the-sixth-question';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new Error(`Unexpected argument: ${k}`);
    const key = k.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    out[key] = value;
  }
  return out;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function gitHead(root) {
  const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD']);
  return stdout.trim();
}

async function mkdirp(p) { await fs.mkdir(p, { recursive: true }); }

async function copyFileChecked(src, dst) {
  if (!(await exists(src))) throw new Error(`Required source missing: ${src}`);
  await mkdirp(path.dirname(dst));
  await fs.copyFile(src, dst);
}

async function copyTree(src, dst, predicate = () => true) {
  if (!(await exists(src))) throw new Error(`Required source directory missing: ${src}`);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (!predicate(from, entry)) continue;
    if (entry.isDirectory()) await copyTree(from, to, predicate);
    else if (entry.isFile()) await copyFileChecked(from, to);
  }
}

async function sha256File(p) {
  const buf = await fs.readFile(p);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function inventory(root) {
  const rows = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        rows.push({
          path: path.relative(root, abs).split(path.sep).join('/'),
          bytes: stat.size,
          sha256: await sha256File(abs)
        });
      }
    }
  }
  await walk(root);
  return rows;
}

async function writeJson(p, value) {
  await mkdirp(path.dirname(p));
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isRawWitnessPath(absPath) {
  return /[/\\]raw\d+[/\\]/.test(absPath) || /[/\\]pilot/i.test(absPath);
}

function usage() {
  console.error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness] [--allow-unpinned-dae true]');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args['blum-root'] || !args['dae-root'] || !args.out) {
    usage();
    process.exitCode = 2;
    return;
  }
  const profile = args.profile || 'portable-analysis';
  if (!['portable-analysis', 'full-witness'].includes(profile)) throw new Error(`Unknown profile: ${profile}`);

  const blumRoot = path.resolve(args['blum-root']);
  const daeRoot = path.resolve(args['dae-root']);
  const outRoot = path.resolve(args.out);
  const allowUnpinned = String(args['allow-unpinned-dae'] || '').toLowerCase() === 'true';

  const blumCommit = await gitHead(blumRoot);
  const daeCommit = await gitHead(daeRoot);
  if (!allowUnpinned && daeCommit !== PINNED_DAE_COMMIT) {
    throw new Error(`DAE checkout is ${daeCommit}; expected pinned ${PINNED_DAE_COMMIT}. Use --allow-unpinned-dae true only for an explicit development bundle.`);
  }

  await fs.rm(outRoot, { recursive: true, force: true });
  await mkdirp(outRoot);

  const labSource = path.join(blumRoot, LAB_REL);
  const appDest = path.join(outRoot, 'app');

  const appFiles = [
    'blum-experimental-lineage-lab-entrance-11sep2026.html',
    'blum-experimental-lineage-console-11sep2026.html',
    'experimental-lineage-vertical-slice-rehearsal-11sep2026.html',
    'dae-retrospective-lineage-import-workbench-11sep2026.html',
    'corpus-and-battery-workbench-11sep2026.html',
    'dae-item-history-workbench-11sep2026.html',
    'dae-output-analysis-workbench-12sep2026.html',
    'adjudication-pass-designer-12sep2026.html',
    'adjudication-pass-core-v0-12sep2026.js',
    'battery-library-core-v0-11sep2026.js',
    'dae-raw-call-lineage-import-adapter-v0-11sep2026.js',
    'dae-unified-observation-index-v1-12sep2026.js',
    'output-surface-projection-v0-12sep2026.js',
    'lexical-output-analysis-v1-12sep2026.js',
    'behavioral-output-analysis-v0-12sep2026.js',
    'nli-output-analysis-core-v0-12sep2026.js',
    'answer-outcome-projection-v0-12sep2026.js'
  ];

  for (const rel of appFiles) await copyFileChecked(path.join(labSource, rel), path.join(appDest, rel));

  const methodFiles = [
    'READ-ME-FIRST-experimental-lineage-console-11sep2026.md',
    'DESIGN-BENCH-STATE-AND-NEXT-SPROUTS-12sep2026.md',
    'OUTPUT-ANALYSIS-NOTE-12sep2026.md',
    'WHOLE-CORPUS-ITEM-HISTORY-11sep2026.md',
    'adjudication-registry-contract-v0-12sep2026.md',
    'PORTABLE-LAB-BUNDLE-CONTRACT-v0-12sep2026.md',
    'raw12-q9-semantic-census-adjudication-pass-v0-12sep2026.json'
  ];
  for (const rel of methodFiles) await copyFileChecked(path.join(labSource, rel), path.join(outRoot, 'methodology', rel));

  const daeExp = path.join(daeRoot, DAE_EXP_REL);
  const daeMethodDest = path.join(outRoot, 'source-methodology', 'EXP-003-the-sixth-question');
  const daeMethodNames = [
    'BLIND-CODING-AND-CORRECTION.md',
    'RAW12-ADJUDICATIONS.json',
    'RAW12-LAST-ADJUDICATION-EVIDENCE.md',
    'SCALE-ORIENTATION-ADJUDICATION.md',
    'RAW12-CARRY-FORWARD-CODEBOOK.md',
    'RAW12-CF1-ADJUDICATION.md',
    'RAW12-LONGITUDINAL-INTEGRITY-NOTE.md',
    'BEFORE-WE-LOOK.md',
    'ANALYSIS-EXCLUSIONS.md'
  ];
  const copiedDaeMethod = [];
  for (const name of daeMethodNames) {
    const src = path.join(daeExp, name);
    if (await exists(src)) {
      await copyFileChecked(src, path.join(daeMethodDest, name));
      copiedDaeMethod.push(name);
    }
  }

  const omittedWitnessClasses = [];
  if (profile === 'full-witness') {
    await copyTree(daeExp, path.join(outRoot, 'witness', 'EXP-003-the-sixth-question'));
  } else {
    omittedWitnessClasses.push('EXP-003 archived raw call trees (raw2…raw12 and other raw witness directories)');
    omittedWitnessClasses.push('Pilot raw witness payloads not explicitly copied as methodology');
  }

  const startHere = `# Blum + DAE portable experimental lab\n\nProfile: **${profile}**\n\n## Open the lab\n\nStart with:\n\n\`app/blum-experimental-lineage-lab-entrance-11sep2026.html\`\n\nThe bundle is static and provider-free for inspection. Some browser security settings restrict local-file fetches; if a workbench needs to load sibling JSON, serve this directory locally, for example:\n\n\`python3 -m http.server 8000\`\n\nthen open \`http://localhost:8000/app/blum-experimental-lineage-lab-entrance-11sep2026.html\`.\n\n## Provenance\n\n- Blum commit: \`${blumCommit}\`\n- DAE commit: \`${daeCommit}\`${daeCommit === PINNED_DAE_COMMIT ? ' (pinned)' : ' (UNPINNED DEVELOPMENT BUILD)'}\n- Source experiment: \`${DAE_EXP_REL}\`\n\n## Bundle semantics\n\nRaw witness, mechanical projection, adjudication, derived measurement and graph/claim remain distinct layers. See \`BUNDLE-MANIFEST.json\` and the files under \`methodology/\`.\n\n${profile === 'portable-analysis' ? 'This analysis profile intentionally omits the bulk archived raw witness corpus. Source provenance is retained; use the full-witness profile for independent reconstruction.\n' : 'This full-witness profile includes the EXP-003 source experiment tree used for independent reconstruction/audit.\n'}\n`;
  await fs.writeFile(path.join(outRoot, 'START-HERE.md'), startHere, 'utf8');

  const preInventory = await inventory(outRoot);
  const manifest = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    profile,
    createdAt: new Date().toISOString(),
    dataset: 'DAE EXP-003 developmental-attractor corpus',
    appEntryPoint: 'app/blum-experimental-lineage-lab-entrance-11sep2026.html',
    blum: { repository: 'YeshuaGod22/blum', commit: blumCommit, labPath: LAB_REL },
    sourceCorpus: {
      repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: daeCommit,
      pinnedExpectedCommit: PINNED_DAE_COMMIT,
      pinned: daeCommit === PINNED_DAE_COMMIT,
      experimentPath: DAE_EXP_REL
    },
    knownCorpusCensus: {
      batteryObservations: 2028,
      canonicalItemIds: 27,
      raw12Calls: 852,
      raw12BranchObservations: 744,
      raw12ExactSharedParentPairs: 372,
      note: 'Known census from the currently exercised pinned corpus; the manifest does not substitute for rebuilding the index.'
    },
    includedSourceMethodology: copiedDaeMethod,
    omittedWitnessClasses,
    rebuildableFromBundledWitnesses: profile === 'full-witness',
    providerRequiredForInspection: false,
    inventoryStatus: 'verified',
    files: preInventory
  };
  await writeJson(path.join(outRoot, 'BUNDLE-MANIFEST.json'), manifest);

  const finalInventory = await inventory(outRoot);
  console.log(JSON.stringify({
    ok: true,
    profile,
    output: outRoot,
    blumCommit,
    daeCommit,
    files: finalInventory.length,
    bytes: finalInventory.reduce((n, x) => n + x.bytes, 0)
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
