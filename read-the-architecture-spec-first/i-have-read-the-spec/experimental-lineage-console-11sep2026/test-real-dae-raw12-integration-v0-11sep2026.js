'use strict';

const assert = require('assert');
const path = require('path');
const cli = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');

function basename(p) {
  return String(p || '').split('/').pop();
}

function countOutcomes(records) {
  return (records || []).reduce((counts, record) => {
    counts[record.callOutcome] = (counts[record.callOutcome] || 0) + 1;
    return counts;
  }, {});
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-raw12-integration-v0-11sep2026.js <DAE-repo-root>');

  const raw12 = path.join(daeRoot, 'experiments', 'EXP-003-the-sixth-question', 'raw12');
  const dataset = cli.importDirectory(raw12, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    pathPrefix: 'experiments/EXP-003-the-sixth-question/raw12',
  });
  const trunkOutcomeCounts = countOutcomes(dataset.trunkTurns);

  console.log('REAL RAW12 DIAGNOSTIC');
  console.log(JSON.stringify({
    summary: dataset.summary,
    trunkOutcomeCounts,
    errors: dataset.errors,
    skippedCount: dataset.skipped.length,
  }, null, 2));

  // Independent expectations from RAW12-LONGITUDINAL-SUMMARY.json apply to
  // the longitudinal trunk surface, not to the 744 branch observations that
  // happen to live in the same raw12 directory.
  assert.equal(dataset.trunkTurns.length, 108, 'raw12 longitudinal summary records 108 trunk turn rows');
  assert.equal(trunkOutcomeCounts.complete, 107, '107 raw12 trunk turns ended normally');
  assert.equal(trunkOutcomeCounts.truncated, 1, 'one raw12 trunk turn stopped at max_tokens');
  assert.equal(dataset.summary.parseErrors, 0, 'raw12 records import without JSON/import errors');

  const truncated = dataset.trunkTurns.filter(x => x.callOutcome === 'truncated');
  assert.equal(truncated.length, 1, 'exactly one truncated trunk turn');
  assert.equal(basename(truncated[0].source.path), 'H-r1-t5.json', 'H-r1-t5 is the sole max_tokens turn');
  assert.equal(truncated[0].stopReason, 'max_tokens');
  assert.equal(truncated[0].usage.output_tokens, 8192);

  // The longitudinal evidence builder records reply parser recovery on these rows.
  const f38 = dataset.trunkTurns.find(x => basename(x.source.path) === 'F-r3-t8.json');
  const f39 = dataset.trunkTurns.find(x => basename(x.source.path) === 'F-r3-t9.json');
  assert.ok(f38, 'F-r3-t8 exists');
  assert.ok(f39, 'F-r3-t9 exists');
  assert.equal(f38.xml.sectionIntegrity.reply, 'recovered_unclosed', 'F-r3-t8 reply is present but unclosed');
  assert.equal(f39.xml.sectionIntegrity.reply, 'recovered_unclosed', 'F-r3-t9 reply is present but unclosed');
  assert.ok(f38.xml.sections.reply?.[0]?.length > 0, 'F-r3-t8 recovered reply text is retained');
  assert.ok(f39.xml.sections.reply?.[0]?.length > 0, 'F-r3-t9 recovered reply text is retained');

  // H-r1-t5 should preserve completed earlier sections even though the call truncates.
  assert.ok(truncated[0].xml.presentTags.includes('reply'), 'truncated row retains reply section presence');
  assert.ok(truncated[0].xml.sections.reply?.[0]?.length > 0, 'truncated row retains usable reply text');

  console.log('PASS real-dae-raw12-integration-v0');
  console.log(JSON.stringify({
    summary: dataset.summary,
    trunkOutcomeCounts,
    truncated: {
      source: truncated[0].source.path,
      stopReason: truncated[0].stopReason,
      outputTokens: truncated[0].usage.output_tokens,
      presentTags: truncated[0].xml.presentTags,
      unclosedTags: truncated[0].xml.unclosedTags,
    },
    recoveredReplyRows: [
      { source: f38.source.path, integrity: f38.xml.sectionIntegrity.reply },
      { source: f39.source.path, integrity: f39.xml.sectionIntegrity.reply },
    ],
  }, null, 2));
}

main();