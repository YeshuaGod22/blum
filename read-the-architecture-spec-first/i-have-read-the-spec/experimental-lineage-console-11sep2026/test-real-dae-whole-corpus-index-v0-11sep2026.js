'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v0-11sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-whole-corpus-index-v0-11sep2026.js <DAE-repo-root>');
  const exp = path.join(daeRoot, 'experiments', 'EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(exp, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  assert.ok(index.source.pilot1RecordPresent, 'Pilot 1 validated record.json is included');
  assert.ok(index.collectionDiscovery.includes('pilot1'), 'Pilot 1 appears in collection discovery');
  assert.ok(index.collectionDiscovery.includes('raw2'), 'raw2 is included');
  assert.ok(index.collectionDiscovery.includes('raw12'), 'raw12 is included');
  assert.ok(index.observationCount > 1000, 'whole-corpus battery observation index is substantial');

  const n4 = index.itemHistories.N4;
  assert.ok(n4, 'N4 exists in unified item history');
  assert.ok(n4.observationCount > 10, 'N4 has many historical observations');
  assert.ok(n4.collections.length > 1, 'N4 spans multiple historical collections');
  assert.ok(n4.promptVariantCount >= 1, 'N4 retains literal prompt variant identity');

  const pilotRows = n4.observations.filter(x => x.collection === 'pilot1');
  assert.ok(pilotRows.length > 0, 'Pilot 1 N4 rows are present');
  assert.ok(pilotRows.every(x => x.provenanceClass === 'reconstructed_from_jsonl'));
  assert.ok(pilotRows.every(x => x.parentSnapshotId === null), 'Pilot 1 never receives invented raw2 parent hashes');

  const rawRows = n4.observations.filter(x => /^raw\d+$/.test(x.collection));
  assert.ok(rawRows.length > 0, 'rawN N4 rows are present');
  assert.ok(rawRows.every(x => x.provenanceClass === 'raw_call_record'));

  console.log('PASS real-dae-whole-corpus-index-v0');
  console.log(JSON.stringify({
    observations: index.observationCount,
    items: index.itemCount,
    collections: index.collections,
    discovered: index.collectionDiscovery,
    N4: {
      observations: n4.observationCount,
      collections: n4.collections,
      promptVariants: n4.promptVariants.map(v => ({ hash: v.exactPromptHash, count: v.count, collections: v.collections })),
    },
    largestItemHistories: Object.values(index.itemHistories)
      .sort((a, b) => b.observationCount - a.observationCount)
      .slice(0, 10)
      .map(h => ({ item: h.canonicalItemId, observations: h.observationCount, promptVariants: h.promptVariantCount })),
  }, null, 2));
}

main();
