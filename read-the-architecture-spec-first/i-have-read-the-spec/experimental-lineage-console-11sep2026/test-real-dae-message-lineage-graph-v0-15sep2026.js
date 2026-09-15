'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Graph = require('./dae-message-lineage-graph-v0-15sep2026.js');

function counts(rows, field) {
  const out = {};
  for (const row of rows) {
    const key = String(row?.[field] ?? '<missing>');
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-message-lineage-graph-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  console.log('REAL CORPUS POPULATION');
  console.log(JSON.stringify({
    observationCount: index.observationCount,
    collections: counts(index.observations, 'collection'),
    provenanceClasses: counts(index.observations, 'provenanceClass'),
    ancestryTypes: counts(index.observations, 'ancestryType'),
  }, null, 2));

  assert.ok(index.messageGraph, 'message graph missing');
  assert.equal(index.messageGraph.schema, 'blum-dae-message-lineage-graph-v0');
  assert.equal(index.messageGraph.observationCount, index.observationCount, 'graph must cover exactly the canonical index population');
  assert.ok(index.messageGraph.nodeCount > index.observationCount, 'expected more message nodes than observations');

  let verifiedPrefixRows = 0;
  let reconstructChecks = 0;
  const sharedGroups = new Map();

  for (const row of index.observations) {
    assert.ok(Array.isArray(row.modelVisibleMessageIds), `message IDs missing: ${row.observationId}`);
    assert.equal(row.modelVisibleMessageIds.length, (row.modelVisibleMessages || []).length, `message count mismatch: ${row.observationId}`);
    assert.ok(row.outputMessageId, `output UID missing: ${row.observationId}`);
    assert.ok(index.messageGraph.nodes[row.outputMessageId], `output node missing: ${row.observationId}`);
    assert.equal(index.messageGraph.nodes[row.outputMessageId].sourceObservationId, row.observationId);

    const reconstructed = Graph.reconstructModelVisibleMessages(index, row.observationId);
    assert.deepEqual(reconstructed, row.modelVisibleMessages, `context reconstruction mismatch: ${row.observationId}`);
    reconstructChecks += 1;

    if (row.parentVerificationStatus === 'verified_from_sent_prefix' && Number.isInteger(row.parentPrefixLen) && row.parentPrefixLen > 0) {
      verifiedPrefixRows += 1;
      const key = `${row.trunkKey}::${row.parentSnapshotId}`;
      if (!sharedGroups.has(key)) sharedGroups.set(key, []);
      sharedGroups.get(key).push(row);
    }
  }

  assert.equal(reconstructChecks, index.observationCount, 'did not reconstruct every indexed observation');
  assert.ok(verifiedPrefixRows > 0, 'no verified prefix rows found');

  let multiObservationSharedPrefixes = 0;
  for (const group of sharedGroups.values()) {
    if (group.length < 2) continue;
    multiObservationSharedPrefixes += 1;
    const exemplar = group[0];
    const prefixIds = exemplar.modelVisibleMessageIds.slice(0, exemplar.parentPrefixLen);
    for (const row of group.slice(1)) {
      assert.deepEqual(
        row.modelVisibleMessageIds.slice(0, row.parentPrefixLen),
        prefixIds,
        `verified shared prefix failed to share message UIDs: ${row.trunkKey}`
      );
    }
  }
  assert.ok(multiObservationSharedPrefixes > 0, 'no repeated verified shared-prefix groups found');

  const firstPrompts = Graph.firstUserPromptsByTrunk(index);
  assert.ok(firstPrompts.length > 0, 'first-prompt query returned no trunks');
  const resolved = firstPrompts.filter(x => x.status === 'resolved');
  const conflicts = firstPrompts.filter(x => x.status === 'conflict');
  assert.ok(resolved.length > 0, 'first-prompt query produced no resolved trunks');

  console.log('PASS real DAE message lineage graph');
  console.log(JSON.stringify({
    observations: index.observationCount,
    messageNodes: index.messageGraph.nodeCount,
    verifiedPrefixRows,
    sharedPrefixGroups: multiObservationSharedPrefixes,
    reconstructionChecks,
    firstPromptTrunks: firstPrompts.length,
    resolvedFirstPrompts: resolved.length,
    explicitFirstPromptConflicts: conflicts.length,
    sampleResolvedFirstPrompts: resolved.slice(0, 8),
  }, null, 2));
}

main();
