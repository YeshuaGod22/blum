#!/usr/bin/env node

/**
 * Blum portable DAE lab bundle builder v1 — 15 Sep 2026
 *
 * Primary scientific unit: CALL -> INPUT PACKAGE -> OUTPUT PACKAGE.
 * Package/event topology stays intact while repeated text is stored once by hash.
 * Trajectory integrity and call-outcome views are published as standalone evidence.
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
async function inventory(root) {
  const rows = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        if (rel === 'BUNDLE-MANIFEST.json') continue;
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
    for (const row of history?.observations || []) if (row?.observationId && !rows.has(String(row.observationId))) rows.set(String(row.observationId), row);
  }
  return [...rows.values()];
}
function populationCounts(index) {
  const rows = uniqueObservationRows(index);
  const coldSchema = rows.filter(row => row.ancestryType === 'cold_schema_no_lived_parent').length;
  return { allAddressableObservations: rows.length, coldSchemaNoLivedParent: coldSchema, nonColdSchemaObservations: rows.length - coldSchema };
}
function csvCell(value) {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join(' | ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function instanceCensusCsv(census) {
  const fields = [
    'instanceUid','collection','instanceKind','ancestryType','family','replicate','trunkKey','probeId','forkId','parentInstanceUid',
    'callCount','firstCallUid','firstInputPackageUid','firstOutputPackageUid','terminalCallUid','terminalInputPackageUid','terminalOutputPackageUid',
    'ownedCallUids','parentTrajectoryCallUids','hasFurtherInferenceCalls','downstreamInferenceCallCount',
    'completeCallCount','truncatedCallCount','contextLimitCallCount','apiFailureCallCount','missingOutputCallCount','otherCallCount',
    'hasFurtherCompleteInferenceCalls','downstreamCompleteInferenceCallCount','trunkExtensionStatus','parentRelationVerificationStatus',
    'visibleContextExchangePairCount','visibleContextHasFurtherPairs','visibleContextDownstreamPairCount',
    'inheritedPrefixMessageCount','inheritedHistoryStatus','firstInput','firstOutput','sourcePaths',
  ];
  return [fields.map(csvCell).join(','), ...(census?.instances || []).map(row => fields.map(field => csvCell(row[field])).join(','))].join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args['blum-root'] || !args['dae-root'] || !args.out) throw new Error('Required: --blum-root PATH --dae-root PATH --out PATH [--profile portable-analysis|full-witness]');

  const blumRoot = path.resolve(args['blum-root']);
  const daeRoot = path.resolve(args['dae-root']);
  const outRoot = path.resolve(args.out);
  const profile = args.profile || 'portable-analysis';
  const lab = path.join(blumRoot, LAB_REL);
  const required = {
    v0: path.join(lab, 'build-portable-dae-lab-bundle-v0-12sep2026.mjs'),
    whole: path.join(lab, 'dae-whole-corpus-index-cli-v1-12sep2026.js'),
    message: path.join(lab, 'dae-message-lineage-graph-v0-15sep2026.js'),
    package: path.join(lab, 'dae-inference-package-graph-v0-15sep2026.js'),
    portablePackage: path.join(lab, 'dae-portable-inference-package-projection-v0-15sep2026.js'),
    trajectoryBind: path.join(lab, 'dae-trajectory-package-bind-v0-15sep2026.js'),
    trajectoryIntegrity: path.join(lab, 'dae-trajectory-package-integrity-v0-15sep2026.js'),
    callOutcomes: path.join(lab, 'dae-call-outcome-census-v0-15sep2026.js'),
    treatment: path.join(lab, 'dae-first-treatment-prompts-v0-15sep2026.js'),
    census: path.join(lab, 'dae-instance-start-census-v0-15sep2026.js'),
  };
  for (const file of Object.values(required)) if (!(await exists(file))) throw new Error(`Required source missing: ${file}`);

  const v0Args = [required.v0, '--blum-root', blumRoot, '--dae-root', daeRoot, '--out', outRoot, '--profile', profile];
  if (String(args['allow-unpinned-dae'] || '').toLowerCase() === 'true') v0Args.push('--allow-unpinned-dae', 'true');
  await execFileAsync(process.execPath, v0Args, { maxBuffer: 32 * 1024 * 1024 });

  const manifestPath = path.join(outRoot, 'BUNDLE-MANIFEST.json');
  const indexPath = path.join(outRoot, 'data', 'dae-whole-corpus-index-v1.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const portableIndex = JSON.parse(await fs.readFile(indexPath, 'utf8'));

  const { buildWholeCorpusIndex } = require(required.whole);
  const { compactInferencePackageGraph } = require(required.portablePackage);
  const fullIndex = buildWholeCorpusIndex(path.join(daeRoot, DAE_EXP_REL), {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: manifest?.sourceCorpus?.commit || null,
    pathPrefix: DAE_EXP_REL,
  });
  if (!fullIndex.inferencePackageGraph?.calls || !fullIndex.instanceStartCensus?.instances || !fullIndex.trajectoryPackageIntegrity || !fullIndex.callOutcomeCensus) {
    throw new Error('Canonical package/trajectory/integrity/outcome layers missing');
  }

  const compactPackageGraph = compactInferencePackageGraph(fullIndex.inferencePackageGraph);
  const packageRel = 'data/dae-inference-package-graph-v0.json';
  const integrityRel = 'data/dae-trajectory-package-integrity-v0.json';
  const outcomeRel = 'data/dae-call-outcome-census-v0.json';
  const censusJsonRel = 'data/dae-instance-start-census-v0.json';
  const censusCsvRel = 'data/dae-instance-start-census-v0.csv';

  portableIndex.messageGraph = fullIndex.messageGraph;
  portableIndex.messageLineage = fullIndex.messageLineage;
  portableIndex.instanceStartCensus = fullIndex.instanceStartCensus;
  portableIndex.inferencePackageGraphRef = {
    schema: compactPackageGraph.schema, path: packageRel, callCount: compactPackageGraph.callCount,
    inputPackageCount: compactPackageGraph.inputPackageCount, outputPackageCount: compactPackageGraph.outputPackageCount,
    sectionCount: compactPackageGraph.sectionCount, contentBlobCount: compactPackageGraph.contentBlobCount,
  };
  portableIndex.trajectoryPackageIntegrityRef = {
    schema: fullIndex.trajectoryPackageIntegrity.schema, path: integrityRel,
    trunkTransitionCount: fullIndex.trajectoryPackageIntegrity.trunkTransitionCount,
    trunkTransitionStatuses: fullIndex.trajectoryPackageIntegrity.trunkTransitionStatuses,
    branchParentRelationCount: fullIndex.trajectoryPackageIntegrity.branchParentRelationCount,
    branchParentRelationStatuses: fullIndex.trajectoryPackageIntegrity.branchParentRelationStatuses,
  };
  portableIndex.callOutcomeCensusRef = {
    schema: fullIndex.callOutcomeCensus.schema, path: outcomeRel,
    callCount: fullIndex.callOutcomeCensus.callCount,
    callOutcomeCounts: fullIndex.callOutcomeCensus.callOutcomeCounts,
    trajectoryCount: fullIndex.callOutcomeCensus.trajectoryCount,
    trajectoriesFullyComplete: fullIndex.callOutcomeCensus.trajectoriesFullyComplete,
    trajectoriesWithIncompleteCalls: fullIndex.callOutcomeCensus.trajectoriesWithIncompleteCalls,
  };
  delete portableIndex.inferencePackageGraph;
  delete portableIndex.trajectoryPackageIntegrity;
  delete portableIndex.callOutcomeCensus;
  portableIndex.populationCounts = populationCounts(portableIndex);
  portableIndex.portableProjection = {
    ...(portableIndex.portableProjection || {}),
    schema: 'blum-dae-portable-index-projection-v1',
    modelVisibleMessagesOmittedFromRows: true,
    messageGraphIncluded: true,
    inferencePackageGraphStandalone: true,
    trajectoryIntegrityStandalone: true,
    callOutcomesStandalone: true,
    packageContentAddressable: true,
    instanceStartCensusIncluded: true,
    rationale: 'Inference packages are primary units. Package topology, trajectory proofs, and call outcomes are standalone addressable views; the whole index keeps only compact refs/summaries rather than duplicating them.',
  };

  await fs.writeFile(indexPath, `${JSON.stringify(portableIndex)}\n`, 'utf8');
  await fs.writeFile(path.join(outRoot, packageRel), `${JSON.stringify(compactPackageGraph)}\n`, 'utf8');
  await fs.writeFile(path.join(outRoot, integrityRel), `${JSON.stringify(fullIndex.trajectoryPackageIntegrity, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outRoot, outcomeRel), `${JSON.stringify(fullIndex.callOutcomeCensus, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outRoot, censusJsonRel), `${JSON.stringify(portableIndex.instanceStartCensus, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outRoot, censusCsvRel), instanceCensusCsv(portableIndex.instanceStartCensus), 'utf8');

  for (const file of Object.values(required).filter(file => !file.endsWith('build-portable-dae-lab-bundle-v0-12sep2026.mjs') && !file.endsWith('dae-whole-corpus-index-cli-v1-12sep2026.js'))) {
    await fs.copyFile(file, path.join(outRoot, 'app', path.basename(file)));
  }

  const startHerePath = path.join(outRoot, 'START-HERE.md');
  let startHere = await fs.readFile(startHerePath, 'utf8');
  startHere += `\n## Inference packages and trajectories (v1)\n\nThe primary unit is **call → input package → output package**. There are **${compactPackageGraph.callCount} calls**, each with one input and output package. System/history/current-user material are sections of the input package; parsed response spans are sections of the raw output package.\n\nPackage graph: \`${packageRel}\`. Trajectory topology proof: \`${integrityRel}\`. Call-outcome census: \`${outcomeRel}\`. Trajectory starts: \`${censusJsonRel}\` / \`${censusCsvRel}\`.\n\nThere are **${portableIndex.instanceStartCensus.instanceCount} trajectories**; **${portableIndex.instanceStartCensus.withFurtherInferenceCalls}** own more than one inference call. The integrity layer proves **${fullIndex.trajectoryPackageIntegrity.trunkTransitionCount}** trunk transitions and records all **${fullIndex.trajectoryPackageIntegrity.branchParentRelationCount}** branch-parent relation states. Outcome counts are preserved separately from administered depth.\n`;
  await fs.writeFile(startHerePath, startHere, 'utf8');

  manifest.bundleSchemaVersion = 'blum-portable-lab-bundle-v1-inference-package-addressable';
  manifest.inferencePackageGraph = { ...portableIndex.inferencePackageGraphRef, availableOffline: true, contentAddressed: true };
  manifest.trajectoryPackageIntegrity = { ...portableIndex.trajectoryPackageIntegrityRef, availableOffline: true };
  manifest.callOutcomeCensus = { ...portableIndex.callOutcomeCensusRef, availableOffline: true };
  manifest.normalizedMessageGraph = { schema: portableIndex.messageGraph.schema, nodeCount: portableIndex.messageGraph.nodeCount, compatibilityProjection: true, contentAddressableOffline: true };
  manifest.instanceStartCensus = {
    schema: portableIndex.instanceStartCensus.schema, instanceCount: portableIndex.instanceStartCensus.instanceCount,
    packageBoundInstanceCount: portableIndex.instanceStartCensus.packageBoundInstanceCount,
    packageUnboundInstanceCount: portableIndex.instanceStartCensus.packageUnboundInstanceCount,
    withFurtherInferenceCalls: portableIndex.instanceStartCensus.withFurtherInferenceCalls,
    withoutFurtherInferenceCalls: portableIndex.instanceStartCensus.withoutFurtherInferenceCalls,
    jsonPath: censusJsonRel, csvPath: censusCsvRel, availableOffline: true,
  };
  manifest.generatedCorpusCensus = {
    ...(manifest.generatedCorpusCensus || {}), allAddressableObservations: portableIndex.populationCounts.allAddressableObservations,
    nonColdSchemaObservations: portableIndex.populationCounts.nonColdSchemaObservations,
    inferenceCalls: compactPackageGraph.callCount, inputPackages: compactPackageGraph.inputPackageCount,
    outputPackages: compactPackageGraph.outputPackageCount, modelTrajectories: portableIndex.instanceStartCensus.instanceCount,
  };
  manifest.portableIndexProjection = portableIndex.portableProjection;
  manifest.files = await inventory(outRoot);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true, profile, calls: compactPackageGraph.callCount, inputPackages: compactPackageGraph.inputPackageCount,
    outputPackages: compactPackageGraph.outputPackageCount, sections: compactPackageGraph.sectionCount,
    contentBlobs: compactPackageGraph.contentBlobCount, trajectories: portableIndex.instanceStartCensus.instanceCount,
    trajectoriesWithFurtherInferenceCalls: portableIndex.instanceStartCensus.withFurtherInferenceCalls,
    trunkTransitionStatuses: fullIndex.trajectoryPackageIntegrity.trunkTransitionStatuses,
    branchParentRelationStatuses: fullIndex.trajectoryPackageIntegrity.branchParentRelationStatuses,
    callOutcomeCounts: fullIndex.callOutcomeCensus.callOutcomeCounts,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
