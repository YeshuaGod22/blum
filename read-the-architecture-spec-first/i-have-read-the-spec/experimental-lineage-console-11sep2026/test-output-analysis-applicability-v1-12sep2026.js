'use strict';

const assert = require('assert');
const Lex = require('./lexical-output-analysis-v1-12sep2026.js');
const Beh = require('./behavioral-output-analysis-v0-12sep2026.js');

function main() {
  const numericLex = Lex.compare('<reply>37</reply>', '<reply>52</reply>');
  assert.equal(numericLex.applicability.pairProseEligible, false);
  assert.equal(numericLex.applicability.reason, 'behavioral_surface');
  assert.equal(numericLex.raw.bigramJaccard.applicable, false);
  assert.equal(numericLex.raw.bigramJaccard.value, null);

  const numericBeh = Beh.compare('<reply>37</reply>', '<reply>52</reply>');
  assert.equal(numericBeh.applicable, true);
  assert.equal(numericBeh.bothNumeric, true);
  assert.equal(numericBeh.signedDelta, 15);
  assert.equal(numericBeh.absoluteDelta, 15);
  assert.equal(numericBeh.exactMatch, false);

  const sentinelLex = Lex.compare('ALWAYS', 'NEVER');
  assert.equal(sentinelLex.applicability.pairProseEligible, false);
  assert.equal(sentinelLex.applicability.reason, 'behavioral_surface');

  const sentinelBeh = Beh.compare('ALWAYS', 'NEVER');
  assert.equal(sentinelBeh.applicable, true);
  assert.equal(sentinelBeh.bothSentinel, true);
  assert.equal(sentinelBeh.sentinelAgreement, false);

  const prose = Lex.compare('Moral continuity persists beyond explicit framing.', 'Moral continuity persists without the named frame.');
  assert.equal(prose.applicability.pairProseEligible, true);
  assert.equal(prose.raw.unigramJaccard.applicable, true);
  assert.equal(prose.raw.bigramJaccard.applicable, true);

  console.log('PASS output-analysis-applicability-v1');
  console.log(JSON.stringify({
    numeric: { lexical: numericLex.applicability, behavioral: { signedDelta: numericBeh.signedDelta, absoluteDelta: numericBeh.absoluteDelta } },
    sentinel: { lexical: sentinelLex.applicability, agreement: sentinelBeh.sentinelAgreement },
    prose: { unigramJaccard: prose.raw.unigramJaccard.value, bigramJaccard: prose.raw.bigramJaccard.value },
  }, null, 2));
}

main();
