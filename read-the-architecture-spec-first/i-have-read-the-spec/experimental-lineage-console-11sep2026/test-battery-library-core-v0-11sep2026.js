'use strict';

const assert = require('assert');
const B = require('./battery-library-core-v0-11sep2026.js');

const draft = {
  batteryId: 'core-battery',
  name: 'Core Battery',
  version: 3,
  items: [
    { id: 'R1', family: 'R', construct: 'recurrence', text: 'R1 text', responseType: 'free' },
    { id: 'T1', family: 'T', construct: 'threshold', text: 'T1 text', responseType: 'threshold' },
    { id: 'U1', family: 'U', construct: 'uncertainty', text: 'U1 text', responseType: 'credence' },
    { id: 'Y1', family: 'Y', construct: 'integration', text: 'Y1 text', responseType: 'free' },
    { id: 'W1', family: 'W', construct: 'process_review', text: 'W1 text', responseType: 'free' },
  ],
  groups: [
    { id: 'R_T_U_Y', label: 'R / T / U / Y', itemIds: ['R1', 'T1', 'U1', 'Y1'] },
    { id: 'PROCESS_REVIEW', label: 'Process review', itemIds: ['W1'] },
  ],
};

const validation = B.validateBattery(draft);
assert.equal(validation.valid, true);
assert.equal(validation.errors.length, 0);

assert.throws(() => B.makeAttachment({ battery: draft, branchIds: ['a', '0'] }), /requires_frozen/);

const frozen = B.freezeBattery(draft, '2026-09-11T18:30:00Z').battery;
assert.equal(frozen.status, 'frozen');
assert.ok(frozen.fingerprint.startsWith('sha256:'));

const attachment = B.makeAttachment({
  battery: frozen,
  branchIds: ['a', '0'],
  groupIds: ['R_T_U_Y'],
});
assert.deepEqual(attachment.branchIds, ['a', '0']);
assert.deepEqual(attachment.selectedItemIds, ['R1', 'T1', 'U1', 'Y1']);
assert.equal(attachment.batteryRef.version, 3);
assert.equal(attachment.batteryRef.fingerprint, frozen.fingerprint);

const v4 = B.newDraftVersion(frozen);
assert.equal(v4.version, 4);
assert.equal(v4.status, 'draft');
assert.equal(v4.fingerprint, null);

const malformed = JSON.parse(JSON.stringify(draft));
malformed.groups.push({ id: 'BROKEN', itemIds: ['NO_SUCH_ITEM'] });
assert.equal(B.validateBattery(malformed).valid, false);

console.log('PASS battery-library-core-v0');
console.log(JSON.stringify({
  frozen: { batteryId: frozen.batteryId, version: frozen.version, fingerprint: frozen.fingerprint },
  attachment,
  nextDraftVersion: v4.version,
}, null, 2));
