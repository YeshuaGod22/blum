#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

async function main() {
  const daeRoot = process.argv[2];
  const blumRoot = process.argv[3];
  if (!daeRoot || !blumRoot) throw new Error('Usage: node test-portable-message-addressability-v1-15sep2026.mjs <dae-root> <blum-root>');

  const lab = path.join(path.resolve(blumRoot), 'read-the-architecture-spec-first/i-have-read-the-spec/experimental-lineage-console-11sep2026');
  const builder = path.join(lab, 'build-portable-dae-lab-bundle-v1-15sep2026.mjs');
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'blum-portable-package-v1-'));
  await execFileAsync(process.execPath, [builder, '--blum-root', path.resolve(blumRoot), '--dae-root', path.resolve(daeRoot), '--out', out, '--profile', 'portable-analysis'], { maxBuffer: 32 * 1024 * 1024 });

  const index = JSON.parse(await fs.readFile(path.join(out, 'data', 'dae-whole-corpus-index-v1.json'), 'utf8'));
  const packageGraph = JSON.parse(await fs.readFile(path.join(out, 'data', 'dae-inference-package-graph-v0.json'), 'utf8'));
  const integrity = JSON.parse(await fs.readFile(path.join(out, 'data', 'dae-trajectory-package-integrity-v0.json'), 'utf8'));
  const outcomes = JSON.parse(await fs.readFile(path.join(out, 'data', 'dae-call-outcome-census-v0.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'BUNDLE-MANIFEST.json'), 'utf8'));
  const portablePackage = require(path.join(out, 'app', 'dae-portable-inference-package-projection-v0-15sep2026.js'));

  assert.equal(index.portableProjection.schema, 'blum-dae-portable-index-projection-v1');
  assert.equal(index.portableProjection.inferencePackageGraphStandalone, true);
  assert.equal(index.portableProjection.trajectoryIntegrityStandalone, true);
  assert.equal(index.portableProjection.callOutcomesStandalone, true);
  assert.equal(Object.hasOwn(index, 'inferencePackageGraph'), false, 'whole index must not duplicate package graph');
  assert.equal(Object.hasOwn(index, 'trajectoryPackageIntegrity'), false, 'whole index must not duplicate integrity rows');
  assert.equal(Object.hasOwn(index, 'callOutcomeCensus'), false, 'whole index must not duplicate outcome rows');

  assert.equal(packageGraph.schema, 'blum-dae-portable-inference-package-graph-v0');
  assert.equal(packageGraph.callCount, 2659);
  assert.equal(packageGraph.inputPackageCount, 2659);
  assert.equal(packageGraph.outputPackageCount, 2659);
  assert.equal(Object.keys(packageGraph.calls).length, 2659);
  assert.ok(packageGraph.contentBlobCount > 0);
  assert.ok(Object.values(packageGraph.inputPackages).every(pkg => !Object.hasOwn(pkg, 'canonicalPackage')));
  assert.ok(Object.values(packageGraph.outputPackages).every(pkg => !Object.hasOwn(pkg, 'content')));
  assert.ok(Object.values(packageGraph.sections).every(section => !Object.hasOwn(section, 'content')));

  for (const call of Object.values(packageGraph.calls)) {
    assert.ok(packageGraph.inputPackages[call.inputPackageUid], `missing input package: ${call.callUid}`);
    assert.ok(packageGraph.outputPackages[call.outputPackageUid], `missing output package: ${call.callUid}`);
    const reconstructedInput = portablePackage.reconstructInputPackage(packageGraph, call.inputPackageUid);
    const reconstructedOutput = portablePackage.reconstructOutputPackage(packageGraph, call.outputPackageUid);
    assert.ok(Array.isArray(reconstructedInput.messages));
    assert.equal(typeof reconstructedOutput, 'string');
  }

  // Topology proof survives offline.
  assert.equal(integrity.schema, 'blum-dae-trajectory-package-integrity-v0');
  assert.equal(integrity.trunkTransitionCount, 239);
  assert.deepEqual(integrity.trunkTransitionStatuses, { verified_exact_extension: 239 });
  assert.equal(integrity.branchParentRelationCount, 1708);
  assert.equal(integrity.branchParentRelationStatuses.verified_exact_extension, 1442);
  assert.equal(integrity.branchParentRelationStatuses.parent_trajectory_unmaterialized, 266);
  assert.equal(integrity.parentRelations.filter(x => x.parentTerminalCallUid && x.status !== 'verified_exact_extension').length, 0);

  // Outcome view survives offline without altering call identity.
  assert.equal(outcomes.schema, 'blum-dae-call-outcome-census-v0');
  assert.equal(outcomes.callCount, 2659);
  assert.deepEqual(outcomes.callOutcomeCounts, { complete: 2658, truncated: 1 });
  assert.equal(outcomes.trajectoriesFullyComplete, 2419);
  assert.equal(outcomes.trajectoriesWithIncompleteCalls, 1);
  const incomplete = outcomes.trajectories.filter(x => x.completeCallCount !== x.administeredCallCount);
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].truncatedCallCount, 1);
  assert.equal(incomplete[0].incompleteCalls.length, 1);
  assert.ok(packageGraph.calls[incomplete[0].incompleteCalls[0].callUid]);

  const instances = index.instanceStartCensus.instances;
  assert.equal(index.instanceStartCensus.instanceCount, 2420);
  assert.equal(index.instanceStartCensus.packageBoundInstanceCount, 2420);
  assert.equal(index.instanceStartCensus.packageUnboundInstanceCount, 0);
  assert.equal(index.instanceStartCensus.withFurtherInferenceCalls, 42);
  assert.equal(index.instanceStartCensus.withoutFurtherInferenceCalls, 2378);
  for (const instance of instances) {
    assert.ok(packageGraph.calls[instance.firstCallUid], `first call not portable: ${instance.instanceUid}`);
    assert.ok(packageGraph.inputPackages[instance.firstInputPackageUid], `first package not portable: ${instance.instanceUid}`);
    assert.equal(instance.callCount, instance.ownedCallUids.length);
  }

  const raw7Cr1 = instances.filter(x => x.collection === 'raw7' && x.family === 'C' && Number(x.replicate) === 1 && x.instanceKind === 'root_single_call');
  assert.equal(raw7Cr1.length, 25);
  assert.equal(new Set(raw7Cr1.map(x => x.firstInputPackageUid)).size, 25);
  assert.ok(raw7Cr1.every(x => x.callCount === 1 && !x.hasFurtherInferenceCalls));

  const pilotAsb = instances.filter(x => x.collection === 'pilot1' && x.family === 'ASb');
  assert.equal(pilotAsb.length, 2);
  assert.ok(pilotAsb.every(x => x.callCount === 1 && !x.hasFurtherInferenceCalls));
  assert.ok(pilotAsb.every(x => x.visibleContextExchangePairCount === 6));
  assert.ok(pilotAsb.every(x => x.parentTrajectoryCallUids.length === 5));
  for (const branch of pilotAsb) {
    const reconstructed = portablePackage.reconstructInputPackage(packageGraph, branch.firstInputPackageUid);
    assert.ok(reconstructed.messages.length >= 11, 'Pilot ASb package lost inherited conversation content');
  }

  // Compatibility observation/message projection remains self-contained.
  assert.equal(index.messageGraph.nodeCount, 7889);
  let rows = 0;
  for (const history of Object.values(index.itemHistories || {})) {
    for (const row of history.observations || []) {
      rows += 1;
      assert.equal(Object.hasOwn(row, 'modelVisibleMessages'), false);
      for (const messageUid of row.modelVisibleMessageIds || []) assert.ok(index.messageGraph.nodes[messageUid]);
    }
  }
  assert.equal(rows, 2378);

  assert.equal(manifest.inferencePackageGraph.callCount, 2659);
  assert.equal(manifest.trajectoryPackageIntegrity.trunkTransitionCount, 239);
  assert.deepEqual(manifest.callOutcomeCensus.callOutcomeCounts, { complete: 2658, truncated: 1 });
  assert.equal(manifest.instanceStartCensus.withFurtherInferenceCalls, 42);
  assert.equal(manifest.instanceStartCensus.withoutFurtherInferenceCalls, 2378);
  const paths = new Set((manifest.files || []).map(x => x.path));
  for (const required of [
    'data/dae-inference-package-graph-v0.json',
    'data/dae-trajectory-package-integrity-v0.json',
    'data/dae-call-outcome-census-v0.json',
    'data/dae-instance-start-census-v0.json',
    'data/dae-instance-start-census-v0.csv',
    'app/dae-inference-package-graph-v0-15sep2026.js',
    'app/dae-portable-inference-package-projection-v0-15sep2026.js',
    'app/dae-trajectory-package-bind-v0-15sep2026.js',
    'app/dae-trajectory-package-integrity-v0-15sep2026.js',
    'app/dae-call-outcome-census-v0-15sep2026.js',
  ]) assert.ok(paths.has(required), `portable file missing: ${required}`);

  console.log('PASS compact portable inference-package bundle v1');
  console.log(JSON.stringify({
    calls: packageGraph.callCount,
    inputPackages: packageGraph.inputPackageCount,
    outputPackages: packageGraph.outputPackageCount,
    sectionEvents: packageGraph.sectionCount,
    uniqueContentBlobs: packageGraph.contentBlobCount,
    trajectories: index.instanceStartCensus.instanceCount,
    trajectoriesWithFurtherInferenceCalls: index.instanceStartCensus.withFurtherInferenceCalls,
    oneCallTrajectories: index.instanceStartCensus.withoutFurtherInferenceCalls,
    topology: {
      trunkTransitions: integrity.trunkTransitionStatuses,
      branchParents: integrity.branchParentRelationStatuses,
    },
    outcomes: outcomes.callOutcomeCounts,
    raw7Cr1Calls: raw7Cr1.length,
    pilotAsbVisiblePairsVsCalls: pilotAsb.map(x => ({ visiblePairs: x.visibleContextExchangePairCount, inferenceCalls: x.callCount })),
  }, null, 2));
}

main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
