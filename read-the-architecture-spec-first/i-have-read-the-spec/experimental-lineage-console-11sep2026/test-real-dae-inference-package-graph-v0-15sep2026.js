'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-inference-package-graph-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const graph = index.inferencePackageGraph;
  assert.ok(graph, 'inference package graph missing');
  assert.equal(graph.schema, 'blum-dae-inference-package-graph-v0');
  assert.ok(graph.callCount > 0);
  assert.equal(graph.inputPackageCount, graph.callCount, 'every call must own exactly one input package');
  assert.equal(graph.outputPackageCount, graph.callCount, 'every call must own exactly one output package');

  const calls = Object.values(graph.calls);
  const inputPackages = graph.inputPackages;
  const outputPackages = graph.outputPackages;
  const sections = graph.sections;

  for (const call of calls) {
    const input = inputPackages[call.inputPackageUid];
    const output = outputPackages[call.outputPackageUid];
    assert.ok(input, `input package missing: ${call.callUid}`);
    assert.ok(output, `output package missing: ${call.callUid}`);
    assert.equal(input.callUid, call.callUid);
    assert.equal(output.callUid, call.callUid);
    for (const sectionUid of input.sectionUids || []) {
      assert.ok(sections[sectionUid], `input section missing: ${sectionUid}`);
      assert.equal(sections[sectionUid].packageUid, input.inputPackageUid);
    }
    for (const sectionUid of output.sectionUids || []) {
      assert.ok(sections[sectionUid], `output section missing: ${sectionUid}`);
      assert.equal(sections[sectionUid].packageUid, output.outputPackageUid);
    }
  }

  const census = index.instanceStartCensus;
  assert.ok(census?.instances?.length);
  assert.equal(census.packageUnboundInstanceCount, 0, 'every trajectory must bind to package-bearing calls');
  assert.equal(census.packageBoundInstanceCount, census.instanceCount);

  for (const instance of census.instances) {
    assert.ok(instance.firstCallUid, `first call missing: ${instance.instanceUid}`);
    assert.ok(instance.firstInputPackageUid, `first input package missing: ${instance.instanceUid}`);
    assert.ok(instance.firstOutputPackageUid, `first output package missing: ${instance.instanceUid}`);
    assert.ok(inputPackages[instance.firstInputPackageUid]);
    assert.ok(outputPackages[instance.firstOutputPackageUid]);
    assert.ok(Array.isArray(instance.ownedCallUids));
    assert.ok(instance.ownedCallUids.length >= 1, `trajectory owns no calls: ${instance.instanceUid}`);
    assert.deepEqual(instance.callUids, instance.ownedCallUids, 'trajectory call depth must count owned inference calls only');
    assert.equal(instance.callCount, instance.ownedCallUids.length);
    assert.equal(instance.hasFurtherInferenceCalls, instance.downstreamInferenceCallCount > 0);
    assert.equal(instance.downstreamInferenceCallCount, Math.max(0, instance.callCount - 1));
  }

  // Every administered call is owned exactly once. Parent trajectory calls may be
  // referenced as ancestry metadata, but are not duplicated into branch depth.
  const ownership = new Map();
  for (const instance of census.instances) {
    for (const callUid of instance.ownedCallUids) ownership.set(callUid, (ownership.get(callUid) || 0) + 1);
  }
  assert.equal(ownership.size, graph.callCount, 'some calls are not owned by a trajectory');
  for (const [callUid, count] of ownership.entries()) assert.equal(count, 1, `call ownership is not conserved: ${callUid}`);

  // System framing is a section of ONE inference input package.
  const packageWithSystem = Object.values(inputPackages).find(pkg => pkg.canonicalPackage.systemPrompt !== null);
  if (packageWithSystem) {
    const systemSections = packageWithSystem.sectionUids.map(id => sections[id]).filter(x => x.sectionType === 'system');
    assert.equal(systemSections.length, 1);
    assert.equal(systemSections[0].content, packageWithSystem.canonicalPackage.systemPrompt);
  }

  const raw7Cr1 = census.instances.filter(x => x.collection === 'raw7' && x.family === 'C' && Number(x.replicate) === 1 && x.instanceKind === 'root_single_call');
  assert.equal(raw7Cr1.length, 25);
  assert.equal(new Set(raw7Cr1.map(x => x.firstInputPackageUid)).size, 25);
  assert.ok(raw7Cr1.every(x => x.callCount === 1 && x.hasFurtherInferenceCalls === false));

  // ASb is one branch inference call whose INPUT PACKAGE contains the inherited
  // five-turn conversation. The inherited history must not be counted as five
  // earlier calls belonging to the branch trajectory.
  const pilotAsb = census.instances.filter(x => x.collection === 'pilot1' && x.family === 'ASb');
  assert.equal(pilotAsb.length, 2);
  assert.ok(pilotAsb.every(x => x.ownedCallUids.length === 1));
  assert.ok(pilotAsb.every(x => x.callCount === 1));
  assert.ok(pilotAsb.every(x => x.hasFurtherInferenceCalls === false));
  assert.ok(pilotAsb.every(x => x.visibleContextExchangePairCount === 6));
  assert.ok(pilotAsb.every(x => x.parentTrajectoryCallUids.length === 5));
  for (const branch of pilotAsb) {
    const pkg = inputPackages[branch.firstInputPackageUid];
    assert.ok(pkg.canonicalPackage.messages.length >= 11, 'ASb input package should contain inherited history plus N9 user input');
  }

  // Root Pilot trunks really are multi-call trajectories.
  const pilotTrunks = census.instances.filter(x => x.collection === 'pilot1' && x.instanceKind === 'root_lived_trunk');
  assert.equal(pilotTrunks.length, 2);
  assert.ok(pilotTrunks.every(x => x.callCount === 5 && x.downstreamInferenceCallCount === 4));

  const bySourceKind = {};
  for (const call of calls) bySourceKind[call.sourceKind] = (bySourceKind[call.sourceKind] || 0) + 1;

  console.log('PASS real DAE inference package graph');
  console.log(JSON.stringify({
    calls: graph.callCount,
    inputPackages: graph.inputPackageCount,
    outputPackages: graph.outputPackageCount,
    sections: graph.sectionCount,
    trajectories: census.instanceCount,
    trajectoriesWithFurtherInferenceCalls: census.withFurtherInferenceCalls,
    packageBoundTrajectories: census.packageBoundInstanceCount,
    callOwnershipCount: ownership.size,
    bySourceKind,
    raw7Cr1InputPackages: raw7Cr1.length,
    pilotAsb: pilotAsb.map(x => ({ instanceUid: x.instanceUid, callCount: x.callCount, visibleContextPairs: x.visibleContextExchangePairCount, parentTrajectoryCalls: x.parentTrajectoryCallUids.length, firstInputPackageUid: x.firstInputPackageUid })),
  }, null, 2));
}

main();
