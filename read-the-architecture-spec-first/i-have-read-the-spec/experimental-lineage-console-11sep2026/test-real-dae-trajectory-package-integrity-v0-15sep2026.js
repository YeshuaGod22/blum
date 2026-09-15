'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');

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
  assert.ok(integrity, 'trajectory package integrity layer missing');
  assert.equal(integrity.schema, 'blum-dae-trajectory-package-integrity-v0');
  assert.ok(integrity.trunkTransitionCount > 0, 'no lived-trunk transitions tested');
  assert.equal(integrity.branchParentRelationCount, 1708, 'every branch trajectory should receive a parent-relation result');

  const badTransitions = integrity.transitions.filter(x => x.status !== 'verified_exact_extension');
  const materializedParentRelations = integrity.parentRelations.filter(x => x.parentTerminalCallUid);
  const badMaterializedParents = materializedParentRelations.filter(x => x.status !== 'verified_exact_extension');

  // We intentionally print before asserting so a corpus disagreement is diagnostic,
  // not a mystery red badge.
  console.log('TRAJECTORY PACKAGE INTEGRITY CENSUS');
  console.log(JSON.stringify({
    trunkTransitionCount: integrity.trunkTransitionCount,
    trunkTransitionStatuses: integrity.trunkTransitionStatuses,
    nonExactTrunkTransitions: badTransitions.slice(0, 20),
    branchParentRelationCount: integrity.branchParentRelationCount,
    branchParentRelationStatuses: integrity.branchParentRelationStatuses,
    materializedParentRelations: materializedParentRelations.length,
    nonExactMaterializedParents: badMaterializedParents.slice(0, 20),
  }, null, 2));

  assert.equal(badTransitions.length, 0, 'some lived-trunk transitions are not exact package extensions');
  assert.equal(badMaterializedParents.length, 0, 'some materialized branch-parent relations do not match parent terminal package state');

  const trunkInstances = index.instanceStartCensus.instances.filter(x => x.instanceKind === 'root_lived_trunk');
  assert.equal(trunkInstances.length, 42);
  assert.ok(trunkInstances.every(x => x.trunkExtensionStatus === 'verified_all_exact_extensions'));

  const branches = index.instanceStartCensus.instances.filter(x => x.instanceKind === 'branch_from_lived_trunk');
  assert.equal(branches.length, 1708);
  for (const branch of branches) {
    assert.ok(branch.parentRelationVerificationStatus, `branch relation status missing: ${branch.instanceUid}`);
  }

  console.log('PASS real DAE trajectory package integrity');
}

main();
