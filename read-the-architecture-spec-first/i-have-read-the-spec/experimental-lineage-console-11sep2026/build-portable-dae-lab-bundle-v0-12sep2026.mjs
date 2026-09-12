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
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function usage() {
  console.error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness] [--allow-unpinned-dae true]');
}

async function buildNormalizedIndex({ labSource, daeExp, daeCommit, output }) {
  const cli = path.join(labSource, 'dae-whole-corpus-index-cli-v1-12sep2026.js');
  if (!(await exists(cli))) throw new Error(`Whole-corpus index CLI missing: ${cli}`);
  await mkdirp(path.dirname(output));
  await execFileAsync(process.execPath, [cli, daeExp, output], { maxBuffer: 16 * 1024 * 1024 });
  const index = JSON.parse(await fs.readFile(output, 'utf8'));
  index.source = {
    ...(index.source || {}),
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: daeCommit,
    experimentPath: DAE_EXP_REL
  };
  await writeJson(output, index);
  if (!Number.isInteger(index.observationCount) || index.observationCount < 1) {
    throw new Error('Generated whole-corpus index has no valid observationCount');
  }
  if (!Number.isInteger(index.itemCount) || index.itemCount < 1) {
    throw new Error('Generated whole-corpus index has no valid itemCount');
  }
  return index;
}

async function injectBundleAutoload(htmlPath) {
  let html = await fs.readFile(htmlPath, 'utf8');
  const marker = 'BLUM_PORTABLE_BUNDLE_AUTOLOAD_V0';
  if (html.includes(marker)) return;
  const injection = `\n<script data-blum-portable="${marker}">\n(async()=>{\n  try {\n    const r=await fetch('../data/dae-whole-corpus-index-v1.json',{cache:'no-store'});\n    if(!r.ok)return;\n    const obj=await r.json();\n    if(typeof loadIndex==='function'){\n      loadIndex(obj);\n      const s=document.getElementById('status');\n      if(s)s.textContent=(s.textContent||'')+' · bundled corpus auto-mounted';\n    }\n  } catch (_) { /* file:// and non-bundle mode retain manual loader */ }\n})();\n</script>\n`;
  if (!html.includes('</body>')) throw new Error(`Cannot inject bundle autoload into ${htmlPath}: </body> missing`);
  html = html.replace('</body>', `${injection}</body>`);
  await fs.writeFile(htmlPath, html, 'utf8');
}

async function writeRootLauncher(outRoot, corpusIndex, profile) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blum + DAE Portable Lab</title><style>body{margin:0;background:#0a0a0c;color:#d9d9e1;font:14px system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:48px 20px}h1{font:700 22px ui-monospace,monospace;color:#e8a44a}a{color:#e8a44a}.card{border:1px solid #2c2c35;background:#121216;border-radius:9px;padding:18px;margin:14px 0}.mono{font-family:ui-monospace,monospace;color:#8b8b99}.go{display:inline-block;padding:10px 14px;border:1px solid #e8a44a;border-radius:6px;text-decoration:none;margin-top:8px}</style></head><body><main><h1>BLUM + DAE PORTABLE EXPERIMENTAL LAB</h1><div class="card"><b>${profile}</b><p>${corpusIndex.observationCount} normalized battery observations · ${corpusIndex.itemCount} canonical item IDs.</p><p>Compare and Analyze auto-mount the bundled corpus when this directory is served locally.</p><a class="go" href="./app/blum-experimental-lineage-lab-entrance-11sep2026.html">ENTER LAB →</a></div><div class="card"><b>Run locally</b><p class="mono">python3 -m http.server 8000</p><p>Then open <span class="mono">http://localhost:8000/</span>. Direct <span class="mono">file://</span> opening may prevent browsers from fetching the bundled JSON.</p></div><p class="mono">See START-HERE.md and BUNDLE-MANIFEST.json for provenance and integrity.</p></main></body></html>`;
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

  await injectBundleAutoload(path.join(appDest, 'dae-item-history-workbench-11sep2026.html'));
  await injectBundleAutoload(path.join(appDest, 'dae-output-analysis-workbench-12sep2026.html'));

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
  await writeRootLauncher(outRoot, corpusIndex, profile);

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

  const startHere = `# Blum + DAE portable experimental lab\n\nProfile: **${profile}**\n\n## Start\n\nFrom the bundle directory run:\n\n\`python3 -m http.server 8000\`\n\nthen open:\n\n\`http://localhost:8000/\`\n\nThe root launcher opens the six-door lab. Bundled copies of **Compare** and **Analyze** automatically mount:\n\n\`data/dae-whole-corpus-index-v1.json\`\n\nTheir manual JSON loaders remain available if auto-mount fails or another index is desired.\n\n## Corpus census generated during this build\n\n- observations: **${corpusIndex.observationCount}**\n- canonical items: **${corpusIndex.itemCount}**\n- discovered collections: \`${(corpusIndex.collectionDiscovery || []).join(', ')}\`\n\n## Provenance\n\n- Blum commit: \`${blumCommit}\`\n- DAE commit: \`${daeCommit}\`${daeCommit === PINNED_DAE_COMMIT ? ' (pinned)' : ' (UNPINNED DEVELOPMENT BUILD)'}\n- Source experiment: \`${DAE_EXP_REL}\`\n\n## Bundle semantics\n\nRaw witness, mechanical projection, adjudication, derived measurement and graph/claim remain distinct layers. See \`BUNDLE-MANIFEST.json\` and the files under \`methodology/\`.\n\n${profile === 'portable-analysis' ? 'This analysis profile intentionally omits the bulk archived raw witness corpus. The normalized corpus index is present; source provenance is retained. Use the full-witness profile for independent witness reconstruction.\n' : 'This full-witness profile includes the EXP-003 source experiment tree used for independent reconstruction/audit.\n'}\n`;
  await fs.writeFile(path.join(outRoot, 'START-HERE.md'), startHere, 'utf8');

  const stagedInventory = await inventory(outRoot);
  const manifest = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    profile,
    createdAt: new Date().toISOString(),
    dataset: 'DAE EXP-003 developmental-attractor corpus',
    appEntryPoint: 'index.html',
    labEntryPoint: 'app/blum-experimental-lineage-lab-entrance-11sep2026.html',
    normalizedCorpusIndex: 'data/dae-whole-corpus-index-v1.json',
    bundledAutoload: {
      compare: true,
      analyze: true,
      pathFromApp: '../data/dae-whole-corpus-index-v1.json'
    },
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
    compareAutoload: true,
    analyzeAutoload: true,
    files: finalInventory.length,
    bytes: finalInventory.reduce((n, x) => n + x.bytes, 0)
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
