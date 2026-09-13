'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const M=require('./materialize-raw12-cf1-rereview-v0-13sep2026.js');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'blum-cf1-rereview-'));
const raw=path.join(tmp,'experiments','EXP-003-the-sixth-question','raw12');
fs.mkdirSync(raw,{recursive:true});

const files=['F0-r1-D1.json','F0-r3-D1.json','AS0-r3-R2.json'];
files.forEach((name,i)=>{
  const family=name.split('-')[0];
  const item=name.replace('.json','').split('-').slice(-1)[0];
  const record={
    cell:family,
    replicate:i+1,
    item,
    kind:'branch',
    branch:'0',
    parent_prefix:`${family.replace(/0$/,'')}-r${i+1}.messages.json`,
    prefix_len:2,
    sent:[
      {role:'user',content:'antecedent question'},
      {role:'assistant',content:'antecedent answer'},
      {role:'user',content:`battery ${item}`},
    ],
    received:`Complete target ${i+1}. In this conversation I changed my view and now use that change.`,
    stop_reason:'end_turn',
  };
  fs.writeFileSync(path.join(raw,name),JSON.stringify(record));
});

const batch=M.materialize(tmp);
assert.equal(batch.schema,'blum-adjudication-batch-v2');
assert.equal(batch.execution.populationSnapshot.length,3);
assert.equal(batch.assignments.length,9);
assert.equal(batch.execution.panel.readersPerUnit,3);
assert.equal(batch.provenance.length,3);
assert.equal(new Set(batch.assignments.map(x=>x.unitId)).size,3);
assert.deepEqual(new Set(batch.assignments.map(x=>x.readerSlot)),new Set(['r1','r2','r3']));
for(const a of batch.assignments){
  assert.equal(a.packet.instructions.questions.length,4);
  assert.ok(a.packet.evidence.complete_target_response.includes('Complete target'));
  assert.equal(a.packet.evidence.antecedent_context.length,2);
  assert.ok(a.packet.evidence.battery_question.startsWith('battery '));
  const serialized=JSON.stringify(a.packet);
  assert.ok(!serialized.includes('F0-r1-D1.json'));
  assert.ok(!serialized.includes('AS0-r3-R2.json'));
  assert.ok(!serialized.includes('prior_CF1_code'));
}
for(const p of batch.provenance){
  assert.ok(p.sourcePath.endsWith('.json'));
  assert.ok(/^sha256:[0-9a-f]{64}$/.test(p.sourceFileSha256));
}
console.log(JSON.stringify({ok:true,units:3,assignments:9,executionFingerprint:batch.execution.executionFingerprint},null,2));
