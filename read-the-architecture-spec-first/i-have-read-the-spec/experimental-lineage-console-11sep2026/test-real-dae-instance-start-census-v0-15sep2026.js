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
  assert.equal(census.missingFirstInput, 0, 'every instance must expose a first input');

  const instances = census.instances;
  const ids = new Set(instances.map(x => x.instanceUid));
  assert.equal(ids.size, instances.length, 'instance UIDs must be unique');

  for (const instance of instances) {
    assert.ok(instance.firstInput, `first input missing: ${instance.instanceUid}`);
    assert.equal(instance.hasFurtherInputOutputPairs, instance.downstreamInputOutputPairCount > 0);
    assert.equal(instance.downstreamInputOutputPairCount, Math.max(0, instance.ioPairCount - 1));
  }

  // The core correction: C-r1 is a replicate grouping across independent calls,
  // not one instance containing 25 questions. raw7 therefore has 250 C instances
  // and C-r1 has 25 distinct root instances.
  const raw7C = instances.filter(x => x.collection === 'raw7' && x.family === 'C' && x.instanceKind === 'root_single_call');
  assert.equal(raw7C.length, 250, 'raw7 C must be 250 independent model instances');
  const raw7Cr1 = raw7C.filter(x => Number(x.replicate) === 1);
  assert.equal(raw7Cr1.length, 25, 'raw7 C-r1 must be 25 independent model instances');
  assert.equal(new Set(raw7Cr1.map(x => x.instanceUid)).size, 25);
  assert.equal(new Set(raw7Cr1.map(x => x.probeId)).size, 25, 'raw7 C-r1 should cover 25 distinct battery items');
  assert.ok(raw7Cr1.every(x => x.ioPairCount === 1 && x.hasFurtherInputOutputPairs === false), 'raw7 C-r1 cold calls should be one-turn instances');

  // Pilot 1 has two five-turn AS developmental trunks.
  const pilotTrunks = instances.filter(x => x.collection === 'pilot1' && x.instanceKind === 'root_lived_trunk');
  assert.equal(pilotTrunks.length, 2, 'Pilot 1 should expose two AS trunk instances');
  assert.ok(pilotTrunks.every(x => x.ioPairCount === 5));
  assert.ok(pilotTrunks.every(x => x.downstreamInputOutputPairCount === 4));

  // The two ASb N9 files are not first-turn roots. record.json explicitly links
  // them to AS-r1/r2 parent trunks, so their reconstructed trajectories contain
  // the five inherited trunk pairs plus the branch pair.
  const pilotAsb = instances.filter(x => x.collection === 'pilot1' && x.family === 'ASb');
  assert.equal(pilotAsb.length, 2, 'Pilot 1 should expose two ASb branch instances');
  assert.ok(pilotAsb.every(x => x.instanceKind === 'branch_from_lived_trunk'));
  assert.ok(pilotAsb.every(x => x.parentInstanceUid));
  assert.ok(pilotAsb.every(x => x.inheritedHistoryStatus === 'reconstructed_from_explicit_parent_trunk'));
  assert.ok(pilotAsb.every(x => x.ioPairCount === 6));
  assert.ok(pilotAsb.every(x => x.downstreamInputOutputPairCount === 5));

  // Pilot 1 cold files are independent one-turn instances too.
  const pilotCold = instances.filter(x => x.collection === 'pilot1' && x.family === 'C0');
  assert.equal(pilotCold.length, 8, 'Pilot 1 C0 should expose eight independent cold instances');
  assert.ok(pilotCold.every(x => x.instanceKind === 'root_single_call'));
  assert.ok(pilotCold.every(x => x.ioPairCount === 1));

  console.log('PASS real DAE instance-start census');
  console.log(JSON.stringify({
    ...censusSummary(census),
    raw7CInstances: raw7C.length,
    raw7Cr1Instances: raw7Cr1.length,
    pilotTrunks: pilotTrunks.map(x => ({ instanceUid: x.instanceUid, firstInputPreview: x.firstInput.slice(0, 140), ioPairCount: x.ioPairCount })),
    pilotAsb: pilotAsb.map(x => ({ instanceUid: x.instanceUid, parentInstanceUid: x.parentInstanceUid, firstInputPreview: x.firstInput.slice(0, 140), ioPairCount: x.ioPairCount })),
    instanceKinds: countBy(instances, 'instanceKind'),
    ancestryTypes: countBy(instances, 'ancestryType'),
  }, null, 2));
}

function censusSummary(census) {
  return {
    instanceCount: census.instanceCount,
    withFurtherInputOutputPairs: census.withFurtherInputOutputPairs,
    withoutFurtherInputOutputPairs: census.withoutFurtherInputOutputPairs,
    missingFirstInput: census.missingFirstInput,
  };
}

main();
