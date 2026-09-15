'use strict';

// DAE FIRST TREATMENT PROMPTS v0 — 15 Sep 2026
//
// Treatment origin is resolved only from verified lineage evidence. Raw2+
// branches use verified lived-prefix message evidence. Pilot-1 may use its
// explicit package-first parent trajectory when that parent edge is verified.
// Reused labels and matching strings are never enough.

const Graph = require('./dae-message-lineage-graph-v0-15sep2026.js');

function livedPrefixEligible(row) {
  return row?.ancestryType === 'lived_trunk_branch'
    && row?.parentVerificationStatus === 'verified_from_sent_prefix'
    && Number.isInteger(row?.parentPrefixLen)
    && row.parentPrefixLen > 0
    && Boolean(row?.trunkKey)
    && Boolean(row?.collection)
    && Boolean(row?.treatmentInstanceId);
}

function firstUserInVerifiedPrefix(index, row) {
  const nodes = index?.messageGraph?.nodes || {};
  const prefixIds = (row.modelVisibleMessageIds || []).slice(0, row.parentPrefixLen);
  for (const messageUid of prefixIds) {
    const node = nodes[messageUid];
    if (node?.role === 'user') return node;
  }
  return null;
}

function firstAdministeredInput(index, group) {
  const nodes = index?.messageGraph?.nodes || {};
  const candidates = [];
  for (const row of group || []) {
    const firstUserId = (row.modelVisibleMessageIds || []).find(id => nodes[id]?.role === 'user');
    if (!firstUserId) continue;
    const node = nodes[firstUserId];
    candidates.push({ messageUid: firstUserId, content: node.content, contentHash: node.contentHash, observationId: row.observationId });
  }
  const byUid = new Map(candidates.map(x => [x.messageUid, x]));
  const unique = [...byUid.values()].sort((a, b) => a.messageUid.localeCompare(b.messageUid));
  if (!unique.length) return { status: 'missing' };
  if (unique.length === 1) return { status: 'resolved', ...unique[0] };
  return { status: 'multiple', candidates: unique };
}

function unresolvedGroupingKey(row) {
  return `unresolved::${row?.collection || '<missing>'}::${row?.trunkKey || '<missing>'}`;
}

function classifyOriginGroup(group) {
  const ancestryTypes = [...new Set((group || []).map(r => r.ancestryType || null))].sort();
  const statuses = [...new Set((group || []).map(r => r.parentVerificationStatus || null))].sort();

  const onlyCold = ancestryTypes.length > 0 && ancestryTypes.every(x => x === 'cold_no_lived_parent' || x === 'cold_schema_no_lived_parent');
  if (onlyCold) return {
    developmentalOriginStatus: 'not_applicable',
    developmentalOriginClass: 'no_lived_parent_by_design',
    reason: 'cold_administration_has_no_lived_developmental_parent',
  };

  if (ancestryTypes.some(x => x === 'pilot1_lived_trunk' || x === 'pilot1_lived_trunk_branch')) return {
    developmentalOriginStatus: 'unresolved',
    developmentalOriginClass: 'incomplete_historical_context',
    reason: 'pilot1_message_projection_lacks_complete_lived_prefix_and_no_verified_package_parent_was_resolved',
  };

  if (ancestryTypes.includes('lived_trunk_branch')) return {
    developmentalOriginStatus: 'unresolved',
    developmentalOriginClass: 'lineage_unverified',
    reason: 'lived_branch_present_but_complete_verified_prefix_unavailable',
    parentVerificationStatuses: statuses,
  };

  return {
    developmentalOriginStatus: 'unresolved',
    developmentalOriginClass: 'other_unresolved',
    reason: 'no_verified_lived_prefix_in_index',
    parentVerificationStatuses: statuses,
  };
}

