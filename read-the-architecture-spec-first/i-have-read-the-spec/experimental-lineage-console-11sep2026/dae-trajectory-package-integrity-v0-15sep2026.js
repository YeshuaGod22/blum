'use strict';

// Verifies trajectory topology against inference-package content rather than
// trusting turn order / trunk labels alone. Parent lineage can be proven by
// either a materialized parent trajectory or, when that event is absent from
// the historical corpus, the exact frozen parent-prefix snapshot in the branch
// witness. The latter never fabricates a missing parent call.

function normalizedMessage(role, content) {
  return { role: String(role || ''), content: String(content ?? '') };
}
function equalMessage(a, b) {
  return String(a?.role || '') === String(b?.role || '') && String(a?.content ?? '') === String(b?.content ?? '');
}
function prefixMatches(actual, expected) {
  if ((actual || []).length < (expected || []).length) return false;
  for (let i = 0; i < expected.length; i += 1) if (!equalMessage(actual[i], expected[i])) return false;
  return true;
}
function expectedStateAfterCall(inputPackage, outputPackage) {
  return [
    ...(inputPackage?.canonicalPackage?.messages || []).map(m => normalizedMessage(m.role, m.content)),
    normalizedMessage('assistant', outputPackage?.content ?? ''),
  ];
}
function classifyExtension(actualMessages, expectedPrefix) {
  const actual = (actualMessages || []).map(m => normalizedMessage(m.role, m.content));
  const prefixOk = prefixMatches(actual, expectedPrefix);
  const suffix = prefixOk ? actual.slice(expectedPrefix.length) : [];
  const exactlyOneNewUser = prefixOk && suffix.length === 1 && suffix[0].role === 'user';
  return {
    prefixMatches: prefixOk,
    suffixMessageCount: suffix.length,
    suffixRoles: suffix.map(x => x.role),
    exactlyOneNewUser,
    status: exactlyOneNewUser ? 'verified_exact_extension' : prefixOk ? 'prefix_matches_noncanonical_suffix' : 'prefix_mismatch',
  };
}

function nestedCount(rows, outerKey, innerKey) {
  const out = {};
  for (const row of rows) {
    const outer = String(row?.[outerKey] ?? '<missing>');
    const inner = String(row?.[innerKey] ?? '<missing>');
    if (!out[outer]) out[outer] = {};
    out[outer][inner] = (out[outer][inner] || 0) + 1;
  }
  return out;
}

