'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Query = require('./dae-first-treatment-prompts-v0-15sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-first-treatment-prompts-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const rows = Query.queryFirstTreatmentPrompts(index);
  const report = Query.summary(rows);
  const resolved = rows.filter(x => x.status === 'resolved');
  const conflicts = rows.filter(x => x.status === 'conflict');
  const unresolved = rows.filter(x => x.status === 'unresolved');
  const notApplicable = rows.filter(x => x.status === 'not_applicable');
  const rawResolved = resolved.filter(x => x.developmentalOriginClass === 'verified_lived_origin');
  const pilotResolved = resolved.filter(x => x.developmentalOriginClass === 'verified_pilot_parent_trajectory_origin');

  assert.ok(rawResolved.length > 0, 'no raw lived treatment prompts resolved');
  assert.equal(pilotResolved.length, 2, 'both Pilot ASb treatment origins should resolve from explicit verified parent trajectories');
  assert.equal(conflicts.length, 0, 'verified treatment instances must not contain conflicting origins');
  assert.ok(notApplicable.length > 0, 'expected no-lived-parent-by-design groups');
  assert.equal(unresolved.length, 0, 'no treatment-origin group should remain unresolved after package-first Pilot lineage recovery');

  for (const row of rawResolved) {
    assert.ok(row.firstPromptMessageId, `missing firstPromptMessageId: ${row.trunkKey}`);
    assert.ok(row.firstPrompt, `missing firstPrompt: ${row.trunkKey}`);
    assert.ok(row.parentSnapshotId, `missing parentSnapshotId: ${row.trunkKey}`);
    assert.ok(row.evidenceObservationCount > 0, `missing evidence count: ${row.trunkKey}`);
    assert.equal(row.provenanceRoute, 'verified_raw_lived_prefix_message');
  }

  for (const row of pilotResolved) {
    assert.equal(row.collection, 'pilot1');
    assert.ok(row.firstPromptCallUid, `Pilot origin missing first call UID: ${row.trunkKey}`);
    assert.ok(row.firstPromptInputPackageUid, `Pilot origin missing first input package UID: ${row.trunkKey}`);
    assert.ok(row.firstPromptInputSectionUid, `Pilot origin missing first user section UID: ${row.trunkKey}`);
    assert.ok(row.parentTrajectoryUid, `Pilot origin missing parent trajectory UID: ${row.trunkKey}`);
    assert.ok(row.branchTrajectoryUid, `Pilot origin missing branch trajectory UID: ${row.trunkKey}`);
    assert.ok(row.firstPrompt.startsWith('Hi Claude!'), `Pilot first prompt changed unexpectedly: ${row.trunkKey}`);
    assert.equal(row.provenanceRoute, 'package_first_explicit_parent_trajectory');
    const parent = index.instanceStartCensus.instances.find(x => x.instanceUid === row.parentTrajectoryUid);
    const branch = index.instanceStartCensus.instances.find(x => x.instanceUid === row.branchTrajectoryUid);
    assert.ok(parent && branch);
    assert.equal(branch.parentInstanceUid, parent.instanceUid);
    assert.equal(branch.parentRelationVerificationStatus, 'verified_exact_extension');
    assert.equal(branch.parentRelationProofClass, 'materialized_parent_trajectory');
    assert.equal(parent.firstCallUid, row.firstPromptCallUid);
    assert.equal(parent.firstInputPackageUid, row.firstPromptInputPackageUid);
  }

  for (const row of notApplicable) {
    assert.equal(row.developmentalOriginClass, 'no_lived_parent_by_design');
    assert.ok(['resolved', 'multiple'].includes(row.firstAdministeredInput?.status), `cold group lacks recoverable administered input: ${row.collection}/${row.trunkKey}`);
  }

  const asTrunk1 = rawResolved.find(x => x.trunkKey === 'AS-trunk1');
  assert.ok(asTrunk1, 'AS-trunk1 should resolve from verified lived-prefix evidence');
  assert.ok(asTrunk1.firstPrompt.startsWith('Hi Claude!'), 'AS-trunk1 first treatment prompt changed unexpectedly');

  console.log('PASS real DAE treatment-origin resolution census');
  console.log(JSON.stringify({
    ...report,
    resolved: resolved.length,
    rawVerifiedOrigins: rawResolved.length,
    pilotPackageVerifiedOrigins: pilotResolved.length,
    notApplicable: notApplicable.length,
    unresolved: unresolved.length,
    conflicts: conflicts.length,
    notApplicableByAncestry: Object.fromEntries([...new Set(notApplicable.flatMap(x => x.ancestryTypes || []))].sort().map(type => [type, notApplicable.filter(x => (x.ancestryTypes || []).includes(type)).length])),
    pilotOrigins: pilotResolved.map(x => ({
      trunkKey:x.trunkKey,
      family:x.family,
      replicate:x.replicate,
      parentTrajectoryUid:x.parentTrajectoryUid,
      branchTrajectoryUid:x.branchTrajectoryUid,
      firstPromptCallUid:x.firstPromptCallUid,
      firstPromptInputPackageUid:x.firstPromptInputPackageUid,
      firstPromptInputSectionUid:x.firstPromptInputSectionUid,
    })),
  }, null, 2));
}

main();
