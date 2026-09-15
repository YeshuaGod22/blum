'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-call-outcome-census-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const outcome = index.callOutcomeCensus;
  assert.ok(outcome, 'call outcome census missing');
  assert.equal(outcome.schema, 'blum-dae-call-outcome-census-v0');
  assert.equal(outcome.callCount, index.inferencePackageGraph.callCount);
  assert.equal(outcome.trajectoryCount, index.instanceStartCensus.instanceCount);

  const summedOutcomes = Object.values(outcome.callOutcomeCounts).reduce((a, b) => a + b, 0);
  assert.equal(summedOutcomes, outcome.callCount, 'outcome counts must conserve calls');
  assert.equal(outcome.trajectoriesFullyComplete + outcome.trajectoriesWithIncompleteCalls, outcome.trajectoryCount);

  for (const instance of index.instanceStartCensus.instances) {
    assert.equal(instance.administeredCallCount, instance.callCount);
    const classified = instance.completeCallCount + instance.truncatedCallCount + instance.contextLimitCallCount + instance.apiFailureCallCount + instance.missingOutputCallCount + instance.otherCallCount;
    assert.equal(classified, instance.administeredCallCount, `outcome classification mismatch: ${instance.instanceUid}`);
    assert.equal(instance.hasFurtherCompleteInferenceCalls, instance.downstreamCompleteInferenceCallCount > 0);
    assert.ok(instance.downstreamCompleteInferenceCallCount <= instance.downstreamInferenceCallCount);
  }

  const incomplete = outcome.trajectories.filter(x => x.completeCallCount !== x.administeredCallCount);
  assert.deepEqual(outcome.callOutcomeCounts, { complete: 2658, truncated: 1 });
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].collection, 'raw12');
  assert.equal(incomplete[0].trunkKey, 'H-r1');
  assert.equal(incomplete[0].administeredCallCount, 9);
  assert.equal(incomplete[0].incompleteCalls.length, 1);
  const truncated = incomplete[0].incompleteCalls[0];
  assert.equal(truncated.normalizedOutcome, 'truncated');
  assert.equal(truncated.turn, 5);
  assert.equal(truncated.stopReason, 'max_tokens');
  assert.ok(String(truncated.sourcePath).endsWith('/raw12/H-r1-t5.json') || String(truncated.sourcePath).endsWith('raw12/H-r1-t5.json'));
  assert.ok(truncated.callUid && truncated.inputPackageUid && truncated.outputPackageUid, 'truncated call must remain fully addressable');

  console.log('CALL OUTCOME CENSUS');
  console.log(JSON.stringify({
    callCount: outcome.callCount,
    callOutcomeCounts: outcome.callOutcomeCounts,
    trajectoryCount: outcome.trajectoryCount,
    trajectoriesFullyComplete: outcome.trajectoriesFullyComplete,
    trajectoriesWithIncompleteCalls: outcome.trajectoriesWithIncompleteCalls,
    incompleteSamples: incomplete,
  }, null, 2));

  console.log('PASS real DAE call outcome census');
}

main();