function pilotPackageOrigin(index, group) {
  const exemplar = group?.[0] || {};
  if (exemplar.collection !== 'pilot1') return null;
  const ancestryTypes = [...new Set((group || []).map(r => r.ancestryType || null))];
  if (!ancestryTypes.includes('pilot1_lived_trunk_branch')) return null;
  const census = index?.instanceStartCensus?.instances || [];
  const graph = index?.inferencePackageGraph;
  if (!graph?.calls || !graph?.inputPackages || !graph?.sections) return null;

  const sourcePaths = new Set((group || []).map(r => r.sourcePath).filter(Boolean));
  const branchCandidates = census.filter(instance => {
    if (instance.collection !== 'pilot1' || instance.instanceKind !== 'branch_from_lived_trunk') return false;
    if ((instance.family || null) !== (exemplar.family || null)) return false;
    if ((instance.replicate ?? null) !== (exemplar.replicate ?? null)) return false;
    if (sourcePaths.size && !(instance.sourcePaths || []).some(p => sourcePaths.has(p))) return false;
    return true;
  });
  if (branchCandidates.length !== 1) return null;

  const branch = branchCandidates[0];
  if (branch.parentRelationVerificationStatus !== 'verified_exact_extension' || branch.parentRelationProofClass !== 'materialized_parent_trajectory') return null;
  if (!branch.parentInstanceUid) return null;
  const parent = census.find(x => x.instanceUid === branch.parentInstanceUid) || null;
  if (!parent?.firstCallUid || !parent?.firstInputPackageUid) return null;
  const firstCall = graph.calls[parent.firstCallUid] || null;
  const input = graph.inputPackages[parent.firstInputPackageUid] || null;
  if (!firstCall || !input) return null;

  const firstUserMessage = (input.canonicalPackage?.messages || []).find(m => m?.role === 'user') || null;
  if (!firstUserMessage) return null;
  const firstUserSection = (input.sectionUids || [])
    .map(uid => graph.sections[uid])
    .find(section => section?.packageSide === 'input' && section?.sectionType === 'message' && section?.role === 'user') || null;

  return {
    treatmentInstanceId: parent.instanceUid,
    trunkKey: exemplar.trunkKey || branch.trunkKey || null,
    collection: 'pilot1',
    status: 'resolved',
    developmentalOriginStatus: 'resolved',
    developmentalOriginClass: 'verified_pilot_parent_trajectory_origin',
    reason: 'explicit_pilot_parent_trajectory_verified_by_exact_package_extension',
    firstPromptMessageId: null,
    firstPromptInputPackageUid: input.inputPackageUid,
    firstPromptInputSectionUid: firstUserSection?.sectionUid || null,
    firstPromptCallUid: firstCall.callUid,
    firstPrompt: String(firstUserMessage.content ?? ''),
    firstPromptContentHash: Graph.sha256Text(firstUserMessage.content ?? ''),
    parentTrajectoryUid: parent.instanceUid,
    branchTrajectoryUid: branch.instanceUid,
    family: exemplar.family || null,
    replicate: exemplar.replicate ?? null,
    observationCount: group.length,
    evidenceObservationCount: group.length,
    provenanceRoute: 'package_first_explicit_parent_trajectory',
    firstAdministeredInput: firstAdministeredInput(index, group),
  };
}

