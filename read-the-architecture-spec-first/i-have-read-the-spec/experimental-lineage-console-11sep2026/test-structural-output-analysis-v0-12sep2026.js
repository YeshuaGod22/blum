'use strict';

const assert = require('assert');
const S = require('./structural-output-analysis-v0-12sep2026.js');

function obs(id, sections) {
  return {
    observationId: id,
    rawOutput: Object.entries(sections).map(([k,v]) => `<${k}>${v}</${k}>`).join(''),
    sections: Object.fromEntries(Object.entries(sections).map(([k,v]) => [k,[v]])),
    sectionIntegrity: Object.fromEntries(Object.keys(sections).map(k => [k,'cleanly_closed'])),
    callOutcome: 'complete',
  };
}

function main() {
  const a = obs('a', { reflection: 'I retain the frame.', reply: '37' });
  const zero = obs('0', { working: 'I reason without that output schema.', reply: '52' });
  const c = S.compare(a, zero);

  assert.equal(c.sameSignature, false);
  assert.deepEqual(c.sharedSections, ['reply']);
  assert.deepEqual(c.leftOnlySections, ['reflection']);
  assert.deepEqual(c.rightOnlySections, ['working']);
  assert.equal(c.sectionComparisons.reflection.leftPresent, true);
  assert.equal(c.sectionComparisons.reflection.rightPresent, false);
  assert.equal(c.sectionComparisons.reply.bothPresent, true);
  assert.ok(Number.isFinite(c.sectionComparisons.reply.absoluteCharDelta));

  const coverage = S.aggregatePairCoverage([
    [a, zero],
    [obs('a2', { reflection:'x', reply:'1' }), obs('02', { reflection:'y', reply:'2' })],
  ], ['reflection','working','reply']);
  assert.deepEqual(coverage.surfaces.reflection, { both:1, leftOnly:1, rightOnly:0, neither:0 });
  assert.deepEqual(coverage.surfaces.working, { both:0, leftOnly:0, rightOnly:1, neither:1 });
  assert.deepEqual(coverage.surfaces.reply, { both:2, leftOnly:0, rightOnly:0, neither:0 });

  console.log('PASS structural-output-analysis-v0');
  console.log(JSON.stringify({ comparison:c, coverage }, null, 2));
}

main();
