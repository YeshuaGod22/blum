'use strict';

// DAE INSTANCE START CENSUS v0 — 15 Sep 2026
//
// Primary question: for every actual model conversation/branch instance, what
// was its first administered input, and are there further complete input-output
// pairs downstream of it?
//
// Instance semantics:
// - lived trunk turns belonging to one collection+trunkKey are one developmental
//   conversation instance;
// - every cold/cold_schema observation is its own root instance/call;
// - every lived branch observation is its own branch instance, retaining the
//   inherited prefix as part of the model-visible trajectory;
// - Pilot 1 is reconstructed from record.json, including explicit parent_trunk
//   links for ASb branch streams.
//
// "cold" is experimental metadata, not a different ontology of first turns.

const Graph = require('./dae-message-lineage-graph-v0-15sep2026.js');

function normalizeMessage(message) {
  return {
    role: String(message?.role || ''),
    content: Graph.messageText(message),
  };
}

function transcriptFromVisible(modelVisibleMessages, rawOutput) {
  const out = (modelVisibleMessages || []).map(normalizeMessage);
  if (rawOutput !== null && rawOutput !== undefined) {
    out.push({ role: 'assistant', content: String(rawOutput) });
  }
  return out;
}

function pairsFromTranscript(transcript) {
  const pairs = [];
  let pendingUser = null;
  for (const message of transcript || []) {
    if (message?.role === 'user') {
      pendingUser = message;
      continue;
    }
    if (message?.role === 'assistant' && pendingUser) {
      pairs.push({ input: pendingUser, output: message });
      pendingUser = null;
    }
  }
  return pairs;
}

function summarizeTranscript(transcript) {
  const pairs = pairsFromTranscript(transcript);
  const firstUser = (transcript || []).find(m => m?.role === 'user') || null;
  const firstPair = pairs[0] || null;
  const ioPairCount = pairs.length;
  return {
    firstInput: firstUser?.content ?? null,
    firstInputContentHash: firstUser ? Graph.sha256Text(firstUser.content) : null,
    firstOutput: firstPair?.output?.content ?? null,
    firstOutputContentHash: firstPair ? Graph.sha256Text(firstPair.output.content) : null,
    ioPairCount,
    hasFurtherInputOutputPairs: ioPairCount > 1,
    downstreamInputOutputPairCount: Math.max(0, ioPairCount - 1),
    transcriptMessageCount: (transcript || []).length,
  };
}

function pilotTranscriptFromTurns(turns) {
  const transcript = [];
  for (const turn of (turns || []).slice().sort((a, b) => Number(a?.n || 0) - Number(b?.n || 0))) {
    transcript.push({ role: 'user', content: String(turn?.sent ?? '') });
    if (turn?.raw_response !== null && turn?.raw_response !== undefined) {
      transcript.push({ role: 'assistant', content: String(turn.raw_response) });
    }
  }
  return transcript;
}

function instanceRecord(base, transcript) {
  return {
    ...base,
    ...summarizeTranscript(transcript),
  };
}

