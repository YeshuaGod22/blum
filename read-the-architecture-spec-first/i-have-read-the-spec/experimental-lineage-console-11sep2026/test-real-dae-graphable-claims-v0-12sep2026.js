'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Audit = require('./graphable-claim-audit-v0-12sep2026.js');

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('usage: node test-real-dae-graphable-claims-v0-12sep2026.js <DAE-repo-root>');
  const expRoot = path.join(daeRoot, 'experiments', 'EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(expRoot, {
    repository:'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit:'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix:'experiments/EXP-003-the-sixth-question',
  });
  const audit = Audit.auditIndex(index);

  assert.ok(audit.exactParentPairCount > 0, 'archive contains exact-parent cross-fork pairs');
  assert.ok(audit.graphablePairCount > 0, 'at least one exact-parent answer pair is directly graphable');
  assert.ok(audit.candidateClaimCount > 0, 'at least one graph-backed descriptive claim is surfaced');
  assert.ok(audit.candidateClaims.every(c => c.causalMeaning === 'undeclared_until_design_map'),
    'audit never invents causal semantics from fork labels');
  assert.ok(audit.items.every(i => i.strata.every(s => s.collection && s.itemCoreHash && s.forkContrast)),
    'every stratum retains collection, exact item wording, and fork contrast');

  const top = audit.items.filter(x => x.graphablePairCount > 0).slice(0, 15).map(i => ({
    item:i.itemId,
    exactParentPairs:i.exactParentPairCount,
    graphablePairs:i.graphablePairCount,
    claimCount:i.candidateClaims.length,
    strata:i.strata.slice(0,8).map(s => ({
      collection:s.collection,
      contrast:s.forkContrast,
      n:s.exactParentPairCount,
      graphable:s.graphablePairCount,
      types:s.outcomeTypeCounts,
      claims:s.candidateClaims.map(c => ({class:c.claimClass,n:c.n,text:c.text,statistic:c.statistic,drawableBy:c.drawableBy})),
    })),
  }));

  console.log('PASS real-dae-graphable-claims-v0');
  console.log(JSON.stringify({
    items:audit.itemCount,
    itemsWithExactParentPairs:audit.itemsWithExactParentPairs,
    itemsWithGraphableClaims:audit.itemsWithGraphableClaims,
    exactParentPairs:audit.exactParentPairCount,
    graphablePairs:audit.graphablePairCount,
    candidateClaims:audit.candidateClaimCount,
    policy:audit.policy,
    top,
  }, null, 2));
}

main();
