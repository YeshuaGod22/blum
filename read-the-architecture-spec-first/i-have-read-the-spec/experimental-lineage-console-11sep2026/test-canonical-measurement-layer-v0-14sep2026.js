'use strict';
const assert=require('assert');
const M=require('./canonical-measurement-layer-v0-14sep2026.js');

const battery={batteryId:'test',version:1,fingerprint:'fp',items:[
  {id:'N4',parser:'number',metadata:{}},
  {id:'B05',parser:'sentinel_or_number',metadata:{adjudicationSpecId:'threshold-sentinel-semantics-v0'}},
  {id:'X1',parser:'number',metadata:{}},
]};
const parsers={
  number:({text})=>/^\d+(?:\.\d+)?$/.test(text.trim())?{status:'parsed',value:Number(text),kind:'number',evidence:text}:{status:'unparsed',reason:'not_bare_number'},
  sentinel_or_number:({text})=>{
    const s=text.trim().toUpperCase();
    if(['ALWAYS','NEVER'].includes(s))return{status:'parsed',value:s,kind:'sentinel',evidence:text};
    if(/^\d+$/.test(s))return{status:'parsed',value:Number(s),kind:'number',evidence:text};
    return{status:'unparsed',reason:'not_authorised_surface'};
  }
};
const obs=(id,item,raw,sections={},condition='C')=>({observationId:id,canonicalItemId:item,rawOutput:raw,sections,collection:'raw7',condition,family:condition,replicate:1,sourcePath:id+'.json'});
const index={schema:'idx',observations:[
  obs('o1','N4','<reply>35</reply>',{reply:['35']}),
  obs('o2','N4','<reflection>thinking</reflection><final>40</final>',{reflection:['thinking'],final:['40']}),
  obs('o3','B05','<reply>NEVER</reply>',{reply:['NEVER']}),
  obs('o4','X1','I choose roughly forty',{}),
]};

// Mechanical success is directly usable for ordinary items.
let d=M.compileDataset({index,battery,parserRegistry:parsers});
let r=d.rows.find(x=>x.observationId==='o1');
assert.equal(r.measurementStatus,'resolved');
assert.equal(r.usableValue,35);
assert.equal(r.resolutionSource,'mechanical');

// Structured substantive output with no answer/reply section must queue, not scrape 40.
r=d.rows.find(x=>x.observationId==='o2');
assert.equal(r.answerProjectionStatus,'adjudication_required');
assert.equal(r.measurementStatus,'adjudication_required');
assert.equal(r.usableValue,null);

// Semantically sensitive item remains queued even when token parses mechanically.
r=d.rows.find(x=>x.observationId==='o3');
assert.equal(r.parserStatus,'parsed');
assert.equal(r.mechanicalValue,'NEVER');
assert.equal(r.measurementStatus,'adjudication_required');
assert.equal(r.usableValue,null);
assert.equal(r.adjudicationSpecId,'threshold-sentinel-semantics-v0');

// Plain prose parser miss is unresolved/queued; arbitrary-number extraction is forbidden.
r=d.rows.find(x=>x.observationId==='o4');
assert.equal(r.parserStatus,'unparsed');
assert.equal(r.measurementStatus,'adjudication_required');
assert.equal(r.usableValue,null);

// Locked adjudication populates usable value and preserves the mechanical result separately.
d=M.compileDataset({index,battery,parserRegistry:parsers,adjudications:[
  {observationId:'o2',itemId:'N4',status:'resolved',adjudicationSpecId:'answer-recovery-response-status',executionFingerprint:'exec:1',value:40,kind:'number',evidence:'40'},
  {observationId:'o3',itemId:'B05',status:'resolved',adjudicationSpecId:'threshold-sentinel-semantics-v0',executionFingerprint:'exec:2',value:'literal_never_policy',kind:'semantic_class',evidence:'NEVER'},
  {observationId:'o4',itemId:'X1',status:'resolved',adjudicationSpecId:'answer-recovery-response-status',executionFingerprint:'exec:3',value:40,kind:'number',evidence:'roughly forty'},
]});
r=d.rows.find(x=>x.observationId==='o2');
assert.equal(r.measurementStatus,'resolved');assert.equal(r.usableValue,40);assert.equal(r.resolutionSource,'adjudicated');
r=d.rows.find(x=>x.observationId==='o3');
assert.equal(r.usableValue,'literal_never_policy');assert.equal(r.mechanicalValue,'NEVER');

// Condition query is registry-first: unobserved battery items remain explicit.
const q=M.queryCondition(d,battery,'C');
assert.equal(q.length,3);
assert.equal(q.find(x=>x.itemId==='N4').n,2);
assert.equal(q.find(x=>x.itemId==='B05').n,1);
assert.equal(q.find(x=>x.itemId==='X1').n,1);
const qEmpty=M.queryCondition({rows:d.rows.filter(x=>x.itemId!=='X1')},battery,'C');
assert.equal(qEmpty.find(x=>x.itemId==='X1').notCollected,true);
assert.equal(qEmpty.find(x=>x.itemId==='X1').n,0);

assert.equal(M.adjudicationQueue(d).length,0);
assert.equal(M.completeness(d).complete,true);
console.log('canonical measurement layer tests: ok');
