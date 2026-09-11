'use strict';

const assert = require('assert');
const path = require('path');
const cli = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-raw2-integration-v0-11sep2026.js <DAE-repo-root>');

  const raw2 = path.join(daeRoot, 'experiments', 'EXP-003-the-sixth-question', 'raw2');
  const dataset = cli.importDirectory(raw2, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    pathPrefix: 'experiments/EXP-003-the-sixth-question/raw2',
  });

  // Diagnostic is deliberately printed before assertions. If the independent
  // corpus census and importer disagree, expose the skipped/error population
  // rather than weakening the expectation until the test turns green.
  console.log('REAL RAW2 DIAGNOSTIC');
  console.log(JSON.stringify({
    summary: dataset.summary,
    skipped: dataset.skipped,
    errors: dataset.errors,
  }, null, 2));

  // Independent corpus-map expectations, not values invented by this importer.
  assert.equal(dataset.summary.rawCallsImported, 42, 'raw2 corpus map records 42 completed calls');
  assert.equal(dataset.summary.messageSnapshotsSkipped, 2, 'raw2 corpus map records two snapshots');
  assert.equal(dataset.summary.parseErrors, 0, 'all raw2 call records parse/import cleanly');
  assert.equal(dataset.errors.length, 0);

  const exact = dataset.contrasts.filter(x => x.contrastType === 'exact_shared_parent');
  assert.ok(exact.length > 0, 'real raw2 must expose at least one verified exact shared-parent contrast');
  assert.ok(exact.some(x => {
    const forks = new Set([String(x.leftForkId), String(x.rightForkId)]);
    return forks.has('a') && forks.has('b');
  }), 'real raw2 includes an exact a↔b sibling contrast verified from archived sent prefixes');

  const asN4 = dataset.contrasts.find(x => x.probeId === 'N4' && new Set([String(x.leftForkId), String(x.rightForkId)]).has('a') && new Set([String(x.leftForkId), String(x.rightForkId)]).has('b'));
  assert.ok(asN4, 'an N4 a↔b contrast is reconstructed from real raw2 records');
  assert.equal(asN4.contrastType, 'exact_shared_parent');

  console.log('PASS real-dae-raw2-integration-v0');
  console.log(JSON.stringify({
    summary: dataset.summary,
    exactContrastCount: exact.length,
    exampleExactN4: asN4,
  }, null, 2));
}

main();