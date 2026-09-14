'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Lex = require('./lexical-output-analysis-v1-12sep2026.js');
const Surface = require('./output-surface-projection-v0-12sep2026.js');

function median(xs) {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function eligiblePairs(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.collection || !row.parentSnapshotId || !row.itemCoreHash) continue;
    const key = `${row.collection}|${row.parentSnapshotId}|${row.itemCoreHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].forkId === group[j].forkId) continue;
        out.push([group[i], group[j]]);
      }
    }
  }
  return out;
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-lexical-analysis-v0-12sep2026.js <DAE-repo-root>');
  const expRoot = path.join(daeRoot, 'experiments', 'EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(expRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });
  const n4 = index.itemHistories.N4;
  assert.ok(n4, 'N4 history exists');
  assert.equal(n4.observationCount, 107, 'pinned corpus still has 107 N4 observations');
  assert.ok(n4.presentationVariantCount > n4.itemCoreVariantCount,
    'condition-specific presentations produce more variants than extracted battery item cores');

  const pairs = eligiblePairs(n4.observations);
  assert.ok(pairs.length > 0, 'at least one same-collection same-parent same-item-core cross-fork N4 pair exists');
  assert.ok(pairs.every(([l, r]) => l.collection === r.collection), 'no cross-collection pseudo-siblings enter primary lexical comparison');

  const requestedSurface = 'reflection';
  const measurements = [];
  const missingSurface = [];
  const nonProse = [];

  for (const [left, right] of pairs) {
    const projection = Surface.projectPair(left, right, requestedSurface);
    const row = {
      collection: left.collection,
      parentSnapshotId: left.parentSnapshotId,
      itemCoreHash: left.itemCoreHash,
      presentationHashesEqual: left.presentationHash === right.presentationHash,
      left: `${left.condition}:r${left.replicate}:${left.forkId}`,
      right: `${right.condition}:r${right.replicate}:${right.forkId}`,
      surface: requestedSurface,
      leftSurfaceStatus: projection.left.status,
      rightSurfaceStatus: projection.right.status,
    };
    if (!projection.comparable) {
      missingSurface.push({ ...row, reason: projection.reason });
      continue;
    }
    const c = Lex.compare(projection.left.text, projection.right.text);
    if (!c.applicability.pairProseEligible || !c.raw.unigramJaccard.applicable) {
      nonProse.push({ ...row, reason: c.applicability.reason });
      continue;
    }
    measurements.push({
      ...row,
      unigramJaccard: c.raw.unigramJaccard.value,
      bigramJaccard: c.raw.bigramJaccard.applicable ? c.raw.bigramJaccard.value : null,
    });
  }

  assert.ok(measurements.length > 0, 'at least one real N4 sibling pair has comparable reflection prose');
  assert.ok(measurements.every(x => x.surface === 'reflection'), 'every metric is reflection-to-reflection');
  assert.ok(measurements.every(x => x.leftSurfaceStatus === 'ok' && x.rightSurfaceStatus === 'ok'), 'every measured pair has the requested section on both sides');
  assert.ok(measurements.some(x => !x.presentationHashesEqual),
    'real siblings can share item-core wording while differing in presentation framing');

  const uni = measurements.map(x => x.unigramJaccard).filter(Number.isFinite);
  const bi = measurements.map(x => x.bigramJaccard).filter(Number.isFinite);
  console.log('PASS real-dae-lexical-analysis-v2-symmetric-surface');
  console.log(JSON.stringify({
    item: 'N4',
    observations: n4.observationCount,
    itemCoreVariants: n4.itemCoreVariantCount,
    presentationVariants: n4.presentationVariantCount,
    eligiblePairCount: pairs.length,
    requestedSurface,
    comparableSurfacePairCount: measurements.length + nonProse.length,
    proseApplicablePairCount: measurements.length,
    nonProsePairCount: nonProse.length,
    missingSurfacePairCount: missingSurface.length,
    rule: 'same collection + same parentSnapshotId + same itemCoreHash + different forkId',
    surfacePolicy: 'locked symmetric projection; no fallback',
    unigramJaccard: { min: Math.min(...uni), median: median(uni), max: Math.max(...uni) },
    bigramJaccard: bi.length ? { min: Math.min(...bi), median: median(bi), max: Math.max(...bi) } : null,
    examples: measurements.slice(0, 5),
    missingSurfaceExamples: missingSurface.slice(0, 5),
    nonProseExamples: nonProse.slice(0, 5),
  }, null, 2));
}

main();
