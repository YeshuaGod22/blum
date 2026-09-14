'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const runner = require('./experimental-lineage-runner-core-v0-11sep2026.js');

function makeClock() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 8, 11, 12, 0, n++));
}

function frozenManifest() {
  return {
    manifestVersion: 1,
    frozen: true,
    fingerprint: 'sha256:test-manifest',
    experiment: { name: 'vertical slice', provider: 'mock', model: 'mock-v1' },
    trunks: [{
      id: 'T01', label: 'one-turn trunk', enabled: true, replicates: 1,
      turns: [{ id: 'Q01', enabled: true, text: 'Develop a stable frame.' }],
    }],
    forks: [
      {
        id: 'a', label: 'schema maintained', enabled: true,
        trunkLived: true, schemaPresent: true,
        intervention: 'Maintain the developmental schema explicitly.',
        replicates: 1, batteryIds: ['N4'],
      },
      {
        id: '0', label: 'schema dropped', enabled: true,
        trunkLived: true, schemaPresent: false,
        intervention: 'Drop the explicit schema while retaining ordinary reasoning.',
        replicates: 1, batteryIds: ['N4'],
      },
    ],
    battery: [{
      id: 'N4', family: 'N', construct: 'test', responseType: 'credence',
      scorer: '', text: 'Give your answer.', enabled: true,
    }],
    analysisStreams: [
      { id: 'whole', enabled: true, mode: 'whole', tags: '', missingPolicy: 'NA' },
      { id: 'reflection', enabled: true, mode: 'single-tag', tags: 'reflection', missingPolicy: 'NA' },
      { id: 'answer', enabled: true, mode: 'single-tag', tags: 'answer', missingPolicy: 'NA' },
      { id: 'revision', enabled: true, mode: 'single-tag', tags: 'revision', missingPolicy: 'NA' },
    ],
    metrics: { siblingDivergence: true },
    failurePolicy: { missingTag: 'NA' },
  };
}

async function mockCallModel({ messages, metadata }) {
  const last = messages[messages.length - 1]?.content || '';
  if (metadata.phase === 'trunk') {
    return {
      text: '<reflection>I am stabilising a frame.</reflection><answer>trunk</answer>',
      stopReason: 'end_turn',
    };
  }
  const joined = messages.map(m => m.content).join('\n');
  if (joined.includes('Maintain the developmental schema explicitly.')) {
    return {
      text: '<reflection>The prior frame remains salient.</reflection><answer>37</answer>',
      stopReason: 'end_turn',
    };
  }
  if (joined.includes('Drop the explicit schema while retaining ordinary reasoning.')) {
    return {
      text: '<reflection>I answer without explicit schema language.</reflection><answer>52</answer>',
      stopReason: 'end_turn',
    };
  }
  throw new Error('unexpected mock branch: ' + last);
}

async function mockEmbed({ text }) {
  if (text.includes('prior frame')) return [1, 0, 0];
  if (text.includes('without explicit')) return [0, 1, 0];
  if (text.trim() === '37') return [1, 0, 1];
  if (text.trim() === '52') return [0, 1, 1];
  return [1, 1, 0];
}

function runCompanionTests() {
  const cwd = __dirname;
  for (const file of [
    'test-battery-library-core-v0-11sep2026.js',
    'test-corpus-visualization-model-v0-11sep2026.js',
    'test-dae-unified-observation-index-v0-11sep2026.js',
  ]) {
    execFileSync(process.execPath, [path.join(cwd, file)], { cwd, stdio: 'inherit' });
  }
}

async function main() {
  const manifest = frozenManifest();
  const result = await runner.runLineage({
    manifest,
    callModel: mockCallModel,
    embedText: mockEmbed,
    clock: makeClock(),
  });

  assert.equal(result.trunkInstances.length, 1, 'one trunk instance');
  assert.equal(result.parentSnapshots.length, 1, 'one frozen parent snapshot');
  assert.equal(result.observations.length, 2, 'two sibling probe observations');
  assert.equal(result.siblingPairs.length, 1, 'one exact sibling pair');

  const [left, right] = result.observations;
  assert.ok(left.parentSnapshotId, 'left has parent snapshot');
  assert.equal(left.parentSnapshotId, right.parentSnapshotId, 'siblings share exact parent snapshot');
  assert.equal(result.siblingPairs[0].contrastType, 'exact_shared_parent');

  const refl = result.projections.filter(p => p.analysisStreamId === 'reflection');
  assert.equal(refl.length, 2);
  assert.ok(refl.every(p => p.status === 'ok'));
  assert.ok(refl.some(p => p.selectedText.includes('prior frame')));
  assert.ok(refl.some(p => p.selectedText.includes('without explicit')));

  const revision = result.projections.filter(p => p.analysisStreamId === 'revision');
  assert.equal(revision.length, 2);
  assert.ok(revision.every(p => p.status === 'missing'), 'missing tag remains missing');
  assert.ok(revision.every(p => p.selectedText === null), 'missing tag never falls back to whole output');

  const reflMetric = result.metrics.siblingDivergence.find(m => m.analysisStreamId === 'reflection');
  assert.ok(reflMetric, 'reflection sibling divergence emitted');
  assert.ok(Math.abs(reflMetric.value - 1) < 1e-12, 'orthogonal mock vectors have cosine distance 1');

  const ledgerProbeRows = result.executionLedger.filter(x => x.phase === 'probe');
  assert.equal(ledgerProbeRows.length, 2);
  assert.ok(ledgerProbeRows.every(x => x.parentSnapshotId === left.parentSnapshotId));
  assert.ok(ledgerProbeRows.every(x => x.outcome === 'complete'));

  const unfrozen = frozenManifest();
  unfrozen.frozen = false;
  await assert.rejects(
    () => runner.runLineage({ manifest: unfrozen, callModel: mockCallModel }),
    /manifest_not_frozen/
  );

  console.log('PASS experimental-lineage-runner-core-v0');
  console.log(JSON.stringify({
    parentSnapshotId: left.parentSnapshotId,
    siblingPair: result.siblingPairs[0],
    reflectionDivergence: reflMetric.value,
    observations: result.observations.map(o => ({ forkId: o.forkId, answer: o.xml.sections.answer?.[0] })),
  }, null, 2));

  runCompanionTests();
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
