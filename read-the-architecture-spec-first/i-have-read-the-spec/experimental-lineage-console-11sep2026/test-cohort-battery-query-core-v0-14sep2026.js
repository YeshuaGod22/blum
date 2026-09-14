'use strict';
const assert=require('assert');
const Core=require('./cohort-battery-query-core-v0-14sep2026.js');
const Answer=require('./answer-outcome-projection-v0-12sep2026.js');
const Behavioral=require('./behavioral-output-analysis-v0-12sep2026.js');

function obs(item,rep,reply) {
  return {observationId:`${item}-${rep}`,collection:'raw7',condition:'C',family:'C',replicate:rep,
    sections:{reply:[`\n${reply}\n`]},sourcePath:`raw7/C-r${rep}-${item}.json`};
}
const index={schema:'blum-dae-unified-observation-index-v1',observationCount:3,itemCount:2,itemHistories:{
  A1:{observations:[obs('A1',1,'25'),obs('A1',2,'NEVER'),obs('A1',3,'ALWAYS')]},
}};
const result=Core.queryCohortBattery(index,{collection:'raw7',conditionRegex:/^C(?:\d+)?$/,expectedReplicates:3,itemIds:['A1','N4']},{answerOutcome:Answer,behavioral:Behavioral});
assert.equal(result.itemCount,2);
assert.equal(result.observationCount,3);
assert.deepEqual(result.summaries[0].numericValues,[25]);
assert.deepEqual(result.summaries[0].sentinelCounts,{NEVER:1,ALWAYS:1});
assert.equal(result.summaries[0].missingCount,0);
assert.equal(result.summaries[1].observationCount,0);
assert.equal(result.summaries[1].missingCount,3);
console.log('PASS cohort-battery-query-core-v0');
