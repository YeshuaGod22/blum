'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');

function countBy(rows, field) {
  return rows.reduce((out, row) => {
    const key = String(row?.[field] ?? '<missing>');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-trajectory-package-integrity-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const integrity = index.trajectoryPackageIntegrity;
  const witness = index.witnessParentSnapshotIntegrity;
  assert.ok(integrity, 'trajectory package integrity layer missing');
  assert.ok(witness, 'witness parent snapshot integrity layer missing');
  assert.equal(integrity.schema, 'blum-dae-trajectory-package-integrity-v0');
  assert.equal(witness.schema, 'blum-dae-witness-parent-snapshot-integrity-v0');
  assert.equal(integrity.branchParentRelationCount, 1708, 'every branch trajectory should receive a parent-relation result');
  assert.equal(witness.branchCallCount, 1706, 'all raw2+ branch calls should receive snapshot verification');

  const badTransitions = integrity.transitions.filter(x => x.status !== 'verified_exact_extension');
  const materialized = integrity.parentRelations.filter(x => x.proofClass === 'materialized_parent_trajectory');
  const snapshot = integrity.parentRelations.filter(x => x.proofClass === 'frozen_witness_parent_snapshot');
  const unverified = integrity.parentRelations.filter(x => x.proofClass === 'unverified');
  const badMaterialized = materialized.filter(x => x.status !== 'verified_exact_extension');
  const badSnapshot = snapshot.filter(x => x.status !== 'verified_witness_parent_snapshot_extension');

  console.log('TRAJECTORY PACKAGE INTEGRITY CENSUS');
  console.log(JSON.stringify({
    trunkTransitionCount: integrity.trunkTransitionCount,
    trunkTransitionStatuses: integrity.trunkTransitionStatuses,
    nonExactTrunkTransitions: badTransitions.slice(0, 20),
    branchParentRelationCount: integrity.branchParentRelationCount,
    branchParentRelationStatuses: integrity.branchParentRelationStatuses,
    branchParentRelationProofClasses: integrity.branchParentRelationProofClasses,
    branchParentRelationStatusesByCollection: integrity.branchParentRelationStatusesByCollection,
    materializedParentVerifiedCount: integrity.materializedParentVerifiedCount,
    witnessSnapshotParentVerifiedCount: integrity.witnessSnapshotParentVerifiedCount,
    unverifiedParentCount: integrity.unverifiedParentCount,
    rawBranchSnapshotStatuses: witness.statuses,
    unverifiedByCollection: countBy(unverified, 'collection'),
    unverifiedByReason: countBy(unverified, 'reason'),
    unverifiedSample: unverified.slice(0, 20),
  }, null, 2));

  assert.equal(badTransitions.length, 0, 'some lived-trunk transitions are not exact package extensions');
  assert.equal(materialized.length, 1442, 'materialized-parent proof census changed');
  assert.equal(snapshot.length, 266, 'frozen-snapshot proof census changed');
  assert.equal(badMaterialized.length, 0, 'some materialized branch-parent relations do not match parent terminal package state');
  assert.equal(badSnapshot.length, 0, 'some snapshot-proven branch relations do not exactly extend their frozen parent prefix');
  assert.equal(unverified.length, 0, 'every branch relation must be positively verified by a documented proof class');
  assert.equal(integrity.materializedParentVerifiedCount, 1442);
  assert.equal(integrity.witnessSnapshotParentVerifiedCount, 266);
  assert.equal(integrity.unverifiedParentCount, 0);

  const trunkInstances = index.instanceStartCensus.instances.filter(x => x.instanceKind === 'root_lived_trunk');
  assert.equal(trunkInstances.length, 42);
  assert.ok(trunkInstances.every(x => x.trunkExtensionStatus === 'verified_all_exact_extensions'));

  const branches = index.instanceStartCensus.instances.filter(x => x.instanceKind === 'branch_from_lived_trunk');
  assert.equal(branches.length, 1708);
  assert.ok(branches.every(branch => ['materialized_parent_trajectory','frozen_witness_parent_snapshot'].includes(branch.parentRelationProofClass)), 'every branch trajectory needs an explicit positive lineage proof class');

  console.log('PASS real DAE trajectory package integrity');
}

main();
