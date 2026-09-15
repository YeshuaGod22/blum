'use strict';

// DAE TRAJECTORY <-> INFERENCE PACKAGE BINDING v0 — 15 Sep 2026
//
// A trajectory's depth is the number of inference CALLS it owns.
// Inherited conversation/history inside a branch input package is NOT counted as
// downstream calls on the branch trajectory. That history is content inside the
// branch's first input package and is linked separately to its parent trajectory.

function bindTrajectoryPackages(index) {
  const census = index?.instanceStartCensus;
  const graph = index?.inferencePackageGraph;
  if (!census?.instances || !graph?.calls) throw new Error('trajectory_package_binding_requires_census_and_package_graph');

  const calls = Object.values(graph.calls);
  const byInstance = new Map();
  for (const call of calls) {
    if (!byInstance.has(call.instanceUidHint)) byInstance.set(call.instanceUidHint, []);
    byInstance.get(call.instanceUidHint).push(call);
  }
  for (const group of byInstance.values()) {
    group.sort((a, b) => Number(a.trajectoryOrdinal || 0) - Number(b.trajectoryOrdinal || 0) || String(a.callUid).localeCompare(String(b.callUid)));
  }

  let bound = 0;
  let withFurtherCalls = 0;
  for (const instance of census.instances) {
    const owned = (byInstance.get(instance.instanceUid) || []).slice();
    const parentCalls = instance.parentInstanceUid ? (byInstance.get(instance.parentInstanceUid) || []).slice() : [];

    // Preserve the older transcript-derived values explicitly as visible-context
    // measurements. They answer a different question from inference-call depth.
    instance.visibleContextExchangePairCount = instance.ioPairCount;
    instance.visibleContextHasFurtherPairs = instance.hasFurtherInputOutputPairs;
    instance.visibleContextDownstreamPairCount = instance.downstreamInputOutputPairCount;

    instance.ownedCallUids = owned.map(x => x.callUid);
    instance.callUids = instance.ownedCallUids.slice();
    instance.parentTrajectoryCallUids = parentCalls.map(x => x.callUid);
    instance.callCount = owned.length;
    instance.firstCallUid = owned[0]?.callUid || null;
    instance.firstInputPackageUid = owned[0]?.inputPackageUid || null;
    instance.firstOutputPackageUid = owned[0]?.outputPackageUid || null;
    instance.terminalCallUid = owned.at(-1)?.callUid || null;
    instance.terminalInputPackageUid = owned.at(-1)?.inputPackageUid || null;
    instance.terminalOutputPackageUid = owned.at(-1)?.outputPackageUid || null;
    instance.hasFurtherInferenceCalls = owned.length > 1;
    instance.downstreamInferenceCallCount = Math.max(0, owned.length - 1);
    instance.packageBindingStatus = owned.length ? 'bound' : 'unbound';
    if (owned.length) bound += 1;
    if (owned.length > 1) withFurtherCalls += 1;
  }

  census.packageBoundInstanceCount = bound;
  census.packageUnboundInstanceCount = census.instances.length - bound;
  census.withFurtherInferenceCalls = withFurtherCalls;
  census.withoutFurtherInferenceCalls = census.instances.length - withFurtherCalls;
  census.depthSemantics = {
    primary: 'callCount/downstreamInferenceCallCount count administered inference calls owned by the trajectory',
    inheritedContext: 'prior user/assistant history in a branch is contained inside the branch input package and is not counted as branch call depth',
    legacyVisibleContext: 'visibleContextExchangePairCount describes user/assistant-shaped pairs visible inside reconstructed context, including inherited history',
  };
  return index;
}

module.exports = { bindTrajectoryPackages };