function buildPilot1Instances(record) {
  if (!record?.cells) return [];
  const instances = [];
  const trunkCells = new Map();
  const trunkInstanceById = new Map();

  for (const cell of record.cells) {
    if (cell?.kind !== 'trunk') continue;
    const trunkId = String(cell.trunk_id || cell.source_file || `pilot1-${cell.cell}-r${cell.replicate}`);
    const instanceUid = Graph.uid('inst', { collection: 'pilot1', kind: 'lived_trunk', trunkId });
    trunkCells.set(trunkId, cell);
    trunkInstanceById.set(trunkId, instanceUid);
    const transcript = pilotTranscriptFromTurns(cell.turns || []);
    instances.push(instanceRecord({
      instanceUid,
      collection: 'pilot1',
      instanceKind: 'root_lived_trunk',
      ancestryType: 'pilot1_lived_trunk',
      family: cell.cell || null,
      replicate: cell.replicate ?? null,
      trunkKey: trunkId,
      parentInstanceUid: null,
      sourcePaths: [cell.source_file || trunkId].filter(Boolean),
      sourceCallCount: 1,
      inheritedPrefixMessageCount: 0,
      inheritedHistoryStatus: 'not_applicable_root',
      storageEra: 'pilot1_session_jsonl',
    }, transcript));
  }

  for (const cell of record.cells) {
    if (cell?.kind === 'trunk') continue;
    const sourcePath = cell.source_file || cell.trunk_id || null;
    const isCold = cell?.kind === 'cold';
    const parentTrunkId = cell.parent_trunk || null;
    const parentCell = parentTrunkId ? trunkCells.get(String(parentTrunkId)) || null : null;
    const parentInstanceUid = parentTrunkId ? trunkInstanceById.get(String(parentTrunkId)) || null : null;
    const inherited = !isCold && parentCell ? pilotTranscriptFromTurns(parentCell.turns || []) : [];

    for (let i = 0; i < (cell.branches || []).length; i += 1) {
      const branch = cell.branches[i] || {};
      const current = [
        { role: 'user', content: String(branch.sent ?? '') },
        { role: 'assistant', content: String(branch.raw_response ?? '') },
      ];
      const transcript = [...inherited, ...current];
      const instanceUid = Graph.uid('inst', {
        collection: 'pilot1',
        kind: isCold ? 'cold_call' : 'branch_call',
        sourcePath,
        item: branch.item || null,
        branch: branch.branch || null,
        replicate: cell.replicate ?? null,
        ordinal: i,
      });
      instances.push(instanceRecord({
        instanceUid,
        collection: 'pilot1',
        instanceKind: isCold ? 'root_single_call' : 'branch_from_lived_trunk',
        ancestryType: isCold ? 'cold_no_lived_parent' : 'pilot1_lived_trunk_branch',
        family: cell.cell || null,
        replicate: cell.replicate ?? null,
        trunkKey: cell.trunk_id || sourcePath,
        probeId: branch.item || null,
        forkId: isCold ? 'cold' : (branch.branch || null),
        parentInstanceUid: isCold ? null : parentInstanceUid,
        sourcePaths: [sourcePath].filter(Boolean),
        sourceCallCount: 1,
        inheritedPrefixMessageCount: inherited.length,
        inheritedHistoryStatus: isCold
          ? 'not_applicable_root'
          : parentCell
            ? 'reconstructed_from_explicit_parent_trunk'
            : 'declared_branch_parent_not_materialized',
        storageEra: 'pilot1_session_jsonl',
      }, transcript));
    }
  }
  return instances;
}

function latestTrunkTurn(group) {
  return group.slice().sort((a, b) => {
    const at = Number(a?.turn ?? -1);
    const bt = Number(b?.turn ?? -1);
    if (at !== bt) return at - bt;
    const am = (a?.modelVisibleMessages || []).length;
    const bm = (b?.modelVisibleMessages || []).length;
    if (am !== bm) return am - bm;
    return String(a?.source?.path || '').localeCompare(String(b?.source?.path || ''));
  }).at(-1) || null;
}

function buildRawCollectionInstances(entry) {
  const collection = String(entry?.name || entry?.collection || 'unknown');
  const dataset = entry?.dataset || {};
  const instances = [];
  const trunkGroups = new Map();

  for (const turn of (dataset.trunkTurns || [])) {
    const trunkKey = String(turn?.trunkKey || `${turn?.family || 'unknown'}-r${turn?.replicate ?? '?'}`);
    if (!trunkGroups.has(trunkKey)) trunkGroups.set(trunkKey, []);
    trunkGroups.get(trunkKey).push(turn);
  }

  const trunkInstanceByKey = new Map();
  for (const [trunkKey, group] of trunkGroups.entries()) {
    const terminal = latestTrunkTurn(group);
    if (!terminal) continue;
    const instanceUid = Graph.uid('inst', { collection, kind: 'lived_trunk', trunkKey });
    trunkInstanceByKey.set(trunkKey, instanceUid);
    const transcript = transcriptFromVisible(terminal.modelVisibleMessages || [], terminal.rawOutput);
    instances.push(instanceRecord({
      instanceUid,
      collection,
      instanceKind: 'root_lived_trunk',
      ancestryType: 'lived_trunk',
      family: terminal.family || null,
      replicate: terminal.replicate ?? null,
      trunkKey,
      parentInstanceUid: null,
      sourcePaths: group.map(x => x?.source?.path).filter(Boolean).sort(),
      sourceCallCount: group.length,
      inheritedPrefixMessageCount: 0,
      inheritedHistoryStatus: 'not_applicable_root',
      storageEra: 'raw2_plus_one_file_per_call',
    }, transcript));
  }

  for (const observation of (dataset.branchObservations || [])) {
    const trunkKey = String(observation?.trunkKey || 'unknown');
    const instanceUid = Graph.uid('inst', { collection, kind: 'branch_call', observationId: observation.observationId });
    const transcript = transcriptFromVisible(observation.modelVisibleMessages || [], observation.rawOutput);
    instances.push(instanceRecord({
      instanceUid,
      observationId: observation.observationId || null,
      collection,
      instanceKind: 'branch_from_lived_trunk',
      ancestryType: observation.ancestryType || 'lived_trunk_branch',
      family: observation.family || observation.source?.originalCell || null,
      replicate: observation.replicate ?? observation.source?.originalReplicate ?? null,
      trunkKey,
      probeId: observation.probeId || null,
      forkId: observation.forkId || null,
      parentInstanceUid: trunkInstanceByKey.get(trunkKey) || null,
      parentSnapshotId: observation.parentSnapshotId || null,
      sourcePaths: [observation?.source?.path].filter(Boolean),
      sourceCallCount: 1,
      inheritedPrefixMessageCount: Number.isInteger(observation?.parentSnapshot?.prefixLen)
        ? observation.parentSnapshot.prefixLen
        : null,
      inheritedHistoryStatus: observation?.parentSnapshot?.verificationStatus === 'verified_from_sent_prefix'
        ? 'verified_from_sent_prefix'
        : 'branch_prefix_unverified',
      storageEra: 'raw2_plus_one_file_per_call',
    }, transcript));
  }

  for (const observation of (dataset.coldObservations || [])) {
    const instanceUid = Graph.uid('inst', { collection, kind: 'root_call', observationId: observation.observationId });
    const transcript = transcriptFromVisible(observation.modelVisibleMessages || [], observation.rawOutput);
    instances.push(instanceRecord({
      instanceUid,
      observationId: observation.observationId || null,
      collection,
      instanceKind: 'root_single_call',
      ancestryType: observation.ancestryType || 'cold_no_lived_parent',
      family: observation.family || observation.source?.originalCell || null,
      replicate: observation.replicate ?? observation.source?.originalReplicate ?? null,
      trunkKey: observation.trunkKey || null,
      probeId: observation.probeId || null,
      forkId: observation.forkId || null,
      parentInstanceUid: null,
      sourcePaths: [observation?.source?.path].filter(Boolean),
      sourceCallCount: 1,
      inheritedPrefixMessageCount: 0,
      inheritedHistoryStatus: 'not_applicable_root',
      storageEra: 'raw2_plus_one_file_per_call',
    }, transcript));
  }

  return instances;
}

