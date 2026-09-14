'use strict';
const assert=require('assert');
const Compiler=require('./canonical-measurement-compiler-v0-14sep2026.js');
const Query=require('./cohort-battery-query-core-v1-14sep2026.js');

const battery={
  schema:'blum-battery-v0',
  batteryId:'fixture-battery',
  name:'Fixture',
  version:3,
  status:'frozen',
  fingerprint:'sha256:fixture',
  items:[
    {id:'N4',responseType:'numeric',parser:'strict_number_v0'},
    {id:'TXT',responseType:'numeric',parser:'strict_number_v0'},
    {id:'NOPARSER',responseType:'numeric',parser:'missing_parser_v0'},
    {id:'AMB',responseType:'numeric',parser:'strict_number_v0'},
    {id:'ZERO',responseType:'numeric',parser:'strict_number_v0'},
  ],
  groups:[],
};

function obs(id,item,replicate,rawOutput,sections={reply:rawOutput}) {
  return {
    observationId:id,collection:'raw7',condition:'C',family:'C',replicate,
    canonicalItemId:item,rawOutput,sections,sourcePath:`raw7/${id}.json`,
    presentationHash:`p-${id}`,itemCoreHash:`i-${item}`,callOutcome:'complete',stopReason:'end_turn',
  };
}
const observations=[
  obs('n4-1','N4',1,'32'),obs('n4-2','N4',2,'35'),obs('n4-3','N4',3,'35'),
  obs('txt-1','TXT',1,'score is thirty'),
  obs('nop-1','NOPARSER',1,'7'),
  obs('amb-1','AMB',1,'<analysis>7</analysis>',{analysis:'7'}),
];
const itemHistories={};
for (const o of observations) (itemHistories[o.canonicalItemId]||(itemHistories[o.canonicalItemId]={observations:[]})).observations.push(o);
const index={schema:'blum-dae-unified-observation-index-v1',generatedAt:'fixture',observationCount:observations.length,itemCount:Object.keys(itemHistories).length,itemHistories};

const answerOutcome={project(o){
  if (o.sections && o.sections.reply) return {status:'ok',text:String(o.sections.reply),source:'reply_section',section:'reply'};
  if (o.rawOutput) return {status:'adjudication_required',candidateText:o.rawOutput,reason:'no_designated_answer'};
  return {status:'empty',text:null};
}};
const strictNumber=text=>/^[+-]?\d+(?:\.\d+)?$/.test(String(text).trim())
  ? {status:'parsed',parsed:true,kind:'number',value:Number(text)}
  : {status:'unparsed',parsed:false,kind:'text',value:null};

const dataset=Compiler.compileCanonicalMeasurements(index,battery,{answerOutcome,parsers:{strict_number_v0:strictNumber}});
assert.equal(dataset.schema,'blum-canonical-measurement-dataset-v0');
assert.equal(dataset.measurementCount,6);
assert.equal(dataset.adjudicationQueue.length,2,'unparsed + ambiguous answer surface should queue');

const byObs=Object.fromEntries(dataset.rows.map(r=>[r.observationId,r]));
assert.equal(byObs['n4-1'].resolutionStatus,'mechanically_resolved');
assert.equal(byObs['txt-1'].parseStatus,'unparsed');
assert.equal(byObs['txt-1'].adjudicationTask.taskType,'measurement_parse');
assert.equal(byObs['nop-1'].parseStatus,'parser_spec_unavailable');
assert.equal(byObs['nop-1'].adjudicationTask,null,'missing parser authority is explicit, not silently adjudicated under an invented spec');
assert.equal(byObs['amb-1'].parseStatus,'ambiguous');
assert.equal(byObs['amb-1'].adjudicationTask.taskType,'answer_surface');

const result=Query.queryCohortBattery(dataset,{collection:'raw7',conditionRegex:/^C$/,expectedReplicates:3,itemIds:battery.items.map(x=>x.id)});
assert.equal(result.schema,'blum-cohort-battery-query-result-v1');
const byItem=Object.fromEntries(result.summaries.map(x=>[x.itemId,x]));
assert.deepEqual(byItem.N4.numericValues,[32,35,35]);
assert.equal(byItem.N4.median,35);
assert.equal(byItem.N4.min,32);
assert.equal(byItem.N4.max,35);
assert.equal(byItem.N4.status,'resolved');
assert.equal(byItem.N4.missingReplicateCount,0);
assert.equal(byItem.TXT.unparsedCount,1);
assert.equal(byItem.TXT.adjudicationRequiredCount,1);
assert.equal(byItem.NOPARSER.parserSpecUnavailableCount,1);
assert.equal(byItem.AMB.ambiguousCount,1);
assert.equal(byItem.ZERO.observationCount,0);
assert.equal(byItem.ZERO.status,'not_collected');
assert.equal(byItem.ZERO.missingReplicateCount,3);

console.log('canonical measurement pipeline regression: PASS');
