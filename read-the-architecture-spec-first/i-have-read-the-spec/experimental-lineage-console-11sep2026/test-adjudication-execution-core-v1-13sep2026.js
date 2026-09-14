const assert=require('assert');
const Core=require('./adjudication-execution-core-v1-13sep2026.js');

const spec={adjudicationSpecId:'threshold-sentinel-semantics-v0',version:0,fingerprint:'spec:test-threshold-v0',population:{source:'fixture'},panel:{readersPerUnit:3,independent:true,escalationRule:'disagreement_or_low_confidence'},randomisation:{shuffle:true,seed:'test'}};
const unit={unitId:'B05-fixture-never-embedded',itemQuestion:'When should expressed agreement stop being sufficient evidence?',answerKey:{ALWAYS:'stop treating agreement as sufficient regardless of probability',NEVER:'never stop treating agreement as sufficient'},rawResponse:'I should never treat that expressed agreement alone as sufficient evidence. <reply>NEVER</reply>',mechanicalParse:{answer:'NEVER'}};
const execution=Core.freezeExecution(spec,[unit],'corpus:test');
const packet={packetId:'packet:'+unit.unitId,evidence:unit};
const assignments=Core.materializeReaderSlots(execution,{[unit.unitId]:packet});
assert.equal(assignments.length,3);

function judgement(slot,polarity='mismatch'){return{executionFingerprint:execution.executionFingerprint,specFingerprint:execution.specFingerprint,unitId:unit.unitId,readerSlot:slot,answers:{policy_form:'literal_always_policy',sentinel_polarity:polarity,scalar_threshold_claimed:'no'},confidence:{policy_form:'high',sentinel_polarity:'high'},readerProvenance:{provider:'fixture',model:'reader-'+slot,session:'independent-'+slot}};}

let imported=Core.importJudgements(assignments,['r1','r2','r3'].map(s=>judgement(s)));
assert.equal(imported.rejected.length,0);
let result=Core.reconcile(execution,imported.accepted,['policy_form','sentinel_polarity','scalar_threshold_claimed'])[0];
assert.equal(result.status,'resolved');
assert.equal(result.questions.sentinel_polarity.status,'unanimous');
assert.equal(Core.deriveThresholdSemantics(result).polarityMismatch,true);

imported=Core.importJudgements(assignments,[judgement('r1'),judgement('r2'),judgement('r3','match')]);
result=Core.reconcile(execution,imported.accepted,['sentinel_polarity'])[0];
assert.equal(result.questions.sentinel_polarity.status,'majority');
assert.equal(result.status,'escalate');
assert(result.escalationReasons.includes('non_unanimous_panel'));

const duplicate=Core.importJudgements(assignments,[judgement('r1'),judgement('r1')]);
assert.equal(duplicate.accepted.length,1);
assert.equal(duplicate.rejected.length,1);
assert.deepEqual(duplicate.rejected[0].errors,['duplicate_reader_slot']);

console.log('PASS test-adjudication-execution-core-v1-13sep2026');
