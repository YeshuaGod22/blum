'use strict';

// Second provenance class for branches whose parent trajectory is not itself
// materialized in the normalized corpus. We do NOT invent a parent call/event.
// Instead, verify the branch input prefix against the frozen parentSnapshot
// extracted mechanically from the branch witness (`sent.slice(0,prefix_len)`).

const Graph = require('./dae-message-lineage-graph-v0-15sep2026.js');

function snapshotHash(messages) {
  return 'sha256:' + Graph.hashHex(messages || []);
}

function branchObservationMap(collections = []) {
  const map = new Map();
  for (const entry of collections || []) {
    const collection = String(entry?.name || entry?.collection || 'unknown');
    for (const observation of (entry?.dataset?.branchObservations || [])) {
      if (!observation?.observationId) continue;
      map.set(String(observation.observationId), { collection, observation });
    }
  }
  return map;
}

function verifySnapshotAgainstCall(graph, call, importedObservation) {
  const snapshot = importedObservation?.parentSnapshot || null;
  if (!snapshot) return { status:'parent_snapshot_missing', proofClass:'unverified' };
  if (snapshot.verificationStatus !== 'verified_from_sent_prefix') {
    return {
      status:'parent_snapshot_unverified',
      proofClass:'unverified',
      verificationStatus:snapshot.verificationStatus || null,
      verificationReason:snapshot.verificationReason || null,
    };
  }
  const prefixLen = Number(snapshot.prefixLen);
  if (!Number.isInteger(prefixLen) || prefixLen < 0) {
    return { status:'parent_snapshot_prefix_len_invalid', proofClass:'unverified', prefixLen:snapshot.prefixLen ?? null };
  }
  const input = graph?.inputPackages?.[call?.inputPackageUid];
  const messages = input?.canonicalPackage?.messages || [];
  if (prefixLen > messages.length) {
    return { status:'parent_snapshot_prefix_len_exceeds_input', proofClass:'unverified', prefixLen, inputMessageCount:messages.length };
  }
  const actualPrefix = messages.slice(0, prefixLen);
  const actualPrefixHash = snapshotHash(actualPrefix);
  const hashMatches = actualPrefixHash === snapshot.contentHash;
  const suffix = messages.slice(prefixLen);
  const exactOneNewUser = suffix.length === 1 && suffix[0]?.role === 'user';
  return {
    status: hashMatches && exactOneNewUser
      ? 'verified_witness_parent_snapshot_extension'
      : hashMatches
        ? 'witness_parent_snapshot_matches_noncanonical_suffix'
        : 'witness_parent_snapshot_hash_mismatch',
    proofClass: hashMatches && exactOneNewUser ? 'frozen_witness_parent_snapshot' : 'unverified',
    parentSnapshotId:snapshot.parentSnapshotId || null,
    declaredParentPrefix:snapshot.declaredParentPrefix || null,
    prefixLen,
    inputMessageCount:messages.length,
    expectedPrefixHash:snapshot.contentHash || null,
    actualPrefixHash,
    hashMatches,
    suffixMessageCount:suffix.length,
    suffixRoles:suffix.map(x => x?.role || null),
    exactlyOneNewUser:exactOneNewUser,
  };
}

function attachWitnessParentSnapshotIntegrity(index, { collections = [] } = {}) {
  const graph = index?.inferencePackageGraph;
  if (!graph?.calls || !graph?.inputPackages) throw new Error('witness_parent_snapshot_integrity_requires_package_graph');
  const observations = branchObservationMap(collections);
  const rows = [];

  for (const call of Object.values(graph.calls)) {
    if (call.sourceKind !== 'raw2_plus_branch') continue;
    const imported = observations.get(String(call.observationId || ''));
    const result = imported
      ? verifySnapshotAgainstCall(graph, call, imported.observation)
      : { status:'imported_branch_observation_missing', proofClass:'unverified' };
    rows.push({
      callUid:call.callUid,
      observationId:call.observationId || null,
      collection:call.collection,
      sourcePath:call.sourcePath,
      trunkKey:call.trunkKey,
      family:call.family,
      replicate:call.replicate,
      probeId:call.probeId,
      forkId:call.forkId,
      inputPackageUid:call.inputPackageUid,
      ...result,
    });
  }

  const statuses = rows.reduce((out, row) => {
    out[row.status] = (out[row.status] || 0) + 1;
    return out;
  }, {});
  const byCallUid = Object.fromEntries(rows.map(row => [row.callUid, row]));
  index.witnessParentSnapshotIntegrity = {
    schema:'blum-dae-witness-parent-snapshot-integrity-v0',
    semantics:{
      proofClass:'Verifies inherited branch prefix from the frozen branch witness only; never materializes or implies a missing parent inference event.',
      verifiedStatus:'verified_witness_parent_snapshot_extension means exact frozen prefix hash plus exactly one new user message in the branch input package.',
    },
    branchCallCount:rows.length,
    statuses,
    verifiedCount:rows.filter(row => row.status === 'verified_witness_parent_snapshot_extension').length,
    rows,
    byCallUid,
  };
  return index;
}

module.exports = {
  snapshotHash,
  branchObservationMap,
  verifySnapshotAgainstCall,
  attachWitnessParentSnapshotIntegrity,
};
