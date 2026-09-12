'use strict';

const assert = require('assert');
const A = require('./answer-outcome-projection-v0-12sep2026.js');

const structured = {
  observationId:'a',
  rawOutput:'<reflection>thinking</reflection><reply>37</reply>',
  sections:{reflection:'thinking',reply:'37'},
};
const plain = {
  observationId:'0',
  rawOutput:'52',
  sections:{},
};
const malformedStructured = {
  observationId:'bad',
  rawOutput:'<reflection>thinking only</reflection>',
  sections:{reflection:'thinking only'},
};

const pair = A.projectPair(structured, plain);
assert.equal(pair.comparable, true);
assert.equal(pair.left.text, '37');
assert.equal(pair.left.source, 'reply_section');
assert.equal(pair.right.text, '52');
assert.equal(pair.right.source, 'plain_response');

const bad = A.project(malformedStructured);
assert.equal(bad.status, 'missing');
assert.equal(bad.reason, 'structured_output_without_designated_answer');
assert.equal(bad.text, null);

console.log('PASS answer-outcome-projection-v0');
console.log(JSON.stringify({pair,bad}, null, 2));
