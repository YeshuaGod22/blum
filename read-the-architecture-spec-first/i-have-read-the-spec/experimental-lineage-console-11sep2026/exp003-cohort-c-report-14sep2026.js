#!/usr/bin/env node
'use strict';
const fs=require('fs');
const Core=require('./cohort-battery-query-core-v0-14sep2026.js');
const Answer=require('./answer-outcome-projection-v0-12sep2026.js');
const Behavioral=require('./behavioral-output-analysis-v0-12sep2026.js');

const EXP003_FULL_COLD_BATTERY=[
  'R1','R2','E02','B01','B02','B04','B05','B07','D1','D2','D3','N6',
  'C1','C2','C3','C4','N1','N3','N8','P2','E01','A1','N4','N9','I1'
];

function run(index) {
  return Core.queryCohortBattery(index,{
    collection:'raw7',
    conditionRegex:/^C(?:\d+)?$/,
    expectedReplicates:10,
    itemIds:EXP003_FULL_COLD_BATTERY,
  },{answerOutcome:Answer,behavioral:Behavioral});
}

if (require.main===module) {
  const indexPath=process.argv[2];
  if (!indexPath) {
    console.error('usage: node exp003-cohort-c-report-14sep2026.js <dae-whole-corpus-index-v1.json> [output.json]');
    process.exit(2);
  }
  const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
  const result=run(index);
  const text=JSON.stringify(result,null,2)+'\n';
  if (process.argv[3]) fs.writeFileSync(process.argv[3],text);
  else process.stdout.write(text);
}
module.exports={EXP003_FULL_COLD_BATTERY,run};
