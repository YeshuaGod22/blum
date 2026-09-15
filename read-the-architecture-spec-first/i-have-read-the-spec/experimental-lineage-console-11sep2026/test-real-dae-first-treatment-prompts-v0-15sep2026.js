'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Query = require('./dae-first-treatment-prompts-v0-15sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-first-treatment-prompts-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  const rows = Query.queryFirstTreatmentPrompts(index);
  const report = Query.summary(rows);
  const resolved = rows.filter(x => x.status === 'resolved');
  const conflicts = rows.filter(x => x.status === 'conflict');
  const unresolved = rows.filter(x => x.status === 'unresolved');

  if (conflicts.length) {
    console.log('TREATMENT PROMPT CONFLICTS');
    console.log(JSON.stringify(conflicts.map(row => ({
      trunkKey: row.trunkKey,
      family: row.family,
      collections: row.collections,
      candidates: (row.candidates || []).map(c => ({
        messageUid: c.messageUid,
        contentHash: c.contentHash,
        parentSnapshotId: c.parentSnapshotId,
        observationId: c.observationId,
        collection: c.collection,
        firstPromptPreview: c.content.slice(0, 220),
      })),
    })), null, 2));
  }

  assert.ok(resolved.length > 0, 'no treatment prompts resolved');
  assert.equal(conflicts.length, 0, 'verified lived-prefix treatment query must not silently contain conflicting origins');
  assert.ok(unresolved.length > 0, 'expected explicit unresolved non-lived/pilot groupings');

  for (const row of resolved) {
    assert.ok(row.firstPromptMessageId, `missing firstPromptMessageId: ${row.trunkKey}`);
    assert.ok(row.firstPrompt, `missing firstPrompt: ${row.trunkKey}`);
    assert.ok(row.parentSnapshotId, `missing parentSnapshotId: ${row.trunkKey}`);
    assert.ok(row.evidenceObservationCount > 0, `missing evidence count: ${row.trunkKey}`);
  }

  const asTrunk1 = resolved.find(x => x.trunkKey === 'AS-trunk1');
  assert.ok(asTrunk1, 'AS-trunk1 should resolve from verified lived-prefix evidence');
  assert.ok(asTrunk1.firstPrompt.startsWith('Hi Claude!'), 'AS-trunk1 first treatment prompt changed unexpectedly');

  const pilotLike = unresolved.filter(x => x.reason === 'pilot1_normalized_rows_do_not_preserve_complete_lived_prefix');
  assert.ok(pilotLike.length > 0, 'Pilot 1 provenance limitation should remain explicit');

  console.log('PASS real DAE first treatment prompt query');
  console.log(JSON.stringify({
    ...report,
    resolved: resolved.length,
    unresolved: unresolved.length,
    conflicts: conflicts.length,
    pilot1ExplicitlyUnresolved: pilotLike.length,
    sampleResolved: resolved.slice(0, 12).map(x => ({
      trunkKey: x.trunkKey,
      family: x.family,
      replicate: x.replicate,
      firstPromptMessageId: x.firstPromptMessageId,
      firstPromptPreview: x.firstPrompt.slice(0, 180),
      evidenceObservationCount: x.evidenceObservationCount,
    })),
  }, null, 2));
}

main();
