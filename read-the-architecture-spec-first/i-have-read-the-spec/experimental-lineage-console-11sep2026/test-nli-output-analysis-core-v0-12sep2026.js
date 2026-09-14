'use strict';

const assert = require('assert');
const N = require('./nli-output-analysis-core-v0-12sep2026.js');

async function main() {
  const calls = [];
  async function classify({ premise, hypothesis, direction }) {
    calls.push({ premise, hypothesis, direction });
    if (direction === 'left_to_right') return {
      label: 'entailment',
      scores: { entailment: 0.91, neutral: 0.08, contradiction: 0.01 },
    };
    return {
      label: 'neutral',
      scores: { entailment: 0.20, neutral: 0.77, contradiction: 0.03 },
    };
  }

  const result = await N.compare(
    'All moral patients deserve consideration.',
    'Some moral patients deserve consideration.',
    {
      classify,
      provenance: { provider: 'mock', model: 'mock-nli-v1', version: 'test' },
      metadata: { item: 'N4', surface: 'reflection' },
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].direction, 'left_to_right');
  assert.equal(calls[1].direction, 'right_to_left');
  assert.equal(result.forward.label, 'entailment');
  assert.equal(result.reverse.label, 'neutral');
  assert.equal(result.relation, 'left_more_specific_or_equivalent');
  assert.equal(result.provenance.model, 'mock-nli-v1');

  const empty = await N.compare('', 'text', { classify });
  assert.equal(empty.applicable, false);
  assert.equal(empty.reason, 'empty_surface');
  assert.equal(calls.length, 2, 'empty comparison must not call provider');

  await assert.rejects(
    () => N.compare('a', 'b', { classify: async () => ({ label: 'maybe' }) }),
    /unsupported_nli_label/
  );
  await assert.rejects(
    () => N.compare('a', 'b', { classify: async () => ({ label: 'neutral', scores: { entailment: 0.1, neutral: NaN, contradiction: 0.9 } }) }),
    /nli_scores_must_be_finite/
  );

  console.log('PASS nli-output-analysis-core-v0');
  console.log(JSON.stringify({
    forward: result.forward,
    reverse: result.reverse,
    relation: result.relation,
    provenance: result.provenance,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error); process.exit(1); });
