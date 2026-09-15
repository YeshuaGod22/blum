#!/usr/bin/env node

/**
 * Blum portable DAE lab bundle builder v1 — 15 Sep 2026
 *
 * Runs the frozen v0 bundle builder, then upgrades the normalized portable
 * projection so repeated modelVisibleMessages arrays may remain omitted while
 * their complete prompt/output content stays UID-addressable in messageGraph.
 * It also ships the instance-start census: every root/trunk/branch instance's
 * first administered input plus downstream input-output depth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
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

async function sha256File(p) {
  return crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
}

async function inventory(root, { excludeManifest = true } = {}) {
  const rows = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        if (excludeManifest && rel === 'BUNDLE-MANIFEST.json') continue;
        const stat = await fs.stat(abs);
        rows.push({ path: rel, bytes: stat.size, sha256: await sha256File(abs) });
      }
    }
  }
  await walk(root);
  return rows;
}

function uniqueObservationRows(index) {
  const rows = new Map();
  for (const history of Object.values(index?.itemHistories || {})) {
    for (const row of (history?.observations || [])) {
      if (row?.observationId && !rows.has(String(row.observationId))) rows.set(String(row.observationId), row);
    }
  }
  return [...rows.values()];
}

function populationCounts(index) {
  const rows = uniqueObservationRows(index);
  const coldSchema = rows.filter(row => row.ancestryType === 'cold_schema_no_lived_parent').length;
  return {
    allAddressableObservations: rows.length,
    coldSchemaNoLivedParent: coldSchema,
    nonColdSchemaObservations: rows.length - coldSchema,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args['blum-root'] || !args['dae-root'] || !args.out) {
    throw new Error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness] [--allow-unpinned-dae true]');
  }

  const blumRoot = path.resolve(args['blum-root']);
  const daeRoot = path.resolve(args['dae-root']);
  const outRoot = path.resolve(args.out);
  const profile = args.profile || 'portable-analysis';
  const labSource = path.join(blumRoot, LAB_REL);
  const v0 = path.join(labSource, 'build-portable-dae-lab-bundle-v0-12sep2026.mjs');
  const wholeIndexCli = path.join(labSource, 'dae-whole-corpus-index-cli-v1-12sep2026.js');
  const graphModule = path.join(labSource, 'dae-message-lineage-graph-v0-15sep2026.js');
  const treatmentQuery = path.join(labSource, 'dae-first-treatment-prompts-v0-15sep2026.js');
  const instanceCensusModule = path.join(labSource, 'dae-instance-start-census-v0-15sep2026.js');

  for (const required of [v0, wholeIndexCli, graphModule, treatmentQuery, instanceCensusModule]) {
    if (!(await exists(required))) throw new Error(`Required source missing: ${required}`);
  }

  const v0Args = [
    v0,
    '--blum-root', blumRoot,
    '--dae-root', daeRoot,
    '--out', outRoot,
    '--profile', profile,
  ];
  if (String(args['allow-unpinned-dae'] || '').toLowerCase() === 'true') {
    v0Args.push('--allow-unpinned-dae', 'true');
  }
  await execFileAsync(process.execPath, v0Args, { maxBuffer: 32 * 1024 * 1024 });

  const manifestPath = path.join(outRoot, 'BUNDLE-MANIFEST.json');
  const indexPath = path.join(outRoot, 'data', 'dae-whole-corpus-index-v1.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const portableIndex = JSON.parse(await fs.readFile(indexPath, 'utf8'));

  // Rebuild from the same pinned witness checkout used by v0. We need the
  // canonical graph and instance census because v0 predates both layers.
  const { buildWholeCorpusIndex } = require(wholeIndexCli);
  const fullIndex = buildWholeCorpusIndex(path.join(daeRoot, DAE_EXP_REL), {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: manifest?.sourceCorpus?.commit || null,
    pathPrefix: DAE_EXP_REL,
  });

  if (!fullIndex.messageGraph?.nodes || !fullIndex.messageLineage) {
    throw new Error('Canonical index did not produce message lineage graph');
  }
  if (!fullIndex.instanceStartCensus?.instances) {
    throw new Error('Canonical index did not produce instance-start census');
  }

  // The portable rows already retain modelVisibleMessageIds/input/output refs
  // because v0 strips only the repeated modelVisibleMessages payload. Injecting
  // the graph therefore makes those refs fully dereferenceable offline.
  portableIndex.messageGraph = fullIndex.messageGraph;
  portableIndex.messageLineage = fullIndex.messageLineage;
  portableIndex.instanceStartCensus = fullIndex.instanceStartCensus;
  portableIndex.populationCounts = populationCounts(portableIndex);
  portableIndex.portableProjection = {
    ...(portableIndex.portableProjection || {}),
    schema: 'blum-dae-portable-index-projection-v1',
    modelVisibleMessagesOmittedFromRows: true,
    messageGraphIncluded: true,
    messageContentAddressable: true,
    generatedOutputContentAddressable: true,
    instanceStartCensusIncluded: true,
    rationale: 'Repeated modelVisibleMessages arrays are omitted only because their complete message/output content is retained once in the UID-addressable message graph. Instance starts and downstream pair depth remain directly inspectable offline. Content is not deleted from the portable scientific record.',
  };
  await fs.writeFile(indexPath, `${JSON.stringify(portableIndex)}\n`, 'utf8');

  // Ship deterministic readers required to traverse/query the normalized data.
  await fs.copyFile(graphModule, path.join(outRoot, 'app', path.basename(graphModule)));
  await fs.copyFile(treatmentQuery, path.join(outRoot, 'app', path.basename(treatmentQuery)));
  await fs.copyFile(instanceCensusModule, path.join(outRoot, 'app', path.basename(instanceCensusModule)));

  const startHerePath = path.join(outRoot, 'START-HERE.md');
  let startHere = await fs.readFile(startHerePath, 'utf8');
  startHere += `\n## Addressable treatment history and instance starts (v1)\n\nThe portable normalized index includes a UID-addressable message graph with **${portableIndex.messageGraph.nodeCount} message/output nodes**. Repeated per-observation \`modelVisibleMessages\` arrays may be omitted, but their complete textual content remains in \`messageGraph.nodes\` and each observation retains message UID references.\n\nThe index also includes \`instanceStartCensus\` with **${portableIndex.instanceStartCensus.instanceCount} model instances/trajectories**. Each entry exposes its first administered input, first output when available, total complete input-output pairs, and whether further pairs occur downstream. Cold/cold-schema calls are ordinary root instances; replicate labels are not treated as instance IDs.\n\nPopulation bookkeeping is explicit: **${portableIndex.populationCounts.allAddressableObservations}** addressable observations total; **${portableIndex.populationCounts.coldSchemaNoLivedParent}** are cold-schema/no-lived-parent observations; the historical non-cold-schema projection is **${portableIndex.populationCounts.nonColdSchemaObservations}**. These are different populations, not interchangeable denominators.\n`;
  await fs.writeFile(startHerePath, startHere, 'utf8');

  manifest.bundleSchemaVersion = 'blum-portable-lab-bundle-v1-message-addressable';
  manifest.normalizedMessageGraph = {
    schema: portableIndex.messageGraph.schema,
    nodeCount: portableIndex.messageGraph.nodeCount,
    graphField: 'messageGraph',
    contentAddressableOffline: true,
    repeatedMessageArraysOmitted: true,
  };
  manifest.instanceStartCensus = {
    schema: portableIndex.instanceStartCensus.schema,
    instanceCount: portableIndex.instanceStartCensus.instanceCount,
    withFurtherInputOutputPairs: portableIndex.instanceStartCensus.withFurtherInputOutputPairs,
    withoutFurtherInputOutputPairs: portableIndex.instanceStartCensus.withoutFurtherInputOutputPairs,
    missingFirstInput: portableIndex.instanceStartCensus.missingFirstInput,
    availableOffline: true,
  };
  manifest.generatedCorpusCensus = {
    ...(manifest.generatedCorpusCensus || {}),
    allAddressableObservations: portableIndex.populationCounts.allAddressableObservations,
    coldSchemaNoLivedParent: portableIndex.populationCounts.coldSchemaNoLivedParent,
    nonColdSchemaObservations: portableIndex.populationCounts.nonColdSchemaObservations,
    messageNodes: portableIndex.messageGraph.nodeCount,
    modelInstances: portableIndex.instanceStartCensus.instanceCount,
  };
  manifest.portableIndexProjection = portableIndex.portableProjection;
  manifest.inventoryStatus = 'verified-v1-staged-files-excluding-manifest-itself';
  manifest.files = await inventory(outRoot, { excludeManifest: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    profile,
    output: outRoot,
    observations: portableIndex.populationCounts.allAddressableObservations,
    nonColdSchemaObservations: portableIndex.populationCounts.nonColdSchemaObservations,
    coldSchemaNoLivedParent: portableIndex.populationCounts.coldSchemaNoLivedParent,
    messageNodes: portableIndex.messageGraph.nodeCount,
    instances: portableIndex.instanceStartCensus.instanceCount,
    instancesWithFurtherPairs: portableIndex.instanceStartCensus.withFurtherInputOutputPairs,
    projection: portableIndex.portableProjection.schema,
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
