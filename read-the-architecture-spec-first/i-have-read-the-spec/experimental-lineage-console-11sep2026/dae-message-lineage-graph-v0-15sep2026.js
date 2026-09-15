'use strict';

// DAE MESSAGE LINEAGE GRAPH v0 — 15 Sep 2026
//
// Restores Blum's February invariant that every datum is addressable without
// confusing content identity with event identity.
//
// Rules:
// - Every model-visible message and every generated output gets a stable UID.
// - `contentHash` answers "same bytes/text?"; UID answers "same datum/event?".
// - A verified shared trunk prefix is deduplicated only when BOTH trunk identity
//   and verified parent-prefix identity agree. Text equality alone never merges
//   independent events.
// - Raw `modelVisibleMessages` remain authoritative witness data. This graph is
//   a reversible normalized projection, not a replacement for the witness.

const crypto = require('crypto');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function sha256Text(text) {
  return 'sha256:' + crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

function hashHex(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value), 'utf8').digest('hex');
}

function uid(prefix, material) {
  return `${prefix}_${hashHex(material).slice(0, 16)}`;
}

function messageText(message) {
  if (!message || typeof message !== 'object') return String(message ?? '');
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map(block => {
      if (block && typeof block === 'object') return String(block.text ?? block.content ?? '');
      return String(block ?? '');
    }).join('\n');
  }
  return String(message.content ?? '');
}

function sourceObservationMap(collections = []) {
  const map = new Map();
  for (const entry of collections || []) {
    for (const observation of (entry?.dataset?.observations || [])) {
      if (observation?.observationId) map.set(String(observation.observationId), observation);
    }
  }
  return map;
}

function collectObservations(index) {
  const byId = new Map();
  for (const row of (index?.observations || [])) {
    if (row?.observationId) byId.set(String(row.observationId), row);
  }
  if (!byId.size) {
    for (const history of Object.values(index?.itemHistories || {})) {
      for (const row of (history?.observations || [])) {
        if (row?.observationId && !byId.has(String(row.observationId))) byId.set(String(row.observationId), row);
      }
    }
  }
  return [...byId.values()];
}

function addNode(nodes, node) {
  const existing = nodes.get(node.messageUid);
  if (!existing) {
    nodes.set(node.messageUid, node);
    return;
  }
  for (const key of ['role', 'contentHash', 'parentMessageUid', 'datumRole']) {
    if ((existing[key] ?? null) !== (node[key] ?? null)) {
      throw new Error(`message_uid_identity_conflict:${node.messageUid}:${key}`);
    }
  }
  if (existing.content !== node.content) throw new Error(`message_uid_content_conflict:${node.messageUid}`);
}

function prefixEvidence(row, sourceObservation) {
  const prefixLen = sourceObservation?.parentSnapshot?.prefixLen;
  const verified = row?.parentVerificationStatus === 'verified_from_sent_prefix'
    && Boolean(row?.parentSnapshotId)
    && Boolean(row?.trunkKey)
    && Number.isInteger(prefixLen)
    && prefixLen >= 0;
  return {
    verified,
    prefixLen: verified ? prefixLen : 0,
    parentSnapshotId: verified ? row.parentSnapshotId : null,
    trunkKey: verified ? row.trunkKey : null,
  };
}

function annotateObservation(row, sourceObservation, nodes) {
  if (!row?.observationId) throw new Error('message_graph_observation_id_required');
  const observationId = String(row.observationId);
  const messages = Array.isArray(row.modelVisibleMessages) ? row.modelVisibleMessages : [];
  const prefix = prefixEvidence(row, sourceObservation);
  const messageIds = [];
  let previous = null;
  let lastUserMessageId = null;

  for (let ordinal = 0; ordinal < messages.length; ordinal += 1) {
    const message = messages[ordinal] || {};
    const role = String(message.role || '');
    const content = messageText(message);
    const contentHash = sha256Text(content);
    const sharedVerifiedPrefix = prefix.verified && ordinal < prefix.prefixLen;
    const identity = sharedVerifiedPrefix
      ? {
          kind: 'verified_trunk_prefix_message',
          trunkKey: prefix.trunkKey,
          parentSnapshotId: prefix.parentSnapshotId,
          ordinal,
          role,
        }
      : {
          kind: 'observation_context_message',
          observationId,
          ordinal,
          role,
        };
    const messageUid = uid('msg', identity);
    addNode(nodes, {
      messageUid,
      role,
      content,
      contentHash,
      parentMessageUid: previous,
      datumRole: 'model_visible_message',
      identityClass: identity.kind,
      ordinal,
      trunkKey: sharedVerifiedPrefix ? prefix.trunkKey : (row.trunkKey || null),
      parentSnapshotId: sharedVerifiedPrefix ? prefix.parentSnapshotId : null,
      sourceObservationId: sharedVerifiedPrefix ? null : observationId,
    });
    messageIds.push(messageUid);
    previous = messageUid;
    if (role === 'user') lastUserMessageId = messageUid;
  }

  let systemMessageId = null;
  const systemPrompt = sourceObservation?.systemPrompt ?? row.systemPrompt ?? null;
  if (systemPrompt !== null && systemPrompt !== undefined) {
    const content = String(systemPrompt);
    systemMessageId = uid('msg', { kind: 'observation_system_prompt', observationId });
    addNode(nodes, {
      messageUid: systemMessageId,
      role: 'system',
      content,
      contentHash: sha256Text(content),
      parentMessageUid: null,
      datumRole: 'system_prompt',
      identityClass: 'observation_system_prompt',
      ordinal: null,
      trunkKey: row.trunkKey || null,
      parentSnapshotId: null,
      sourceObservationId: observationId,
    });
  }

  const outputContent = String(row.rawOutput ?? '');
  const outputMessageId = uid('msg', { kind: 'observation_output', observationId });
  addNode(nodes, {
    messageUid: outputMessageId,
    role: 'assistant',
    content: outputContent,
    contentHash: sha256Text(outputContent),
    parentMessageUid: previous,
    datumRole: 'model_output',
    identityClass: 'observation_output',
    ordinal: null,
    trunkKey: row.trunkKey || null,
    parentSnapshotId: null,
    sourceObservationId: observationId,
  });

  row.modelVisibleMessageIds = messageIds;
  row.inputMessageId = lastUserMessageId;
  row.outputMessageId = outputMessageId;
  row.systemMessageId = systemMessageId;
  row.parentPrefixLen = prefix.verified ? prefix.prefixLen : null;
  return row;
}

