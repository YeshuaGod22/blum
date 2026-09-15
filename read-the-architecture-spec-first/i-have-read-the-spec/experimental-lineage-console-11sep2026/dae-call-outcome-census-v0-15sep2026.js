'use strict';

// Outcome-aware view over already-identified inference calls.
// Outcome never changes call/package event identity; it is a property of the call.

function normalizeOutcome(call) {
  const raw = String(call?.callOutcome || '').toLowerCase();
  if (raw === 'complete' || raw === 'complete_recorded') return 'complete';
  if (raw === 'truncated') return 'truncated';
  if (raw === 'context_limit') return 'context_limit';
  if (raw === 'api_failure') return 'api_failure';
  if (raw === 'missing_output') return 'missing_output';
  if (raw.startsWith('other:')) return 'other';
  return raw || 'unknown';
}

function callLocator(call, ordinal) {
  return {
    callUid: call.callUid,
    ordinal,
    normalizedOutcome: call.normalizedOutcome,
    rawOutcome: call.callOutcome || null,
    stopReason: call.stopReason ?? null,
    sourcePath: call.sourcePath || null,
    collection: call.collection || null,
    trunkKey: call.trunkKey || null,
    turn: call.turn ?? null,
    probeId: call.probeId || null,
    inputPackageUid: call.inputPackageUid,
    outputPackageUid: call.outputPackageUid,
  };
}

function attachCallOutcomeCensus(index) {
  const graph = index?.inferencePackageGraph;
  const census = index?.instanceStartCensus;
  if (!graph?.calls || !census?.instances) throw new Error('call_outcome_census_requires_package_graph_and_trajectories');

  const calls = graph.calls;
  const overall = {};
  for (const call of Object.values(calls)) {
    call.normalizedOutcome = normalizeOutcome(call);
    overall[call.normalizedOutcome] = (overall[call.normalizedOutcome] || 0) + 1;
  }

  const trajectoryRows = [];
  for (const instance of census.instances) {
    const owned = (instance.ownedCallUids || []).map(uid => calls[uid]).filter(Boolean);
    const byOutcome = {};
    for (const call of owned) byOutcome[call.normalizedOutcome] = (byOutcome[call.normalizedOutcome] || 0) + 1;

    const administeredCallCount = owned.length;
    const completeCallCount = byOutcome.complete || 0;
    const truncatedCallCount = byOutcome.truncated || 0;
    const contextLimitCallCount = byOutcome.context_limit || 0;
    const apiFailureCallCount = byOutcome.api_failure || 0;
    const missingOutputCallCount = byOutcome.missing_output || 0;
    const otherCallCount = administeredCallCount - completeCallCount - truncatedCallCount - contextLimitCallCount - apiFailureCallCount - missingOutputCallCount;

    const completeOrdinals = owned.map((call, ordinal) => ({ call, ordinal })).filter(x => x.call.normalizedOutcome === 'complete').map(x => x.ordinal);
    const incompleteCalls = owned.map((call, ordinal) => ({ call, ordinal })).filter(x => x.call.normalizedOutcome !== 'complete').map(x => callLocator(x.call, x.ordinal));
    const firstCallComplete = owned[0]?.normalizedOutcome === 'complete';
    const terminalCallComplete = owned.at(-1)?.normalizedOutcome === 'complete';
    const completeAfterFirstCount = owned.slice(1).filter(call => call.normalizedOutcome === 'complete').length;

    Object.assign(instance, {
      administeredCallCount,
      completeCallCount,
      truncatedCallCount,
      contextLimitCallCount,
      apiFailureCallCount,
      missingOutputCallCount,
      otherCallCount,
      firstCallComplete,
      terminalCallComplete,
      hasFurtherCompleteInferenceCalls: completeAfterFirstCount > 0,
      downstreamCompleteInferenceCallCount: completeAfterFirstCount,
      callOutcomeCounts: byOutcome,
      incompleteCallUids: incompleteCalls.map(x => x.callUid),
    });

    trajectoryRows.push({
      instanceUid: instance.instanceUid,
      collection: instance.collection || null,
      instanceKind: instance.instanceKind || null,
      ancestryType: instance.ancestryType || null,
      family: instance.family || null,
      replicate: instance.replicate ?? null,
      trunkKey: instance.trunkKey || null,
      administeredCallCount,
      completeCallCount,
      truncatedCallCount,
      contextLimitCallCount,
      apiFailureCallCount,
      missingOutputCallCount,
      otherCallCount,
      firstCallComplete,
      terminalCallComplete,
      downstreamCompleteInferenceCallCount: completeAfterFirstCount,
      completeCallOrdinals: completeOrdinals,
      incompleteCalls,
      callOutcomeCounts: byOutcome,
    });
  }

  const trajectoriesWithIncompleteCalls = trajectoryRows.filter(row => row.completeCallCount !== row.administeredCallCount).length;
  const trajectoriesFullyComplete = trajectoryRows.length - trajectoriesWithIncompleteCalls;

  index.callOutcomeCensus = {
    schema: 'blum-dae-call-outcome-census-v0',
    semantics: {
      administered: 'all identified inference call events regardless of outcome',
      complete: 'normal completion according to preserved callOutcome; Pilot-1 recorded outputs normalize to complete',
      incomplete: 'truncated/context-limit/API-failure/missing-output/other/unknown remain distinct call events',
    },
    callCount: Object.keys(calls).length,
    callOutcomeCounts: overall,
    trajectoryCount: trajectoryRows.length,
    trajectoriesFullyComplete,
    trajectoriesWithIncompleteCalls,
    trajectories: trajectoryRows,
  };
  return index;
}

module.exports = { normalizeOutcome, callLocator, attachCallOutcomeCensus };
