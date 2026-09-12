'use strict';

const assert = require('assert');
const P = require('./output-surface-projection-v0-12sep2026.js');

function obs(id, sections, rawOutput = 'WHOLE') {
  return {
    observationId: id,
    rawOutput,
    sections,
    sectionIntegrity: Object.fromEntries(Object.keys(sections || {}).map(k => [k, 'cleanly_closed'])),
    callOutcome: 'complete',
  };
}

function main() {
  const left = obs('L', { reflection: ['left reflection'], reply: ['37'] }, '<reflection>left reflection</reflection><reply>37</reply>');
  const right = obs('R', { reply: ['52'] }, '<reply>52</reply>');

  const reflection = P.projectPair(left, right, 'reflection');
  assert.equal(reflection.comparable, false);
  assert.equal(reflection.left.status, 'ok');
  assert.equal(reflection.right.status, 'missing');
  assert.equal(reflection.right.text, null);
  assert.equal(reflection.surface, 'reflection');

  const whole = P.projectPair(left, right, '__whole__');
  assert.equal(whole.comparable, true);
  assert.ok(whole.left.text.includes('left reflection'));
  assert.ok(whole.right.text.includes('52'));

  const reply = P.projectPair(left, right, 'reply');
  assert.equal(reply.comparable, true);
  assert.equal(reply.left.text, '37');
  assert.equal(reply.right.text, '52');

  assert.deepEqual(P.availableOnBoth(left, right), ['reply']);

  console.log('PASS output-surface-projection-v0');
  console.log(JSON.stringify({ reflection, reply, wholeComparable: whole.comparable }, null, 2));
}

main();
