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
    assert.ok(Array.isArray(input.sectionUids));
    for (const sectionUid of input.sectionUids) {
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
    assert.equal(instance.callCount, instance.callUids.length);
    if (instance.instanceKind === 'branch_from_lived_trunk') {
      assert.ok(instance.inheritedCallUids.length >= 1, `branch has no inherited calls: ${instance.instanceUid}`);
      assert.equal(instance.callUids.at(-1), instance.ownedCallUids.at(-1));
    }
  }

  // Call ownership conservation: every administered call is owned by exactly one
  // trajectory. Inherited call references do not count as ownership.
  const ownership = new Map();
  for (const instance of census.instances) {
    for (const callUid of instance.ownedCallUids) {
      ownership.set(callUid, (ownership.get(callUid) || 0) + 1);
    }
  }
  assert.equal(ownership.size, graph.callCount, 'some calls are not owned by a trajectory');
  for (const [callUid, count] of ownership.entries()) {
    assert.equal(count, 1, `call ownership is not conserved: ${callUid}`);
  }

  // The system prompt is a section of the input package, not a peer package.
  const packageWithSystem = Object.values(inputPackages).find(pkg => pkg.canonicalPackage.systemPrompt !== null);
  if (packageWithSystem) {
    const systemSections = packageWithSystem.sectionUids.map(id => sections[id]).filter(x => x.sectionType === 'system');
    assert.equal(systemSections.length, 1);
    assert.equal(systemSections[0].content, packageWithSystem.canonicalPackage.systemPrompt);
  }

  // C-r1 remains 25 independent one-call trajectories and therefore 25 distinct
  // input-package events, even when package content happens to be identical.
  const raw7Cr1 = census.instances.filter(x => x.collection === 'raw7' && x.family === 'C' && Number(x.replicate) === 1 && x.instanceKind === 'root_single_call');
  assert.equal(raw7Cr1.length, 25);
  assert.equal(new Set(raw7Cr1.map(x => x.firstInputPackageUid)).size, 25);
  assert.ok(raw7Cr1.every(x => x.callCount === 1));

  // Pilot ASb branch trajectory inherits the five parent calls and owns one
  // branch call; its terminal input package is therefore the actual N9 branch
  // inference package, while its first package is the parent's first call.
  const pilotAsb = census.instances.filter(x => x.collection === 'pilot1' && x.family === 'ASb');
  assert.equal(pilotAsb.length, 2);
  assert.ok(pilotAsb.every(x => x.inheritedCallUids.length === 5));
  assert.ok(pilotAsb.every(x => x.ownedCallUids.length === 1));
  assert.ok(pilotAsb.every(x => x.callCount === 6));

  const bySourceKind = {};
  for (const call of calls) bySourceKind[call.sourceKind] = (bySourceKind[call.sourceKind] || 0) + 1;

  console.log('PASS real DAE inference package graph');
  console.log(JSON.stringify({
    calls: graph.callCount,
    inputPackages: graph.inputPackageCount,
    outputPackages: graph.outputPackageCount,
    sections: graph.sectionCount,
    trajectories: census.instanceCount,
    packageBoundTrajectories: census.packageBoundInstanceCount,
    callOwnershipCount: ownership.size,
    bySourceKind,
    raw7Cr1InputPackages: raw7Cr1.length,
    pilotAsb: pilotAsb.map(x => ({
      instanceUid: x.instanceUid,
      inheritedCalls: x.inheritedCallUids.length,
      ownedCalls: x.ownedCallUids.length,
      totalTrajectoryCalls: x.callCount,
      firstInputPackageUid: x.firstInputPackageUid,
      terminalInputPackageUid: x.terminalInputPackageUid,
    })),
  }, null, 2));
}

main();
