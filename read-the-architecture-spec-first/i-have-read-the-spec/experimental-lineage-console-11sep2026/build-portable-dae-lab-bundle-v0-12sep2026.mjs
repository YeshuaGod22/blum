#!/usr/bin/env node

/**
 * Blum portable DAE lab bundle builder v0 — 12 Sep 2026
 *
 * Provider-free. Network-free. Reads local Blum + DAE checkouts and stages a
 * reproducible static bundle with a populated normalized corpus index and a
 * SHA-256 inventory.
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
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
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

async function copyTree(src, dst) {
  if (!(await exists(src))) throw new Error(`Required source directory missing: ${src}`);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
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
  await fs.writeFile(p, `${JSON.stringify(value)}\n`, 'utf8');
}

function usage() {
  console.error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness] [--allow-unpinned-dae true]');
}

function stripPortableRow(row) {
  const { modelVisibleMessages, ...rest } = row;
  return rest;
}

function portableIndexProjection(index, daeCommit) {
  const itemHistories = {};
  for (const [itemId, history] of Object.entries(index.itemHistories || {})) {
    itemHistories[itemId] = {
      ...history,
      observations: (history.observations || []).map(stripPortableRow)
    };
  }
  return {
    schema: index.schema,
    identitySemantics: index.identitySemantics,
    generatedAt: index.generatedAt,
    observationCount: index.observationCount,
    itemCount: index.itemCount,
    collections: index.collections,
    itemHistories,
    source: {
      ...(index.source || {}),
      repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: daeCommit,
      experimentPath: DAE_EXP_REL
    },
    collectionSummaries: index.collectionSummaries || [],
    collectionDiscovery: index.collectionDiscovery || [],
    knownInstrumentMap: index.knownInstrumentMap || {},
    portableProjection: {
      schema: 'blum-dae-portable-index-projection-v0',
      topLevelObservationsOmitted: true,
      modelVisibleMessagesOmittedFromRows: true,
      rationale: 'Avoid duplicate heavyweight witness payloads while retaining every item-history observation used by portable Compare/Analyze.'
    }
  };
}

async function buildNormalizedIndex({ labSource, daeExp, daeCommit, output }) {
  const cli = path.join(labSource, 'dae-whole-corpus-index-cli-v1-12sep2026.js');
  if (!(await exists(cli))) throw new Error(`Whole-corpus index CLI missing: ${cli}`);
  const { buildWholeCorpusIndex } = require(cli);
  const fullIndex = buildWholeCorpusIndex(daeExp, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: daeCommit,
    pathPrefix: DAE_EXP_REL
  });
  if (!Number.isInteger(fullIndex.observationCount) || fullIndex.observationCount < 1) {
    throw new Error('Generated whole-corpus index has no valid observationCount');
  }
  if (!Number.isInteger(fullIndex.itemCount) || fullIndex.itemCount < 1) {
    throw new Error('Generated whole-corpus index has no valid itemCount');
  }
  const index = portableIndexProjection(fullIndex, daeCommit);
  await writeJson(output, index);
  return index;
}

async function patchBundledWorkbench(file, label) {
  let html = await fs.readFile(file, 'utf8');
  if (html.includes('../data/dae-whole-corpus-index-v1.json')) return;
  const closeBody = /<\/body\s*>/i;
  if (!closeBody.test(html)) throw new Error(`${label}: closing body tag not found`);
  const autoMount = `\n<script>\n(async()=>{try{const r=await fetch('../data/dae-whole-corpus-index-v1.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);loadIndex(await r.json());}catch(err){console.warn('Portable bundle auto-mount unavailable; manual loader remains available.',err);}})();\n</script>\n`;
  html = html.replace(closeBody, `${autoMount}</body>`);
  await fs.writeFile(file, html, 'utf8');
}

async function writeRootIndex(outRoot) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blum + DAE Portable Lab</title><style>body{margin:0;background:#0a0a0c;color:#d9d9e1;font:15px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:680px;padding:32px;border:1px solid #2c2c35;border-radius:12px;background:#121216}h1{color:#e8a44a;font:700 22px ui-monospace,monospace}p{line-height:1.6;color:#9999a6}a{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:6px;background:#e8a44a;color:#15110a;text-decoration:none;font-weight:700}</style></head><body><div class="box"><h1>BLUM + DAE PORTABLE LAB</h1><p>This bundle contains the static experimental laboratory and a populated normalized DAE corpus index. Compare and Analyze auto-mount the bundled corpus when served over HTTP.</p><a href="./app/blum-experimental-lineage-lab-entrance-11sep2026.html">Enter lab</a></div></body></html>`;
  await fs.writeFile(path.join(outRoot, 'index.html'), html, 'utf8');
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
  const daeExp = path.join(daeRoot, DAE_EXP_REL);
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
    'dae-corpus-lineage-import-cli-v0-11sep2026.js',
    'dae-unified-observation-index-v1-12sep2026.js',
    'dae-whole-corpus-index-cli-v1-12sep2026.js',
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

  const indexPath = path.join(outRoot, 'data', 'dae-whole-corpus-index-v1.json');
  const corpusIndex = await buildNormalizedIndex({ labSource, daeExp, daeCommit, output: indexPath });

  await patchBundledWorkbench(path.join(appDest, 'dae-item-history-workbench-11sep2026.html'), 'Compare');
  await patchBundledWorkbench(path.join(appDest, 'dae-output-analysis-workbench-12sep2026.html'), 'Analyze');
  await writeRootIndex(outRoot);

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
    omittedWitnessClasses.push('EXP-003 archived raw-call trees, including raw2…raw12');
    omittedWitnessClasses.push('Pilot raw witness payloads not explicitly included as normalized index or methodology');
  }

  const startHere = `# Blum + DAE portable experimental lab\n\nProfile: **${profile}**\n\n## Open the lab\n\nServe this directory locally:\n\n\`python3 -m http.server 8000\`\n\nthen open:\n\n\`http://localhost:8000/\`\n\nThe populated normalized corpus is bundled at:\n\n\`data/dae-whole-corpus-index-v1.json\`\n\nCompare and Analyze auto-mount that index in bundled mode. Their manual loaders remain available as fallback.\n\n## Corpus census generated during this build\n\n- observations: **${corpusIndex.observationCount}**\n- canonical items: **${corpusIndex.itemCount}**\n- discovered collections: \`${(corpusIndex.collectionDiscovery || []).join(', ')}\`\n\n## Provenance\n\n- Blum commit: \`${blumCommit}\`\n- DAE commit: \`${daeCommit}\`${daeCommit === PINNED_DAE_COMMIT ? ' (pinned)' : ' (UNPINNED DEVELOPMENT BUILD)'}\n- Source experiment: \`${DAE_EXP_REL}\`\n\n## Bundle semantics\n\nRaw witness, mechanical projection, adjudication, derived measurement and graph/claim remain distinct layers. See \`BUNDLE-MANIFEST.json\` and the files under \`methodology/\`.\n\n${profile === 'portable-analysis' ? 'This analysis profile intentionally omits the bulk archived raw witness corpus. The populated normalized corpus index remains available for inspection. Use the full-witness profile for independent witness reconstruction.\n' : 'This full-witness profile includes the EXP-003 source experiment tree used for independent reconstruction/audit.\n'}\n`;
  await fs.writeFile(path.join(outRoot, 'START-HERE.md'), startHere, 'utf8');

  const stagedInventory = await inventory(outRoot);
  const manifest = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    profile,
    createdAt: new Date().toISOString(),
    dataset: 'DAE EXP-003 developmental-attractor corpus',
    appEntryPoint: 'index.html',
    normalizedCorpusIndex: 'data/dae-whole-corpus-index-v1.json',
    blum: { repository: 'YeshuaGod22/blum', commit: blumCommit, labPath: LAB_REL },
    sourceCorpus: {
      repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: daeCommit,
      pinnedExpectedCommit: PINNED_DAE_COMMIT,
      pinned: daeCommit === PINNED_DAE_COMMIT,
      experimentPath: DAE_EXP_REL
    },
    generatedCorpusCensus: {
      batteryObservations: corpusIndex.observationCount,
      canonicalItemIds: corpusIndex.itemCount,
      discoveredCollections: corpusIndex.collectionDiscovery || [],
      collectionSummaries: corpusIndex.collectionSummaries || []
    },
    includedSourceMethodology: copiedDaeMethod,
    omittedWitnessClasses,
    rebuildableFromBundledWitnesses: profile === 'full-witness',
    providerRequiredForInspection: false,
    portableIndexProjection: corpusIndex.portableProjection,
    inventoryStatus: 'verified-staged-files-excluding-manifest-itself',
    files: stagedInventory
  };
  await writeJson(path.join(outRoot, 'BUNDLE-MANIFEST.json'), manifest);

  const finalInventory = await inventory(outRoot);
  console.log(JSON.stringify({
    ok: true,
    profile,
    output: outRoot,
    blumCommit,
    daeCommit,
    observations: corpusIndex.observationCount,
    items: corpusIndex.itemCount,
    files: finalInventory.length,
    bytes: finalInventory.reduce((n, x) => n + x.bytes, 0)
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});