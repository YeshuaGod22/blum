'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Structural = require('./structural-output-analysis-v0-12sep2026.js');

function eligiblePairs(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.collection || !row.parentSnapshotId || !row.itemCoreHash) continue;
    const key = `${row.collection}|${row.parentSnapshotId}|${row.itemCoreHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const pairs = [];
  for (const group of groups.values()) {
    for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) {
      if (group[i].forkId !== group[j].forkId) pairs.push([group[i],group[j]]);
    }
  }
  return pairs;
}

function orient(pair) {
  const [x,y] = pair;
  // Historical arm names vary. Prefer `a` as left when present, otherwise
  // retain deterministic lexical fork ordering. Orientation is descriptive.
  if (x.forkId === 'a') return [x,y];
  if (y.forkId === 'a') return [y,x];
  return String(x.forkId).localeCompare(String(y.forkId)) <= 0 ? [x,y] : [y,x];
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-structural-coverage-v0-12sep2026.js <DAE-repo-root>');
  const expRoot = path.join(daeRoot,'experiments','EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(expRoot, {
    repository:'YeshuaGod22/DevelopmentalAttractorEngineering',
    pathPrefix:'experiments/EXP-003-the-sixth-question',
  });
  const n4 = index.itemHistories.N4;
  assert.ok(n4);
  const pairs = eligiblePairs(n4.observations).map(orient);
  assert.equal(pairs.length,35,'pinned conservative N4 candidate-pair count');

  const coverage = Structural.aggregatePairCoverage(pairs);
  assert.ok(coverage.surfaces.reply, 'reply surface occurs in N4 history');
  assert.ok(coverage.surfaces.reflection, 'reflection surface occurs in N4 history');
  assert.equal(coverage.surfaces.reflection.both,1,'only one conservative N4 pair has reflection on both sides at pinned commit');

  const signatures = {};
  for (const [left,right] of pairs) {
    const lp = Structural.profile(left).signature || '<none>';
    const rp = Structural.profile(right).signature || '<none>';
    const key = `${lp} → ${rp}`;
    signatures[key] = (signatures[key] || 0) + 1;
  }

  console.log('PASS real-dae-structural-coverage-v0');
  console.log(JSON.stringify({
    item:'N4',
    candidatePairs:pairs.length,
    orientation:'a-left where present; otherwise lexical fork order',
    surfaceCoverage:coverage.surfaces,
    signatureTransitions:Object.entries(signatures).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([transition,count])=>({transition,count})),
  },null,2));
}

main();
