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

  // Print census before pinning any outcome-specific counts. The point of this
  // first run is to expose the actual corpus rather than encode expectations.
  console.log('CALL OUTCOME CENSUS');
  console.log(JSON.stringify({
    callCount: outcome.callCount,
    callOutcomeCounts: outcome.callOutcomeCounts,
    trajectoryCount: outcome.trajectoryCount,
    trajectoriesFullyComplete: outcome.trajectoriesFullyComplete,
    trajectoriesWithIncompleteCalls: outcome.trajectoriesWithIncompleteCalls,
    incompleteSamples: outcome.trajectories.filter(x => x.completeCallCount !== x.administeredCallCount).slice(0, 30),
  }, null, 2));

  console.log('PASS real DAE call outcome census');
}

main();
