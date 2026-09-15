#!/usr/bin/env node

/**
 * Blum portable DAE lab bundle builder v1 — 15 Sep 2026
 *
 * Runs the frozen v0 builder, then upgrades the normalized portable projection.
 * Primary scientific unit is now CALL -> INPUT PACKAGE -> OUTPUT PACKAGE.
 * System framing and ordered conversation content are subdivisions of one input
 * package; parsed output spans are subdivisions of one output package.
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

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function sha256File(p) { return crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex'); }

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
  return { allAddressableObservations: rows.length, coldSchemaNoLivedParent: coldSchema, nonColdSchemaObservations: rows.length - coldSchema };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join(' | ') : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function instanceCensusCsv(census) {
  const fields = [
    'instanceUid','collection','instanceKind','ancestryType','family','replicate','trunkKey','probeId','forkId','parentInstanceUid',
    'callCount','firstCallUid','firstInputPackageUid','firstOutputPackageUid','terminalCallUid','terminalInputPackageUid','terminalOutputPackageUid',
    'ownedCallUids','inheritedCallUids','ioPairCount','hasFurtherInputOutputPairs','downstreamInputOutputPairCount',
    'inheritedPrefixMessageCount','inheritedHistoryStatus','firstInput','firstOutput','sourcePaths',
  ];
  const lines = [fields.map(csvCell).join(',')];
  for (const row of (census?.instances || [])) lines.push(fields.map(field => csvCell(row[field])).join(','));
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args['blum-root'] || !args['dae-root'] || !args.out) throw new Error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness] [--allow-unpinned-dae true]');

  const blumRoot = path.resolve(args['blum-root']);
  const daeRoot = path.resolve(args['dae-root']);
  const outRoot = path.resolve(args.out);
  const profile = args.profile || 'portable-analysis';
  const labSource = path.join(blumRoot, LAB_REL);
  const v0 = path.join(labSource, 'build-portable-dae-lab-bundle-v0-12sep2026.mjs');
  const wholeIndexCli = path.join(labSource, 'dae-whole-corpus-index-cli-v1-12sep2026.js');
  const graphModule = path.join(labSource, 'dae-message-lineage-graph-v0-15sep2026.js');
  const packageModule = path.join(labSource, 'dae-inference-package-graph-v0-15sep2026.js');
  const treatmentQuery = path.join(labSource, 'dae-first-treatment-prompts-v0-15sep2026.js');
  const instanceCensusModule = path.join(labSource, 'dae-instance-start-census-v0-15sep2026.js');

  for (const required of [v0, wholeIndexCli, graphModule, packageModule, treatmentQuery, instanceCensusModule]) {
    if (!(await exists(required))) throw new Error(`Required source missing: ${required}`);
  }

  const v0Args = [v0, '--blum-root', blumRoot, '--dae-root', daeRoot, '--out', outRoot, '--profile', profile];
  if (String(args['allow-unpinned-dae'] || '').toLowerCase() === 'true') v0Args.push('--allow-unpinned-dae', 'true');
  await execFileAsync(process.execPath, v0Args, { maxBuffer: 32 * 1024 * 1024 });

  const manifestPath = path.join(outRoot, 'BUNDLE-MANIFEST.json');
  const indexPath = path.join(outRoot, 'data', 'dae-whole-corpus-index-v1.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const portableIndex = JSON.parse(await fs.readFile(indexPath, 'utf8'));

  const { buildWholeCorpusIndex } = require(wholeIndexCli);
  const fullIndex = buildWholeCorpusIndex(path.join(daeRoot, DAE_EXP_REL), {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: manifest?.sourceCorpus?.commit || null,
    pathPrefix: DAE_EXP_REL,
  });

  if (!fullIndex.messageGraph?.nodes || !fullIndex.messageLineage) throw new Error('Canonical index did not produce compatibility message lineage graph');
  if (!fullIndex.inferencePackageGraph?.calls) throw new Error('Canonical index did not produce inference package graph');
  if (!fullIndex.instanceStartCensus?.instances) throw new Error('Canonical index did not produce instance-start census');

  portableIndex.messageGraph = fullIndex.messageGraph;
  portableIndex.messageLineage = fullIndex.messageLineage;
  portableIndex.inferencePackageGraph = fullIndex.inferencePackageGraph;
  portableIndex.instanceStartCensus = fullIndex.instanceStartCensus;
  portableIndex.populationCounts = populationCounts(portableIndex);
  portableIndex.portableProjection = {
    ...(portableIndex.portableProjection || {}),
    schema: 'blum-dae-portable-index-projection-v1',
    modelVisibleMessagesOmittedFromRows: true,
    messageGraphIncluded: true,
    inferencePackageGraphIncluded: true,
    packageContentAddressable: true,
    messageContentAddressable: true,
    generatedOutputContentAddressable: true,
    instanceStartCensusIncluded: true,
    rationale: 'Inference input/output packages are primary addressable experimental units. System framing and conversation messages remain second-layer package sections. Repeated per-observation message arrays may be omitted because package/message content stays addressable offline.',
  };
  await fs.writeFile(indexPath, `${JSON.stringify(portableIndex)}\n`, 'utf8');

  const instanceJsonPath = path.join(outRoot, 'data', 'dae-instance-start-census-v0.json');
  const instanceCsvPath = path.join(outRoot, 'data', 'dae-instance-start-census-v0.csv');
  const packageJsonPath = path.join(outRoot, 'data', 'dae-inference-package-graph-v0.json');
  await fs.writeFile(instanceJsonPath, `${JSON.stringify(portableIndex.instanceStartCensus, null, 2)}\n`, 'utf8');
  await fs.writeFile(instanceCsvPath, instanceCensusCsv(portableIndex.instanceStartCensus), 'utf8');
  await fs.writeFile(packageJsonPath, `${JSON.stringify(portableIndex.inferencePackageGraph)}\n`, 'utf8');

  await fs.copyFile(graphModule, path.join(outRoot, 'app', path.basename(graphModule)));
  await fs.copyFile(packageModule, path.join(outRoot, 'app', path.basename(packageModule)));
  await fs.copyFile(treatmentQuery, path.join(outRoot, 'app', path.basename(treatmentQuery)));
  await fs.copyFile(instanceCensusModule, path.join(outRoot, 'app', path.basename(instanceCensusModule)));

  const startHerePath = path.join(outRoot, 'START-HERE.md');
  let startHere = await fs.readFile(startHerePath, 'utf8');
  startHere += `\n## Inference packages and trajectories (v1)\n\nThe primary unit is **call → input package → output package**. This bundle includes **${portableIndex.inferencePackageGraph.callCount} calls**, each with exactly one addressable input package and one addressable output package. System framing plus ordered model-visible conversation content are sections of the input package, not peer top-level messages. Output XML spans are optional second-layer sections of the raw output package.\n\nThe package graph is available at \`data/dae-inference-package-graph-v0.json\`. The compatibility message graph remains available for message-level traversal.\n\nThe trajectory census contains **${portableIndex.instanceStartCensus.instanceCount} trajectories**. Each exposes its ordered call UIDs and first/terminal input/output package UIDs. Cold/cold-schema calls are ordinary one-call root trajectories; branch trajectories reference inherited parent calls plus their owned branch call. The same view is published as \`data/dae-instance-start-census-v0.json\` and \`data/dae-instance-start-census-v0.csv\`.\n\nPopulation bookkeeping is explicit: **${portableIndex.populationCounts.allAddressableObservations}** addressable observations total; **${portableIndex.populationCounts.coldSchemaNoLivedParent}** are cold-schema/no-lived-parent observations; the historical non-cold-schema projection is **${portableIndex.populationCounts.nonColdSchemaObservations}**. Observation, call, and trajectory populations are distinct objects.\n`;
  await fs.writeFile(startHerePath, startHere, 'utf8');

  manifest.bundleSchemaVersion = 'blum-portable-lab-bundle-v1-inference-package-addressable';
  manifest.inferencePackageGraph = {
    schema: portableIndex.inferencePackageGraph.schema,
    callCount: portableIndex.inferencePackageGraph.callCount,
    inputPackageCount: portableIndex.inferencePackageGraph.inputPackageCount,
    outputPackageCount: portableIndex.inferencePackageGraph.outputPackageCount,
    sectionCount: portableIndex.inferencePackageGraph.sectionCount,
    jsonPath: 'data/dae-inference-package-graph-v0.json',
    availableOffline: true,
  };
  manifest.normalizedMessageGraph = {
    schema: portableIndex.messageGraph.schema,
    nodeCount: portableIndex.messageGraph.nodeCount,
    graphField: 'messageGraph',
    contentAddressableOffline: true,
    compatibilityProjection: true,
    repeatedMessageArraysOmitted: true,
  };
  manifest.instanceStartCensus = {
    schema: portableIndex.instanceStartCensus.schema,
    instanceCount: portableIndex.instanceStartCensus.instanceCount,
    packageBoundInstanceCount: portableIndex.instanceStartCensus.packageBoundInstanceCount,
    packageUnboundInstanceCount: portableIndex.instanceStartCensus.packageUnboundInstanceCount,
    withFurtherInputOutputPairs: portableIndex.instanceStartCensus.withFurtherInputOutputPairs,
    withoutFurtherInputOutputPairs: portableIndex.instanceStartCensus.withoutFurtherInputOutputPairs,
    missingFirstInput: portableIndex.instanceStartCensus.missingFirstInput,
    jsonPath: 'data/dae-instance-start-census-v0.json',
    csvPath: 'data/dae-instance-start-census-v0.csv',
    availableOffline: true,
  };
  manifest.generatedCorpusCensus = {
    ...(manifest.generatedCorpusCensus || {}),
    allAddressableObservations: portableIndex.populationCounts.allAddressableObservations,
    coldSchemaNoLivedParent: portableIndex.populationCounts.coldSchemaNoLivedParent,
    nonColdSchemaObservations: portableIndex.populationCounts.nonColdSchemaObservations,
    inferenceCalls: portableIndex.inferencePackageGraph.callCount,
    inputPackages: portableIndex.inferencePackageGraph.inputPackageCount,
    outputPackages: portableIndex.inferencePackageGraph.outputPackageCount,
    messageNodes: portableIndex.messageGraph.nodeCount,
    modelTrajectories: portableIndex.instanceStartCensus.instanceCount,
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
    calls: portableIndex.inferencePackageGraph.callCount,
    inputPackages: portableIndex.inferencePackageGraph.inputPackageCount,
    outputPackages: portableIndex.inferencePackageGraph.outputPackageCount,
    trajectories: portableIndex.instanceStartCensus.instanceCount,
    packageBoundTrajectories: portableIndex.instanceStartCensus.packageBoundInstanceCount,
    packageJson: 'data/dae-inference-package-graph-v0.json',
    instanceJson: 'data/dae-instance-start-census-v0.json',
    instanceCsv: 'data/dae-instance-start-census-v0.csv',
    projection: portableIndex.portableProjection.schema,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
