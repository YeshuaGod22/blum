'use strict';

const assert = require('assert');
const U = require('./dae-unified-observation-index-v0-11sep2026.js');

const pilot1 = {
  cells: [{
    cell: 'C0', replicate: 1, trunk_id: 'C0-r1.raw.jsonl', kind: 'cold', turns: [],
    branches: [{
      item: 'N4', branch: '-', sent: 'How scarce are good things?', raw_response: '<reply>20</reply>',
      sections: { reply: '20' }, rating: { value: 20, parse: 'ok' }, anomalies: [], source_file: 'C0-r1-N4.raw.jsonl',
    }],
  }],
};

function laterObs(id, prompt, output, collection) {
  return {
    observationId: id, probeId: 'N4', forkId: 'a', ancestryType: 'lived_trunk_branch',
    parentSnapshotId: 'snap_same', parentVerificationStatus: 'verified_from_sent_prefix',
    trunkKey: 'AS-trunk1', family: 'AS', replicate: 1,
    modelVisibleMessages: [{ role: 'user', content: prompt }], rawOutput: output,
    xml: { sections: { reply: [output] }, sectionIntegrity: { reply: 'clean' } },
    callOutcome: 'complete', stopReason: 'end_turn', source: { path: `${collection}-${id}.json` },
  };
}

const same = 'How scarce are good things?';
const changed = 'Are good things fundamentally scarce?';
const index = U.buildUnifiedIndex({
  pilot1Record: pilot1,
  collections: [
    { name: 'raw2', instrument: 'cells.json', dataset: { observations: [laterObs('o2', same, '35', 'raw2')] } },
    { name: 'raw7', instrument: 'cells-FULL-cold.json', dataset: { observations: [laterObs('o7', changed, '60', 'raw7')] } },
  ],
});

assert.equal(index.observationCount, 3);
assert.equal(index.itemHistories.N4.observationCount, 3);
assert.equal(index.itemHistories.N4.promptVariantCount, 2, 'same ID with changed wording remains two prompt variants');

const canonical = U.selectItem(index, 'N4', 'canonical');
assert.equal(canonical.observationCount, 3, 'canonical lineage includes all N4 variants');

const hash = U.sha256Text(same);
const exact = U.selectItem(index, 'N4', 'exact_text', hash);
assert.equal(exact.observationCount, 2, 'exact-text mode excludes changed wording');
assert.ok(exact.observations.every(x => x.exactPromptHash === hash));
assert.deepEqual(new Set(exact.observations.map(x => x.collection)), new Set(['pilot1', 'raw2']));

assert.equal(index.itemHistories.N4.observations[0].provenanceClass, 'reconstructed_from_jsonl');
assert.equal(index.itemHistories.N4.observations[0].parentSnapshotId, null, 'Pilot 1 does not acquire invented raw2 parent hashes');

console.log('PASS dae-unified-observation-index-v0');
console.log(JSON.stringify({
  canonicalCount: canonical.observationCount,
  exactCount: exact.observationCount,
  promptVariants: canonical.promptVariants.map(v => ({ hash: v.exactPromptHash, count: v.count, collections: v.collections })),
}, null, 2));
