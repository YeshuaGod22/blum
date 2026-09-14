'use strict';
const assert=require('assert');
const M=require('./materialize-measurement-adjudication-queue-v0-14sep2026.js');

const spec={
  adjudicationSpecId:'fixture-answer-recovery',version:1,purpose:'fixture',
  population:{filter:'fixture'},
  questions:[{id:'response_status',type:'categorical',prompt:'status?',options:['single_answer','unclear'],evidence:'required',confidence:true}],
  panel:{readersPerUnit:3,independent:true,agreementRule:'unanimous_or_majority',escalationRule:'disagreement_or_low_confidence'},
  randomisation:{shuffle:true,opaqueUnitIds:true,seed:'fixture'},
  blinding:{readerInstruction:'Use visible evidence only.'},
};
const battery={schema:'blum-battery-v0',batteryId:'fixture',version:1,status:'frozen',fingerprint:'sha256:fixture',items:[{id:'N4',text:'Return one number.',parser:'strict_number'}]};
const observation={
  observationId:'obs1',canonicalItemId:'N4',presentationText:'Exact presented N4 question',presentationHash:'sha256:p',itemCoreHash:'sha256:i',
  rawOutput:'I object to the framing, but my answer is 35.',callOutcome:'complete',stopReason:'end_turn',sourcePath:'secret/path.json',
};
const index={schema:'blum-dae-unified-observation-index-v1',observations:[observation]};
const row={
  measurementId:'m_1',observationId:'obs1',itemId:'N4',itemVersion:1,collection:'raw7',condition:'C',family:'C',replicate:9,sourcePath:'secret/path.json',
  resolutionStatus:'adjudication_required',parseStatus:'unparsed',responseSurface:{status:'ok',source:'plain_response',text:observation.rawOutput},parserEvidence:{parserId:'strict_number',rawResult:{parsed:false}},
  adjudicationTask:{taskId:'adj_1',taskType:'measurement_parse',measurementId:'m_1',observationId:'obs1',itemId:'N4',itemVersion:1},
};
const measurements={schema:'blum-canonical-measurement-dataset-v0',sourceIndex:{commit:'fixture'},batteryRef:{batteryId:'fixture',version:1,fingerprint:'sha256:fixture'},rows:[row]};

const batch=M.materialize(measurements,index,battery,spec);
assert.equal(batch.schema,'blum-adjudication-batch-v2');
assert.equal(batch.execution.populationSnapshot.length,1);
assert.equal(batch.assignments.length,3);
assert.equal(batch.provenance.length,1);
assert.equal(batch.provenance[0].condition,'C','hidden provenance must remain recoverable outside reader packets');
const packet=batch.assignments[0].packet;
assert.equal(packet.evidence.exact_question,'Exact presented N4 question');
assert.equal(packet.evidence.raw_response,observation.rawOutput);
const serialized=JSON.stringify(packet);
assert.equal(serialized.includes('secret/path.json'),false);
assert.equal(serialized.includes('"condition":"C"'),false);
assert.equal(serialized.includes('"family":"C"'),false);
assert.equal(serialized.includes('"replicate":9'),false);
assert.ok(/^u_[0-9a-f]{12}$/.test(batch.assignments[0].unitId));
assert.ok(batch.execution.executionFingerprint);
assert.ok(batch.execution.specFingerprint);
assert.ok(batch.execution.corpusFingerprint.startsWith('sha256:'));
console.log('measurement adjudication materializer regression: PASS');
