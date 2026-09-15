'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');

function countBy(rows, field) {
  const out = {};
  for (const row of rows) {
    const key = String(row?.[field] ?? '<missing>');
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-instance-start-census-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const census = index.instanceStartCensus;
  assert.ok(census, 'instance-start census missing');
  assert.equal(census.schema, 'blum-dae-instance-start-census-v0');
  assert.equal(census.missingFirstInput, 0, 'every trajectory must expose recoverable visible input content');
  assert.equal(census.packageUnboundInstanceCount, 0, 'every trajectory must bind to at least one inference package');

  const instances = census.instances;
  assert.equal(new Set(instances.map(x => x.instanceUid)).size, instances.length, 'instance UIDs must be unique');

  for (const instance of instances) {
    assert.ok(instance.firstInputPackageUid, `first inference package missing: ${instance.instanceUid}`);
    assert.ok(instance.firstOutputPackageUid, `first output package missing: ${instance.instanceUid}`);
    assert.ok(instance.firstCallUid, `first call missing: ${instance.instanceUid}`);
    assert.equal(instance.callCount, instance.ownedCallUids.length);
    assert.equal(instance.hasFurtherInferenceCalls, instance.downstreamInferenceCallCount > 0);
    assert.equal(instance.downstreamInferenceCallCount, Math.max(0, instance.callCount - 1));
    // Compatibility fields remain explicit: these describe exchanges visible in
    // package content, not inference-call depth.
    assert.equal(instance.visibleContextExchangePairCount, instance.ioPairCount);
  }

  // C-r1 is a replicate grouping across 25 independent inference calls.
  const raw7C = instances.filter(x => x.collection === 'raw7' && x.family === 'C' && x.instanceKind === 'root_single_call');
  assert.equal(raw7C.length, 250, 'raw7 C must be 250 independent trajectories/calls');
  const raw7Cr1 = raw7C.filter(x => Number(x.replicate) === 1);
  assert.equal(raw7Cr1.length, 25, 'raw7 C-r1 must be 25 independent calls');
  assert.equal(new Set(raw7Cr1.map(x => x.probeId)).size, 25);
  assert.ok(raw7Cr1.every(x => x.callCount === 1 && x.hasFurtherInferenceCalls === false));

  // Pilot 1 AS trunks are five-call developmental trajectories.
  const pilotTrunks = instances.filter(x => x.collection === 'pilot1' && x.instanceKind === 'root_lived_trunk');
  assert.equal(pilotTrunks.length, 2);
  assert.ok(pilotTrunks.every(x => x.callCount === 5));
  assert.ok(pilotTrunks.every(x => x.downstreamInferenceCallCount === 4));

  // Pilot ASb is ONE branch inference call. Its package contains five inherited
  // exchanges plus N9, hence six visible pairs but zero downstream branch calls.
  const pilotAsb = instances.filter(x => x.collection === 'pilot1' && x.family === 'ASb');
  assert.equal(pilotAsb.length, 2);
  assert.ok(pilotAsb.every(x => x.instanceKind === 'branch_from_lived_trunk'));
  assert.ok(pilotAsb.every(x => x.parentInstanceUid));
  assert.ok(pilotAsb.every(x => x.inheritedHistoryStatus === 'reconstructed_from_explicit_parent_trunk'));
  assert.ok(pilotAsb.every(x => x.visibleContextExchangePairCount === 6));
  assert.ok(pilotAsb.every(x => x.callCount === 1 && x.hasFurtherInferenceCalls === false));
  assert.ok(pilotAsb.every(x => x.parentTrajectoryCallUids.length === 5));

  const pilotCold = instances.filter(x => x.collection === 'pilot1' && x.family === 'C0');
  assert.equal(pilotCold.length, 8);
  assert.ok(pilotCold.every(x => x.instanceKind === 'root_single_call' && x.callCount === 1));

  console.log('PASS real DAE package-first trajectory census');
  console.log(JSON.stringify({
    instanceCount: census.instanceCount,
    withFurtherInferenceCalls: census.withFurtherInferenceCalls,
    withoutFurtherInferenceCalls: census.withoutFurtherInferenceCalls,
    packageBoundInstances: census.packageBoundInstanceCount,
    raw7CInstances: raw7C.length,
    raw7Cr1Instances: raw7Cr1.length,
    pilotTrunks: pilotTrunks.map(x => ({ instanceUid: x.instanceUid, callCount: x.callCount, firstInputPackageUid: x.firstInputPackageUid })),
    pilotAsb: pilotAsb.map(x => ({ instanceUid: x.instanceUid, parentInstanceUid: x.parentInstanceUid, callCount: x.callCount, visibleContextPairs: x.visibleContextExchangePairCount, firstInputPackageUid: x.firstInputPackageUid })),
    instanceKinds: countBy(instances, 'instanceKind'),
    ancestryTypes: countBy(instances, 'ancestryType'),
  }, null, 2));
}

main();
