'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v0-11sep2026.js');
const Lex = require('./lexical-output-analysis-v0-12sep2026.js');

function sectionText(row, section) {
  if (!section || section === '__whole__') return String(row.rawOutput || '');
  const value = row.sections?.[section];
  if (Array.isArray(value)) return value.join('\n\n');
  return value == null ? '' : String(value);
}

function median(xs) {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function eligiblePairs(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.parentSnapshotId || !row.exactPromptHash) continue;
    const key = `${row.parentSnapshotId}|${row.exactPromptHash}`;
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
  const pairs = eligiblePairs(n4.observations);
  assert.ok(pairs.length > 0, 'at least one same-parent same-wording cross-fork N4 pair exists');

  const measurements = pairs.map(([left, right]) => {
    const l = sectionText(left, 'reply') || sectionText(left, '__whole__');
    const r = sectionText(right, 'reply') || sectionText(right, '__whole__');
    const c = Lex.compare(l, r);
    assert.ok(Number.isFinite(c.raw.unigramJaccard));
    assert.ok(Number.isFinite(c.raw.bigramJaccard));
    return {
      parentSnapshotId: left.parentSnapshotId,
      exactPromptHash: left.exactPromptHash,
      left: `${left.collection}:${left.condition}:r${left.replicate}:${left.forkId}`,
      right: `${right.collection}:${right.condition}:r${right.replicate}:${right.forkId}`,
      unigramJaccard: c.raw.unigramJaccard,
      bigramJaccard: c.raw.bigramJaccard,
    };
  });

  const uni = measurements.map(x => x.unigramJaccard);
  const bi = measurements.map(x => x.bigramJaccard);
  console.log('PASS real-dae-lexical-analysis-v0');
  console.log(JSON.stringify({
    item: 'N4',
    eligiblePairCount: measurements.length,
    rule: 'same parentSnapshotId + same exactPromptHash + different forkId',
    replyPreferredWithWholeFallback: true,
    unigramJaccard: { min: Math.min(...uni), median: median(uni), max: Math.max(...uni) },
    bigramJaccard: { min: Math.min(...bi), median: median(bi), max: Math.max(...bi) },
    examples: measurements.slice(0, 5),
  }, null, 2));
}

main();
