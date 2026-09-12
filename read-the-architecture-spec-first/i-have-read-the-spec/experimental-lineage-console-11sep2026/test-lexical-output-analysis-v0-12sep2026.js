'use strict';

const assert = require('assert');
const L = require('./lexical-output-analysis-v0-12sep2026.js');

function main() {
  const a = 'The schema preserves moral continuity. Schema continuity remains salient.';
  const b = 'The schema preserves epistemic distance. Schema distance remains salient.';
  const c = 'Moral continuity survives even when the named scaffold disappears.';
  const d = 'Moral continuity survives even when explicit terminology disappears.';

  const leakHeavy = L.compare(a, b, { ablationTerms: ['schema', 'salient', 'remains', 'preserves'] });
  assert.ok(leakHeavy.raw.unigramJaccard > leakHeavy.afterAblation.unigramJaccard,
    'shared schema vocabulary should inflate raw unigram overlap in this fixture');
  assert.ok(leakHeavy.ablation.leftRemoved > 0 && leakHeavy.ablation.rightRemoved > 0,
    'ablation removes declared terms from both sides');

  const survives = L.compare(c, d, { ablationTerms: ['scaffold', 'terminology', 'explicit', 'named'] });
  assert.ok(survives.afterAblation.unigramJaccard > 0.45,
    'substantial lexical overlap survives removal of framing vocabulary');
  assert.ok(survives.afterAblation.sharedTokens.includes('continuity'));
  assert.ok(survives.afterAblation.sharedTokens.includes('survives'));

  const p = L.profile('One one TWO; two three.');
  assert.equal(p.tokenCount, 5);
  assert.equal(p.uniqueTokenCount, 3);
  assert.ok(p.repeatedBigrams.some(x => x.gram === 'one one') === false,
    'a one-off bigram is not marked repeated');

  const frequencies = L.corpusTermFrequencies([
    'schema continuity persists',
    'continuity persists without schema',
    'novel term',
  ]);
  const continuity = frequencies.rows.find(x => x.term === 'continuity');
  assert.equal(continuity.documentCount, 2);
  assert.equal(continuity.tokenCount, 2);

  console.log('PASS lexical-output-analysis-v0');
  console.log(JSON.stringify({
    leakHeavy: {
      rawUnigramJaccard: leakHeavy.raw.unigramJaccard,
      afterAblationUnigramJaccard: leakHeavy.afterAblation.unigramJaccard,
      removed: [leakHeavy.ablation.leftRemoved, leakHeavy.ablation.rightRemoved],
    },
    survives: {
      afterAblationUnigramJaccard: survives.afterAblation.unigramJaccard,
      sharedTokens: survives.afterAblation.sharedTokens,
    },
  }, null, 2));
}

main();
