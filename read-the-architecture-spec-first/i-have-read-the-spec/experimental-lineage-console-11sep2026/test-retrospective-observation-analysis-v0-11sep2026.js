'use strict';

const assert = require('assert');
const importDae = require('./dae-raw-call-lineage-import-adapter-v0-11sep2026.js');
const analysis = require('./experimental-lineage-observation-analysis-v0-11sep2026.js');

const prefix = [
  { role: 'user', content: 'developmental Q1' },
  { role: 'assistant', content: '<reflection>trunk reflection</reflection><reply>trunk answer</reply>' },
];

function rawBranch(branch, reflection, reply) {
  return {
    cell: `AS${branch}`,
    replicate: 1,
    item: 'N4',
    kind: 'branch',
    branch,
    parent_prefix: 'AS-trunk1.messages.json',
    prefix_len: prefix.length,
    sent: [
      ...prefix,
      { role: 'user', content: branch === 'a' ? 'maintain schema' : 'drop schema' },
      { role: 'user', content: 'N4' },
    ],
    received: `<reflection>${reflection}</reflection><reply>${reply}</reply>`,
    stop_reason: 'end_turn',
  };
}

async function embedText({ text }) {
  if (text.includes('maintained')) return { vector: [1, 0], meta: { provider: 'mock', model: 'two-axis', version: '1' } };
  if (text.includes('dropped')) return { vector: [0, 1], meta: { provider: 'mock', model: 'two-axis', version: '1' } };
  return { vector: [1, 1], meta: { provider: 'mock', model: 'two-axis', version: '1' } };
}

async function main() {
  const a = importDae.importBranchRecord(rawBranch('a', 'schema maintained in reflection', '37'), { path: 'ASa-r1-N4.json' });
  const b = importDae.importBranchRecord(rawBranch('b', 'schema dropped in reflection', '52'), { path: 'ASb-r1-N4.json' });

  assert.equal(a.parentSnapshotId, b.parentSnapshotId, 'importer establishes exact shared parent before analysis');

  const result = await analysis.analyzeObservations({
    observations: [a, b],
    analysisStreams: [
      { id: 'reflection_only', enabled: true, mode: 'single-tag', tags: 'reflection', missingPolicy: 'NA' },
      { id: 'reply_only', enabled: true, mode: 'single-tag', tags: 'reply', missingPolicy: 'NA' },
    ],
    embedText,
    embeddingMetadata: { provider: 'mock-default' },
  });

  assert.equal(result.observationCount, 2);
  assert.equal(result.siblingPairs.length, 1);
  assert.equal(result.siblingPairs[0].contrastType, 'exact_shared_parent');
  assert.equal(result.projections.length, 4);
  assert.equal(result.embeddings.length, 4);

  const reflectionMetric = result.metrics.siblingDivergence.find(x => x.analysisStreamId === 'reflection_only');
  assert.ok(reflectionMetric, 'reflection-only sibling divergence exists');
  assert.ok(Math.abs(reflectionMetric.value - 1) < 1e-12, 'orthogonal retrospective reflection vectors diverge by 1');

  const reflEmbedding = result.embeddings.find(x => x.analysisStreamId === 'reflection_only');
  assert.equal(reflEmbedding.provider, 'mock');
  assert.equal(reflEmbedding.model, 'two-axis');
  assert.equal(reflEmbedding.version, '1');

  // Analysis must leave imported witness untouched.
  assert.equal(a.rawOutput, '<reflection>schema maintained in reflection</reflection><reply>37</reply>');
  assert.equal(b.rawOutput, '<reflection>schema dropped in reflection</reflection><reply>52</reply>');

  console.log('PASS retrospective-observation-analysis-v0');
  console.log(JSON.stringify({
    pair: result.siblingPairs[0],
    reflectionMetric,
    projectionTexts: result.projections.filter(x => x.analysisStreamId === 'reflection_only').map(x => x.selectedText),
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