function attachTrajectoryPackageIntegrity(index) {
  const census = index?.instanceStartCensus;
  const pkgGraph = index?.inferencePackageGraph;
  if (!census?.instances || !pkgGraph?.calls) throw new Error('trajectory_integrity_requires_package_graph_and_census');

  const calls = pkgGraph.calls;
  const inputs = pkgGraph.inputPackages;
  const outputs = pkgGraph.outputPackages;
  const snapshotProofByCall = index?.witnessParentSnapshotIntegrity?.byCallUid || {};
  const instanceByUid = new Map(census.instances.map(x => [x.instanceUid, x]));
  const transitions = [];
  const parentRelations = [];

  for (const instance of census.instances) {
    if (instance.instanceKind === 'root_lived_trunk') {
      const owned = (instance.ownedCallUids || []).map(uid => calls[uid]).filter(Boolean);
      const statuses = [];
      for (let i = 1; i < owned.length; i += 1) {
        const prev = owned[i - 1];
        const current = owned[i];
        const prevInput = inputs[prev.inputPackageUid];
        const prevOutput = outputs[prev.outputPackageUid];
        const currentInput = inputs[current.inputPackageUid];
        const expectedPrefix = expectedStateAfterCall(prevInput, prevOutput);
        const result = classifyExtension(currentInput?.canonicalPackage?.messages || [], expectedPrefix);
        const systemPromptStable = (prevInput?.canonicalPackage?.systemPrompt ?? null) === (currentInput?.canonicalPackage?.systemPrompt ?? null);
        const row = {
          trajectoryUid: instance.instanceUid,
          collection: instance.collection,
          trunkKey: instance.trunkKey,
          fromCallUid: prev.callUid,
          toCallUid: current.callUid,
          fromTurn: prev.turn ?? null,
          toTurn: current.turn ?? null,
          proofClass:'materialized_parent_trajectory',
          systemPromptStable,
          ...result,
        };
        transitions.push(row);
        statuses.push(result.status);
      }
      instance.trunkTransitionCount = transitions.filter(x => x.trajectoryUid === instance.instanceUid).length;
      instance.trunkExtensionStatus = statuses.length === 0
        ? 'single_call_no_transition'
        : statuses.every(x => x === 'verified_exact_extension')
          ? 'verified_all_exact_extensions'
          : statuses.some(x => x === 'prefix_mismatch')
            ? 'extension_mismatch_present'
            : 'noncanonical_suffix_present';
    }

    if (instance.instanceKind === 'branch_from_lived_trunk') {
      const ownedCall = calls[(instance.ownedCallUids || [])[0]] || null;
      const parent = instance.parentInstanceUid ? instanceByUid.get(instance.parentInstanceUid) || null : null;
      const parentTerminalCall = parent ? calls[parent.terminalCallUid] || null : null;
      let relation;
      if (!ownedCall) {
        relation = { status:'branch_call_missing', proofClass:'unverified' };
      } else if (!parent || !parentTerminalCall) {
        const snapshotProof = snapshotProofByCall[ownedCall.callUid] || null;
        if (snapshotProof?.status === 'verified_witness_parent_snapshot_extension') {
          relation = {
            status:'verified_witness_parent_snapshot_extension',
            proofClass:'frozen_witness_parent_snapshot',
            materializedParentTrajectory:false,
            reason:!instance.parentInstanceUid ? 'parent_event_absent_snapshot_verified' : 'materialized_parent_unavailable_snapshot_verified',
            parentSnapshotId:snapshotProof.parentSnapshotId || null,
            declaredParentPrefix:snapshotProof.declaredParentPrefix || null,
            expectedPrefixHash:snapshotProof.expectedPrefixHash || null,
            actualPrefixHash:snapshotProof.actualPrefixHash || null,
            prefixLen:snapshotProof.prefixLen ?? null,
            exactlyOneNewUser:snapshotProof.exactlyOneNewUser === true,
          };
        } else {
          relation = {
            status:'parent_lineage_unverified',
            proofClass:'unverified',
            materializedParentTrajectory:false,
            reason:!instance.parentInstanceUid
              ? 'no_parent_instance_uid_materialized'
              : !parent
                ? 'parent_instance_uid_not_present_in_census'
                : 'parent_terminal_call_not_present_in_package_graph',
            snapshotVerificationStatus:snapshotProof?.status || 'snapshot_proof_missing',
          };
        }
      } else {
        const parentInput = inputs[parentTerminalCall.inputPackageUid];
        const parentOutput = outputs[parentTerminalCall.outputPackageUid];
        const branchInput = inputs[ownedCall.inputPackageUid];
        const expectedPrefix = expectedStateAfterCall(parentInput, parentOutput);
        relation = classifyExtension(branchInput?.canonicalPackage?.messages || [], expectedPrefix);
        relation.proofClass = 'materialized_parent_trajectory';
        relation.materializedParentTrajectory = true;
        relation.systemPromptStable = (parentInput?.canonicalPackage?.systemPrompt ?? null) === (branchInput?.canonicalPackage?.systemPrompt ?? null);
      }
      instance.parentRelationVerificationStatus = relation.status;
      instance.parentRelationProofClass = relation.proofClass || null;
      instance.parentRelationVerificationReason = relation.reason || null;
      parentRelations.push({
        trajectoryUid: instance.instanceUid,
        parentTrajectoryUid: instance.parentInstanceUid || null,
        collection: instance.collection,
        family: instance.family || null,
        replicate: instance.replicate ?? null,
        trunkKey: instance.trunkKey,
        probeId: instance.probeId || null,
        forkId: instance.forkId || null,
        sourcePaths: instance.sourcePaths || [],
        branchCallUid: ownedCall?.callUid || null,
        branchInputPackageUid: ownedCall?.inputPackageUid || null,
        parentTerminalCallUid: parentTerminalCall?.callUid || null,
        parentTerminalOutputPackageUid: parentTerminalCall?.outputPackageUid || null,
        ...relation,
      });
    }
  }

  const countByStatus = rows => rows.reduce((out, row) => {
    out[row.status] = (out[row.status] || 0) + 1;
    return out;
  }, {});
  const countByProof = rows => rows.reduce((out, row) => {
    const key = row.proofClass || '<missing>';
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});

  const unverified = parentRelations.filter(x => !['verified_exact_extension','verified_witness_parent_snapshot_extension'].includes(x.status));
  const snapshotVerified = parentRelations.filter(x => x.status === 'verified_witness_parent_snapshot_extension');
  const materializedVerified = parentRelations.filter(x => x.status === 'verified_exact_extension');
  index.trajectoryPackageIntegrity = {
    schema:'blum-dae-trajectory-package-integrity-v0',
    semantics:{
      materialized_parent_trajectory:'branch prefix proven against the terminal state of an addressable parent inference trajectory',
      frozen_witness_parent_snapshot:'parent event is not materialized; branch prefix proven against the immutable parent snapshot embedded in the branch witness; this does not imply a parent call UID',
    },
    trunkTransitionCount:transitions.length,
    trunkTransitionStatuses:countByStatus(transitions),
    branchParentRelationCount:parentRelations.length,
    branchParentRelationStatuses:countByStatus(parentRelations),
    branchParentRelationProofClasses:countByProof(parentRelations),
    branchParentRelationStatusesByCollection:nestedCount(parentRelations,'collection','status'),
    materializedParentVerifiedCount:materializedVerified.length,
    witnessSnapshotParentVerifiedCount:snapshotVerified.length,
    unverifiedParentCount:unverified.length,
    unverifiedParentReasons:countByStatus(unverified.map(row => ({status:row.reason || '<missing>'}))),
    unverifiedParentsByCollection:unverified.reduce((out,row) => {
      const key=String(row.collection || '<missing>'); out[key]=(out[key]||0)+1; return out;
    },{}),
    transitions,
    parentRelations,
  };
  return index;
}

module.exports={equalMessage,prefixMatches,expectedStateAfterCall,classifyExtension,nestedCount,attachTrajectoryPackageIntegrity};
