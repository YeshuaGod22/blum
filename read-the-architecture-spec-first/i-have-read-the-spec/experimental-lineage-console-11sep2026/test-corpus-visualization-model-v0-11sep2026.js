'use strict';

const assert = require('assert');
const V = require('./corpus-visualization-model-v0-11sep2026.js');

const dataset = {
  summary: { rawCallsImported: 6 },
  trunkTurns: [
    { source: { path: 'AS-r1-t1.json' }, callOutcome: 'complete', turn: 1 },
    { source: { path: 'AS-r1-t2.json' }, callOutcome: 'truncated', stopReason: 'max_tokens', turn: 2 },
  ],
  branchObservations: [
    { source: { path: 'ASa-r1-N4.json' }, forkId: 'a', probeId: 'N4', parentSnapshotId: 'snap_same', callOutcome: 'complete' },
    { source: { path: 'AS0-r1-N4.json' }, forkId: '0', probeId: 'N4', parentSnapshotId: 'snap_same', callOutcome: 'complete' },
    { source: { path: 'ASa-r1-A1.json' }, forkId: 'a', probeId: 'A1', parentSnapshotId: 'snap_same', callOutcome: 'complete' },
    { source: { path: 'AS0-r1-A1.json' }, forkId: '0', probeId: 'A1', parentSnapshotId: 'snap_same', callOutcome: 'complete' },
  ],
  coldObservations: [],
  contrasts: [
    { contrastType: 'exact_shared_parent', probeId: 'N4', leftForkId: 'a', rightForkId: '0', parentSnapshotId: 'snap_same' },
  ],
};

const viz = V.buildCorpusVisualization(dataset);
assert.equal(viz.lineage.length, 1);
assert.equal(viz.lineage[0].family, 'AS');
assert.equal(viz.lineage[0].forks.length, 2);
assert.deepEqual(viz.probes, ['A1', 'N4']);
assert.equal(viz.anomalies.length, 1);
assert.equal(viz.anomalies[0].stopReason, 'max_tokens');

const n4a = viz.coverage.find(c => c.probeId === 'N4' && c.fork === 'a');
const n40 = viz.coverage.find(c => c.probeId === 'N4' && c.fork === '0');
assert.ok(n4a && n40);
assert.equal(n4a.exactSiblingContrast, true);
assert.equal(n40.exactSiblingContrast, true);

const a1a = viz.coverage.find(c => c.probeId === 'A1' && c.fork === 'a');
assert.equal(a1a.exactSiblingContrast, false);

console.log('PASS corpus-visualization-model-v0');
console.log(JSON.stringify({
  summary: viz.summary,
  probes: viz.probes,
  anomaly: viz.anomalies[0],
  n4Coverage: [n4a, n40],
}, null, 2));