function attachMessageGraph(index, { collections = [] } = {}) {
  if (!index || typeof index !== 'object') throw new Error('message_graph_index_required');
  const sourceByObservation = sourceObservationMap(collections);
  const rows = collectObservations(index);
  const nodes = new Map();

  for (const row of rows) {
    annotateObservation(row, sourceByObservation.get(String(row.observationId)) || null, nodes);
  }

  const sortedNodes = {};
  for (const key of [...nodes.keys()].sort()) sortedNodes[key] = nodes.get(key);
  index.messageGraph = {
    schema: 'blum-dae-message-lineage-graph-v0',
    identitySemantics: {
      messageUid: 'stable datum/event identity; never inferred from text equality alone',
      contentHash: 'SHA-256 of normalized textual content; equality means same content, not same event',
      verifiedSharedPrefix: 'shared only when trunkKey + verified parentSnapshotId + ordinal agree',
      outputIdentity: 'one generated output datum per observationId',
      systemPromptIdentity: 'one recorded system-prompt datum per observation when present',
    },
    observationCount: rows.length,
    nodeCount: nodes.size,
    nodes: sortedNodes,
  };
  index.messageLineage = {
    schema: 'blum-dae-message-lineage-extension-v0',
    everyDatumAddressable: true,
    rawWitnessRetainedInCanonicalIndex: true,
    graphField: 'messageGraph',
  };
  return index;
}

function nodeMap(index) {
  return index?.messageGraph?.nodes || {};
}

function observationById(index, observationId) {
  return collectObservations(index).find(row => String(row.observationId) === String(observationId)) || null;
}

function reconstructModelVisibleMessages(index, observationId) {
  const row = observationById(index, observationId);
  if (!row) throw new Error(`observation_not_found:${observationId}`);
  const nodes = nodeMap(index);
  return (row.modelVisibleMessageIds || []).map(messageUid => {
    const node = nodes[messageUid];
    if (!node) throw new Error(`message_node_missing:${messageUid}`);
    return { role: node.role, content: node.content };
  });
}

function firstUserPromptsByTrunk(index) {
  const nodes = nodeMap(index);
  const trunks = new Map();
  for (const row of collectObservations(index)) {
    if (!row.trunkKey) continue;
    const firstUserId = (row.modelVisibleMessageIds || []).find(messageUid => nodes[messageUid]?.role === 'user') || null;
    if (!firstUserId) continue;
    const node = nodes[firstUserId];
    if (!trunks.has(row.trunkKey)) {
      trunks.set(row.trunkKey, {
        trunkKey: row.trunkKey,
        family: row.family || null,
        replicate: row.replicate ?? null,
        firstPromptMessageId: firstUserId,
        firstPrompt: node.content,
        firstPromptContentHash: node.contentHash,
        status: 'resolved',
      });
      continue;
    }
    const existing = trunks.get(row.trunkKey);
    if (existing.firstPromptMessageId !== firstUserId) {
      existing.status = 'conflict';
      existing.conflictingMessageIds = [...new Set([...(existing.conflictingMessageIds || [existing.firstPromptMessageId]), firstUserId])].sort();
    }
  }
  return [...trunks.values()].sort((a, b) => String(a.trunkKey).localeCompare(String(b.trunkKey)));
}

module.exports = {
  stableStringify,
  sha256Text,
  hashHex,
  uid,
  messageText,
  sourceObservationMap,
  collectObservations,
  prefixEvidence,
  annotateObservation,
  attachMessageGraph,
  observationById,
  reconstructModelVisibleMessages,
  firstUserPromptsByTrunk,
};
