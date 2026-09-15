'use strict';

// DAE FIRST TREATMENT PROMPTS v0 — 15 Sep 2026
//
// A treatment's first prompt is resolved only from a VERIFIED lived trunk
// prefix. Reused trunk labels, matching strings, and local battery probes are
// not enough evidence to call something the treatment origin.

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

function unresolvedGroupingKey(row) {
  return `unresolved::${row?.collection || '<missing>'}::${row?.trunkKey || '<missing>'}`;
}

function queryFirstTreatmentPrompts(index, options = {}) {
  if (!index?.messageGraph?.nodes) throw new Error('message_graph_required');
  const includeUnresolved = options.includeUnresolved !== false;
  const rows = Graph.collectObservations(index);
  const groups = new Map();

  // Verified lived prefixes are grouped by the actual treatment-prefix event
  // instance. Everything else is kept collection-scoped and unresolved.
  for (const row of rows) {
    if (!row?.trunkKey) continue;
    const key = livedPrefixEligible(row)
      ? String(row.treatmentInstanceId)
      : unresolvedGroupingKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const out = [];
  for (const [groupKey, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const eligible = group.filter(livedPrefixEligible);
    const exemplar = group[0] || {};

    if (!eligible.length) {
      if (!includeUnresolved) continue;
      const ancestryTypes = [...new Set(group.map(r => r.ancestryType || null))];
      const reason = ancestryTypes.some(x => x === 'pilot1_lived_trunk' || x === 'pilot1_lived_trunk_branch')
        ? 'pilot1_normalized_rows_do_not_preserve_complete_lived_prefix'
        : 'no_verified_lived_prefix_in_index';
      out.push({
        treatmentInstanceId: null,
        trunkKey: exemplar.trunkKey || null,
        collection: exemplar.collection || null,
        status: 'unresolved',
        reason,
        family: exemplar.family || null,
        replicate: exemplar.replicate ?? null,
        ancestryTypes: ancestryTypes.sort(),
        observationCount: group.length,
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
        reason: 'verified_prefix_contains_no_user_message',
        family: eligible[0]?.family || null,
        replicate: eligible[0]?.replicate ?? null,
        observationCount: group.length,
      });
      continue;
    }

    const byUid = new Map();
    for (const candidate of candidates) {
      if (!byUid.has(candidate.messageUid)) byUid.set(candidate.messageUid, candidate);
    }
    const unique = [...byUid.values()].sort((a, b) => a.messageUid.localeCompare(b.messageUid));

    if (unique.length !== 1) {
      out.push({
        treatmentInstanceId: eligible[0].treatmentInstanceId,
        trunkKey: eligible[0].trunkKey,
        collection: eligible[0].collection,
        status: 'conflict',
        reason: 'multiple_verified_first_prompt_events_within_treatment_instance',
        family: eligible[0]?.family || null,
        replicate: eligible[0]?.replicate ?? null,
        observationCount: group.length,
        candidates: unique,
      });
      continue;
    }

    const winner = unique[0];
    out.push({
      treatmentInstanceId: winner.treatmentInstanceId,
      trunkKey: winner.trunkKey,
      collection: winner.collection,
      status: 'resolved',
      firstPromptMessageId: winner.messageUid,
      firstPrompt: winner.content,
      firstPromptContentHash: winner.contentHash,
      parentSnapshotId: winner.parentSnapshotId,
      family: winner.family,
      replicate: winner.replicate,
      observationCount: group.length,
      evidenceObservationCount: eligible.length,
    });
  }

  return out;
}

function summary(rows) {
  const statuses = {};
  for (const row of rows) statuses[row.status] = (statuses[row.status] || 0) + 1;
  return { treatmentInstances: rows.length, statuses };
}

module.exports = {
  livedPrefixEligible,
  firstUserInVerifiedPrefix,
  unresolvedGroupingKey,
  queryFirstTreatmentPrompts,
  summary,
};
