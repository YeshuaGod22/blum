'use strict';

const assert = require('assert');
const G = require('./dae-message-lineage-graph-v0-15sep2026.js');

const sharedPrefix = [
  { role: 'user', content: 'first treatment prompt' },
  { role: 'assistant', content: 'first response' },
];

function row({ id, trunkKey, collection = 'fixture', parentSnapshotId = null, verified = false, suffix = 'probe', output = 'answer', samePromptOnly = false }) {
  return {
    observationId: id,
    collection,
    family: trunkKey.split('-')[0],
    replicate: 1,
    trunkKey,
    parentSnapshotId,
    parentVerificationStatus: verified ? 'verified_from_sent_prefix' : 'unverified',
    ancestryType: verified ? 'lived_trunk_branch' : 'cold_no_lived_parent',
    modelVisibleMessages: samePromptOnly
      ? [{ role: 'user', content: 'identical independent prompt' }]
      : [...sharedPrefix, { role: 'user', content: suffix }],
    rawOutput: output,
  };
}

function source(observationId, prefixLen = null, systemPrompt = null) {
  return {
    observationId,
    parentSnapshot: prefixLen === null ? null : { prefixLen },
    systemPrompt,
  };
}

function main() {
  const a = row({ id: 'obs_a', trunkKey: 'AS-r1', parentSnapshotId: 'snap_exact', verified: true, suffix: 'arm a' });
  const b = row({ id: 'obs_b', trunkKey: 'AS-r1', parentSnapshotId: 'snap_exact', verified: true, suffix: 'arm b' });
  const otherTrunkSameText = row({ id: 'obs_c', trunkKey: 'H-r1', parentSnapshotId: 'snap_exact', verified: true, suffix: 'arm a' });
  const independent1 = row({ id: 'obs_d', trunkKey: 'C-r1', samePromptOnly: true });
  const independent2 = row({ id: 'obs_e', trunkKey: 'C-r2', samePromptOnly: true });
  const sameLabelOtherCollection = row({
    id: 'obs_f',
    trunkKey: 'AS-r1',
    collection: 'fixture-rerun',
    parentSnapshotId: 'snap_exact',
    verified: true,
    suffix: 'arm a',
  });

  const index = {
    observations: [a, b, otherTrunkSameText, independent1, independent2, sameLabelOtherCollection],
    itemHistories: {},
  };
  const collections = [{ dataset: { observations: [
    source('obs_a', 2, 'system one'),
    source('obs_b', 2, 'system one'),
    source('obs_c', 2, 'system one'),
    source('obs_d'),
    source('obs_e'),
    source('obs_f', 2, 'system one'),
  ] } }];

  G.attachMessageGraph(index, { collections });

  // Same verified treatment instance: literally the same ancestor event IDs.
  assert.deepEqual(a.modelVisibleMessageIds.slice(0, 2), b.modelVisibleMessageIds.slice(0, 2));
  assert.equal(a.treatmentInstanceId, b.treatmentInstanceId);
  assert.notEqual(a.modelVisibleMessageIds[2], b.modelVisibleMessageIds[2], 'branch-specific suffixes must remain separate events');

  // Same prefix bytes + same content-addressed snapshot, but DIFFERENT trunk:
  // do not collapse event identity.
  assert.notEqual(a.modelVisibleMessageIds[0], otherTrunkSameText.modelVisibleMessageIds[0]);
  assert.equal(
    index.messageGraph.nodes[a.modelVisibleMessageIds[0]].contentHash,
    index.messageGraph.nodes[otherTrunkSameText.modelVisibleMessageIds[0]].contentHash,
    'same words should still have the same content hash'
  );

  // Same trunk label + same snapshot + same text, but DIFFERENT collection:
  // still a distinct administered treatment event.
  assert.notEqual(a.treatmentInstanceId, sameLabelOtherCollection.treatmentInstanceId);
  assert.notEqual(a.modelVisibleMessageIds[0], sameLabelOtherCollection.modelVisibleMessageIds[0]);
  assert.equal(
    index.messageGraph.nodes[a.modelVisibleMessageIds[0]].contentHash,
    index.messageGraph.nodes[sameLabelOtherCollection.modelVisibleMessageIds[0]].contentHash
  );

  // Independent administrations of identical text remain distinct events.
  assert.notEqual(independent1.inputMessageId, independent2.inputMessageId);
  assert.equal(
    index.messageGraph.nodes[independent1.inputMessageId].contentHash,
    index.messageGraph.nodes[independent2.inputMessageId].contentHash
  );

  // Every output is addressable and linked to the terminal visible input.
  assert.ok(a.outputMessageId.startsWith('msg_'));
  assert.equal(index.messageGraph.nodes[a.outputMessageId].parentMessageUid, a.modelVisibleMessageIds.at(-1));
  assert.ok(a.systemMessageId.startsWith('msg_'));

  // The normalized graph must reconstruct exactly what the model-visible array held.
  assert.deepEqual(G.reconstructModelVisibleMessages(index, 'obs_a'), a.modelVisibleMessages);
  assert.deepEqual(G.reconstructModelVisibleMessages(index, 'obs_d'), independent1.modelVisibleMessages);

  // The old trunkKey-only convenience helper now correctly exposes why it is
  // not a treatment-instance query: reused labels across collections conflict.
  const prompts = G.firstUserPromptsByTrunk(index);
  const as = prompts.find(x => x.trunkKey === 'AS-r1');
  assert.equal(as.status, 'conflict');

  console.log('PASS dae-message-lineage-graph-v0');
  console.log(JSON.stringify({
    nodes: index.messageGraph.nodeCount,
    treatmentInstance: a.treatmentInstanceId,
    sharedAncestor: a.modelVisibleMessageIds[0],
    divergentA: a.modelVisibleMessageIds[2],
    divergentB: b.modelVisibleMessageIds[2],
    sameLabelOtherCollection: {
      treatmentInstanceId: sameLabelOtherCollection.treatmentInstanceId,
      firstMessageUid: sameLabelOtherCollection.modelVisibleMessageIds[0],
    },
    independentSameText: [independent1.inputMessageId, independent2.inputMessageId],
    trunkLabelHelperStatus: as.status,
  }, null, 2));
}

main();
