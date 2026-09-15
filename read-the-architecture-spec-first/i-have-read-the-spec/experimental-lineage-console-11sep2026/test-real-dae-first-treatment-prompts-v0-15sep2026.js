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
  const notApplicable = rows.filter(x => x.status === 'not_applicable');

  assert.ok(resolved.length > 0, 'no treatment prompts resolved');
  assert.equal(conflicts.length, 0, 'verified treatment instances must not contain conflicting origins');
  assert.ok(notApplicable.length > 0, 'expected no-lived-parent-by-design groups');
  assert.ok(unresolved.length > 0, 'expected at least Pilot 1 historical-context gaps');

  for (const row of resolved) {
    assert.equal(row.developmentalOriginClass, 'verified_lived_origin');
    assert.ok(row.firstPromptMessageId, `missing firstPromptMessageId: ${row.trunkKey}`);
    assert.ok(row.firstPrompt, `missing firstPrompt: ${row.trunkKey}`);
    assert.ok(row.parentSnapshotId, `missing parentSnapshotId: ${row.trunkKey}`);
    assert.ok(row.evidenceObservationCount > 0, `missing evidence count: ${row.trunkKey}`);
  }

  for (const row of notApplicable) {
    assert.equal(row.developmentalOriginClass, 'no_lived_parent_by_design');
    assert.ok(['resolved', 'multiple'].includes(row.firstAdministeredInput?.status), `cold group lacks recoverable administered input: ${row.collection}/${row.trunkKey}`);
  }

  const pilotLike = unresolved.filter(x => x.developmentalOriginClass === 'incomplete_historical_context');
  assert.ok(pilotLike.length > 0, 'Pilot 1 provenance limitation should remain explicit');
  const lineageUnverified = unresolved.filter(x => x.developmentalOriginClass === 'lineage_unverified');
  const other = unresolved.filter(x => x.developmentalOriginClass === 'other_unresolved');
  assert.equal(other.length, 0, 'all unresolved groups should have a specific mechanistic class');

  const asTrunk1 = resolved.find(x => x.trunkKey === 'AS-trunk1');
  assert.ok(asTrunk1, 'AS-trunk1 should resolve from verified lived-prefix evidence');
  assert.ok(asTrunk1.firstPrompt.startsWith('Hi Claude!'), 'AS-trunk1 first treatment prompt changed unexpectedly');

  console.log('PASS real DAE treatment-origin resolution census');
  console.log(JSON.stringify({
    ...report,
    resolved: resolved.length,
    notApplicable: notApplicable.length,
    unresolved: unresolved.length,
    conflicts: conflicts.length,
    pilot1IncompleteHistoricalContext: pilotLike.length,
    lineageUnverified: lineageUnverified.length,
    otherUnresolved: other.length,
    notApplicableByAncestry: Object.fromEntries([...new Set(notApplicable.flatMap(x => x.ancestryTypes || []))].sort().map(type => [type, notApplicable.filter(x => (x.ancestryTypes || []).includes(type)).length])),
    unresolvedDetails: unresolved.map(x => ({
      collection: x.collection,
      trunkKey: x.trunkKey,
      family: x.family,
      developmentalOriginClass: x.developmentalOriginClass,
      reason: x.reason,
      ancestryTypes: x.ancestryTypes,
      firstAdministeredInputStatus: x.firstAdministeredInput?.status,
    })),
  }, null, 2));
}

main();
