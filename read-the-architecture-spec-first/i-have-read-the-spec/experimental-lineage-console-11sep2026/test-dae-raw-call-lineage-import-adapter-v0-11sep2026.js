'use strict';

const assert = require('assert');
const A = require('./dae-raw-call-lineage-import-adapter-v0-11sep2026.js');

const sharedPrefix = [
  { role: 'user', content: 'Q1' },
  { role: 'assistant', content: '<reply>A1</reply><reflection>R1</reflection>' },
  { role: 'user', content: 'Q2' },
  { role: 'assistant', content: '<reply>A2</reply><reflection>R2</reflection>' },
];

function branch({ cell, branch, answer, prefix = sharedPrefix, stop_reason = 'end_turn', received = null }) {
  return {
    cell,
    replicate: 1,
    item: 'N4',
    kind: 'branch',
    branch,
    parent_prefix: 'AS-trunk1.messages.json',
    prefix_len: prefix.length,
    sent: [
      ...prefix,
      { role: 'user', content: branch === 'a' ? 'Maintain schema.' : 'Drop schema.' },
      { role: 'user', content: 'N4 shared probe' },
    ],
    received: received || `<reflection>${branch} reflection</reflection><reply>${answer}</reply>`,
    stop_reason,
    served_model: 'claude-opus-test',
    usage: { output_tokens: 100 },
    system_prompt: 'historical recorded system prompt',
  };
}

function main() {
  const a = A.importBranchRecord(branch({ cell: 'ASa', branch: 'a', answer: '37' }), {
    path: 'raw2/ASa-r1-N4.json', commit: 'fixture',
  });
  const b = A.importBranchRecord(branch({ cell: 'ASb', branch: 'b', answer: '52' }), {
    path: 'raw2/ASb-r1-N4.json', commit: 'fixture',
  });

  assert.equal(a.parentVerificationStatus, 'verified_from_sent_prefix');
  assert.equal(a.parentSnapshotId, b.parentSnapshotId, 'same exact sent prefix yields same parent snapshot');
  assert.equal(a.parentSnapshot.contentHash, b.parentSnapshot.contentHash);
  assert.equal(a.declaredParentPrefix, 'AS-trunk1.messages.json');

  const exact = A.compareBranchParentage(a, b);
  assert.equal(exact.contrastType, 'exact_shared_parent');
  assert.equal(exact.exactSharedParent, true);
  assert.equal(exact.declaredPrefixAgreement, true);

  // Adversarial case: same declared filename, different actual model-visible prefix.
  const alteredPrefix = JSON.parse(JSON.stringify(sharedPrefix));
  alteredPrefix[3].content = '<reply>DIFFERENT</reply><reflection>R2</reflection>';
  const impostor = A.importBranchRecord(branch({ cell: 'ASb', branch: 'b', answer: '52', prefix: alteredPrefix }), {
    path: 'raw2/impostor.json', commit: 'fixture',
  });
  const mismatch = A.compareBranchParentage(a, impostor);
  assert.equal(mismatch.contrastType, 'cross_parent_exploratory');
  assert.equal(mismatch.exactSharedParent, false);
  assert.equal(mismatch.reason, 'model_visible_prefix_hash_mismatch');

  // DAE raw12-style truncation: call-level outcome and section integrity are independent.
  const truncated = {
    cell: 'H', replicate: 1, turn: 5, kind: 'trunk', question_id: 'Q5',
    sent: [{ role: 'user', content: 'question' }],
    received: '<priming>ok</priming><reply>usable answer</reply><reflection>tail cut here',
    stop_reason: 'max_tokens', usage: { output_tokens: 8192 },
  };
  const t = A.importTrunkRecord(truncated, { path: 'raw12/H-r1-t5.json', commit: 'fixture' });
  assert.equal(t.callOutcome, 'truncated');
  assert.equal(t.xml.sectionIntegrity.priming, 'clean');
  assert.equal(t.xml.sectionIntegrity.reply, 'clean');
  assert.equal(t.xml.sectionIntegrity.reflection, 'recovered_unclosed');
  assert.equal(t.xml.sections.reply[0], 'usable answer');
  assert.ok(t.xml.sections.reflection[0].includes('tail cut here'));

  // Missing prefix metadata must never be promoted to exact by matching labels.
  const noPrefix = branch({ cell: 'ASa', branch: 'a', answer: '1' });
  delete noPrefix.prefix_len;
  const unverified = A.importBranchRecord(noPrefix, { path: 'rawX/no-prefix.json' });
  assert.equal(unverified.parentVerificationStatus, 'unverified');
  const uncertain = A.compareBranchParentage(unverified, b);
  assert.equal(uncertain.contrastType, 'parent_match_unverified');

  const set = A.importBranchSet([
    { record: branch({ cell: 'ASa', branch: 'a', answer: '37' }), source: { path: 'ASa-r1-N4.json' } },
    { record: branch({ cell: 'ASb', branch: 'b', answer: '52' }), source: { path: 'ASb-r1-N4.json' } },
  ]);
  assert.equal(set.observations.length, 2);
  assert.equal(set.contrasts.length, 1);
  assert.equal(set.contrasts[0].contrastType, 'exact_shared_parent');

  console.log('PASS dae-raw-call-lineage-import-adapter-v0');
  console.log(JSON.stringify({
    exactParent: exact.parentSnapshotId,
    adversarialMismatch: mismatch.contrastType,
    truncatedCallOutcome: t.callOutcome,
    reflectionIntegrity: t.xml.sectionIntegrity.reflection,
  }, null, 2));
}

main();