function censusSummary(instances) {
  const byKind = {};
  const byAncestry = {};
  let withFurtherPairs = 0;
  let missingFirstInput = 0;
  for (const instance of instances || []) {
    byKind[instance.instanceKind] = (byKind[instance.instanceKind] || 0) + 1;
    byAncestry[instance.ancestryType] = (byAncestry[instance.ancestryType] || 0) + 1;
    if (instance.hasFurtherInputOutputPairs) withFurtherPairs += 1;
    if (!instance.firstInput) missingFirstInput += 1;
  }
  return {
    instanceCount: (instances || []).length,
    byKind,
    byAncestry,
    withFurtherInputOutputPairs: withFurtherPairs,
    withoutFurtherInputOutputPairs: (instances || []).length - withFurtherPairs,
    missingFirstInput,
  };
}

function attachInstanceStartCensus(index, { pilot1Record = null, collections = [] } = {}) {
  if (!index || typeof index !== 'object') throw new Error('instance_census_index_required');
  const instances = [
    ...buildPilot1Instances(pilot1Record),
    ...collections.flatMap(buildRawCollectionInstances),
  ].sort((a, b) => String(a.collection).localeCompare(String(b.collection)) || String(a.instanceUid).localeCompare(String(b.instanceUid)));

  const seen = new Set();
  for (const instance of instances) {
    if (seen.has(instance.instanceUid)) throw new Error(`duplicate_instance_uid:${instance.instanceUid}`);
    seen.add(instance.instanceUid);
  }

  const summary = censusSummary(instances);
  index.instanceStartCensus = {
    schema: 'blum-dae-instance-start-census-v0',
    identitySemantics: {
      rootLivedTrunk: 'one developmental conversation per collection + trunkKey, reconstructed from ordered trunk calls',
      rootSingleCall: 'each cold/cold_schema subject call is its own model instance regardless of replicate grouping labels',
      livedBranch: 'each branch observation is its own branch instance, with inherited model-visible prefix retained in its trajectory',
      pilot1: 'session JSONL reconstructed from record.json; explicit parent_trunk joins are used for branch trajectories',
      cold: 'experimental ancestry metadata only; cold instances still have ordinary first inputs',
    },
    ...summary,
    instances,
  };
  return index;
}

module.exports = {
  normalizeMessage,
  transcriptFromVisible,
  pairsFromTranscript,
  summarizeTranscript,
  pilotTranscriptFromTurns,
  buildPilot1Instances,
  buildRawCollectionInstances,
  censusSummary,
  attachInstanceStartCensus,
};