function queryFirstTreatmentPrompts(index, options = {}) {
  if (!index?.messageGraph?.nodes) throw new Error('message_graph_required');
  const includeUnresolved = options.includeUnresolved !== false;
  const rows = Graph.collectObservations(index);
  const groups = new Map();

  for (const row of rows) {
    if (!row?.trunkKey) continue;
    const key = livedPrefixEligible(row) ? String(row.treatmentInstanceId) : unresolvedGroupingKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const out = [];
  for (const [, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const eligible = group.filter(livedPrefixEligible);
    const exemplar = group[0] || {};
    const administered = firstAdministeredInput(index, group);

    if (!eligible.length) {
      const pilotResolved = pilotPackageOrigin(index, group);
      if (pilotResolved) {
        out.push(pilotResolved);
        continue;
      }
      if (!includeUnresolved) continue;
      const ancestryTypes = [...new Set(group.map(r => r.ancestryType || null))].sort();
      const classification = classifyOriginGroup(group);
      out.push({
        treatmentInstanceId: null,
        trunkKey: exemplar.trunkKey || null,
        collection: exemplar.collection || null,
        status: classification.developmentalOriginStatus === 'not_applicable' ? 'not_applicable' : 'unresolved',
        ...classification,
        family: exemplar.family || null,
        replicate: exemplar.replicate ?? null,
        ancestryTypes,
        observationCount: group.length,
        firstAdministeredInput: administered,
      });
      continue;
    }

    const candidates = [];
    for (const row of eligible) {
      const node = firstUserInVerifiedPrefix(index, row);
      if (!node) continue;
      candidates.push({
        messageUid: node.messageUid,
        content: node.content,
        contentHash: node.contentHash,
        treatmentInstanceId: row.treatmentInstanceId,
        trunkKey: row.trunkKey,
        parentSnapshotId: row.parentSnapshotId,
        observationId: row.observationId,
        collection: row.collection,
        family: row.family || null,
        replicate: row.replicate ?? null,
      });
    }

    if (!candidates.length) {
      if (!includeUnresolved) continue;
      out.push({
        treatmentInstanceId: eligible[0].treatmentInstanceId,
        trunkKey: eligible[0].trunkKey,
        collection: eligible[0].collection,
        status: 'unresolved',
        developmentalOriginStatus: 'unresolved',
        developmentalOriginClass: 'verified_prefix_without_user_input',
        reason: 'verified_prefix_contains_no_user_message',
        family: eligible[0]?.family || null,
        replicate: eligible[0]?.replicate ?? null,
        observationCount: group.length,
        firstAdministeredInput: administered,
      });
      continue;
    }

    const byUid = new Map();
    for (const candidate of candidates) if (!byUid.has(candidate.messageUid)) byUid.set(candidate.messageUid, candidate);
    const unique = [...byUid.values()].sort((a, b) => a.messageUid.localeCompare(b.messageUid));

    if (unique.length !== 1) {
      out.push({
        treatmentInstanceId: eligible[0].treatmentInstanceId,
        trunkKey: eligible[0].trunkKey,
        collection: eligible[0].collection,
        status: 'conflict',
        developmentalOriginStatus: 'conflict',
        developmentalOriginClass: 'multiple_verified_origins',
        reason: 'multiple_verified_first_prompt_events_within_treatment_instance',
        family: eligible[0]?.family || null,
        replicate: eligible[0]?.replicate ?? null,
        observationCount: group.length,
        candidates: unique,
        firstAdministeredInput: administered,
      });
      continue;
    }

    const winner = unique[0];
    out.push({
      treatmentInstanceId: winner.treatmentInstanceId,
      trunkKey: winner.trunkKey,
      collection: winner.collection,
      status: 'resolved',
      developmentalOriginStatus: 'resolved',
      developmentalOriginClass: 'verified_lived_origin',
      firstPromptMessageId: winner.messageUid,
      firstPrompt: winner.content,
      firstPromptContentHash: winner.contentHash,
      parentSnapshotId: winner.parentSnapshotId,
      family: winner.family,
      replicate: winner.replicate,
      observationCount: group.length,
      evidenceObservationCount: eligible.length,
      provenanceRoute: 'verified_raw_lived_prefix_message',
      firstAdministeredInput: administered,
    });
  }

  return out;
}

function summary(rows) {
  const statuses = {};
  const originClasses = {};
  const administeredInputStatuses = {};
  for (const row of rows) {
    statuses[row.status] = (statuses[row.status] || 0) + 1;
    const cls = row.developmentalOriginClass || '<missing>';
    originClasses[cls] = (originClasses[cls] || 0) + 1;
    const ais = row.firstAdministeredInput?.status || '<missing>';
    administeredInputStatuses[ais] = (administeredInputStatuses[ais] || 0) + 1;
  }
  return { treatmentGroups: rows.length, statuses, originClasses, administeredInputStatuses };
}

module.exports = {
  livedPrefixEligible,
  firstUserInVerifiedPrefix,
  firstAdministeredInput,
  unresolvedGroupingKey,
  classifyOriginGroup,
  pilotPackageOrigin,
  queryFirstTreatmentPrompts,
  summary,
};
