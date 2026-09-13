'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cli = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');

const prefix = [
  { role: 'user', content: 'Q1' },
  { role: 'assistant', content: '<reply>A1</reply><reflection>R1</reflection>' },
];

function write(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2));
}

function branch(cell, branch, answer) {
  return {
    cell, replicate: 1, item: 'N4', kind: 'branch', branch,
    parent_prefix: 'AS-trunk1.messages.json', prefix_len: prefix.length,
    sent: [...prefix, { role: 'user', content: branch === 'a' ? 'maintain' : 'drop' }, { role: 'user', content: 'N4' }],
    received: `<reflection>${branch} reflection</reflection><reply>${answer}</reply>`,
    stop_reason: 'end_turn',
  };
}

function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blum-dae-corpus-test-'));
  try {
    write(dir, 'AS-trunk1.messages.json', prefix); // Must NOT become a raw call.
    write(dir, 'AS-r1-t1.json', {
      cell: 'AS', replicate: 1, turn: 1, kind: 'trunk', question_id: 'Q1',
      sent: [{ role: 'user', content: 'Q1' }],
      received: '<reply>trunk answer</reply><reflection>trunk reflection</reflection>',
      stop_reason: 'end_turn',
    });
    write(dir, 'H-r1-t5.json', {
      cell: 'H', replicate: 1, turn: 5, kind: 'trunk', question_id: 'Q5',
      sent: [{ role: 'user', content: 'Q5' }],
      received: '<reply>usable</reply><reflection>tail truncated',
      stop_reason: 'max_tokens', usage: { output_tokens: 8192 },
    });
    write(dir, 'ASa-r1-N4.json', branch('ASa', 'a', '37'));
    write(dir, 'ASb-r1-N4.json', branch('ASb', 'b', '52'));
    write(dir, 'FQ-r1-D1.json', {
      cell: 'FQ', replicate: 1, item: 'D1', kind: 'cold_schema', branch: null,
      sent: [{ role: 'user', content: 'female-luminary schema then D1' }],
      received: '<debate>x</debate><reply>60</reply>', stop_reason: 'end_turn',
    });
    write(dir, 'config.json', { not: 'a raw call' });

    const dataset = cli.importDirectory(dir, { repository: 'fixture/repo', commit: 'abc123', pathPrefix: 'raw2' });

    assert.equal(dataset.filesSeen, 7);
    assert.equal(dataset.trunkTurns.length, 2);
    assert.equal(dataset.branchObservations.length, 2);
    assert.equal(dataset.coldObservations.length, 1);
    assert.equal(dataset.coldObservations[0].family, 'FQ');
    assert.equal(dataset.coldObservations[0].ancestryType, 'cold_schema_no_lived_parent');
    assert.equal(dataset.contrasts.length, 1);
    assert.equal(dataset.contrasts[0].contrastType, 'exact_shared_parent');
    assert.equal(dataset.summary.rawCallsImported, 5);
    assert.equal(dataset.summary.coldSchemaObservations, 1);
    assert.equal(dataset.summary.messageSnapshotsSkipped, 1);
    assert.equal(dataset.summary.unsupportedJsonSkipped, 1);
    assert.equal(dataset.summary.parseErrors, 0);
    assert.equal(dataset.summary.callOutcomeCounts.complete, 4);
    assert.equal(dataset.summary.callOutcomeCounts.truncated, 1);
    assert.equal(dataset.summary.sectionIntegrityExceptions, 1);

    const damaged = dataset.trunkTurns.find(x => x.stopReason === 'max_tokens');
    assert.equal(damaged.xml.sectionIntegrity.reply, 'clean');
    assert.equal(damaged.xml.sectionIntegrity.reflection, 'recovered_unclosed');

    assert.ok(dataset.skipped.some(x => x.path === 'AS-trunk1.messages.json' && x.reason === 'message_snapshot_not_call'));
    assert.ok(dataset.skipped.some(x => x.path === 'config.json' && x.reason === 'unsupported_record_kind'));
    assert.ok(!dataset.skipped.some(x => x.path === 'FQ-r1-D1.json'));

    console.log('PASS dae-corpus-lineage-import-cli-v0');
    console.log(JSON.stringify(dataset.summary, null, 2));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main();
