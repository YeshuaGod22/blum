'use strict';

// Canonical measurement layer v0 — 14 Sep 2026
// Downstream analysis consumes this layer rather than parsing raw replies.

const crypto=require('crypto');
const AnswerOutcome=require('./answer-outcome-projection-v0-12sep2026.js');

function sha256(x){return 'sha256:'+crypto.createHash('sha256').update(String(x??''),'utf8').digest('hex');}
function clone(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function measurementId(o,itemId){return sha256(`${o?.observationId||''}|${itemId||''}|canonical-measurement-v0`);}

function normalizeParseResult(x){
  if(!x||typeof x!=='object') return {status:'unparsed',value:null,kind:null,evidence:null,reason:'parser_returned_no_result'};
  const status=String(x.status||'unparsed');
  if(!['parsed','unparsed','ambiguous'].includes(status)) throw new Error('invalid_parser_status:'+status);
  return {status,value:x.value??null,kind:x.kind??null,evidence:x.evidence??null,reason:x.reason??null,metadata:clone(x.metadata??null)};
}

function getParser(item,registry){
  const parserId=String(item?.parser||'').trim();
  if(!parserId) return {parserId:null,fn:null};
  const fn=registry&&registry[parserId];
  return {parserId,fn:typeof fn==='function'?fn:null};
}

function adjudicationKey(observationId,itemId){return `${observationId}::${itemId}`;}
function eligibleLockedAdjudication(a){
  if(!a||typeof a!=='object') return false;
  if(a.status!=='resolved') return false;
  if(!a.adjudicationSpecId||!a.executionFingerprint) return false;
  if(a.value===undefined) return false;
  return true;
}

function compileRow(observation,item,{parserRegistry={},adjudicationIndex={},semanticRouting={}}={}){
  const itemId=String(item?.id||observation?.canonicalItemId||'unknown');
  const projection=AnswerOutcome.project(observation);
  const {parserId,fn}=getParser(item,parserRegistry);
  let parsed={status:'unparsed',value:null,kind:null,evidence:null,reason:null};
  if(projection.status==='ok'&&fn){
    try{parsed=normalizeParseResult(fn({text:projection.text,observation,item,projection}));}
    catch(err){parsed={status:'unparsed',value:null,kind:null,evidence:null,reason:'parser_error:'+String(err&&err.message||err)};}
  } else if(projection.status==='empty') parsed={status:'unparsed',value:null,kind:null,evidence:null,reason:'empty_output'};
  else if(!fn) parsed={status:'unparsed',value:null,kind:null,evidence:null,reason:'parser_unregistered'};
  else parsed={status:'unparsed',value:null,kind:null,evidence:null,reason:projection.reason||'answer_projection_requires_adjudication'};

  const a=adjudicationIndex[adjudicationKey(observation?.observationId,itemId)]||null;
  const locked=eligibleLockedAdjudication(a);
  const declaredSpec=semanticRouting[itemId]||item?.metadata?.adjudicationSpecId||null;
  const semanticRequired=Boolean(declaredSpec);

  let resolutionSource=null,usableValue=null,usableKind=null,status='unresolved';
  if(locked){resolutionSource='adjudicated';usableValue=a.value;usableKind=a.kind??null;status='resolved';}
  else if(parsed.status==='parsed'&&!semanticRequired){resolutionSource='mechanical';usableValue=parsed.value;usableKind=parsed.kind;status='resolved';}
  else if(projection.status==='empty') status='empty';
  else if(!fn) status='parser_unregistered';
  else if(projection.status==='adjudication_required'||parsed.status==='unparsed'||parsed.status==='ambiguous'||semanticRequired) status='adjudication_required';

  return {
    schema:'blum-canonical-measurement-row-v0',
    measurementId:measurementId(observation,itemId),
    observationId:observation?.observationId||null,
    collection:observation?.collection||null,
    condition:observation?.condition||null,
    family:observation?.family||null,
    replicate:observation?.replicate??null,
    forkId:observation?.forkId||null,
    trunkKey:observation?.trunkKey||null,
    itemId,
    itemCoreHash:observation?.itemCoreHash||null,
    presentationHash:observation?.presentationHash||null,
    sourcePath:observation?.sourcePath||null,
    answerProjectionStatus:projection.status,
    answerSource:projection.source||null,
    parserId,
    parserStatus:parsed.status,
    mechanicalValue:parsed.value,
    mechanicalKind:parsed.kind,
    mechanicalEvidence:parsed.evidence,
    mechanicalReason:parsed.reason,
    adjudicationStatus:a?.status||null,
    adjudicationSpecId:a?.adjudicationSpecId||declaredSpec||null,
    adjudicationExecutionFingerprint:a?.executionFingerprint||null,
    adjudicatedValue:locked?a.value:null,
    adjudicatedKind:locked?(a.kind??null):null,
    adjudicationEvidence:locked?(clone(a.evidence??null)):null,
    resolutionSource,
    usableValue,
    usableKind,
    measurementStatus:status,
  };
}

function compileDataset({index,battery,parserRegistry={},adjudications=[],semanticRouting={}}={}){
  const items=Array.isArray(battery?.items)?battery.items:[];
  const itemMap=new Map(items.map(x=>[String(x.id),x]));
  const adjudicationIndex={};
  for(const a of adjudications||[]){
    const k=adjudicationKey(a.observationId,a.itemId);
    if(adjudicationIndex[k]) throw new Error('duplicate_adjudication:'+k);
    adjudicationIndex[k]=a;
  }
  const rows=[];
  for(const o of index?.observations||[]){
    const id=String(o.canonicalItemId||'unknown');
    const item=itemMap.get(id)||{id,parser:'',metadata:{}};
    rows.push(compileRow(o,item,{parserRegistry,adjudicationIndex,semanticRouting}));
  }
  return {
    schema:'blum-canonical-measurement-dataset-v0',
    generatedAt:new Date().toISOString(),
    sourceIndexSchema:index?.schema||null,
    batteryRef:{batteryId:battery?.batteryId||null,version:battery?.version||null,fingerprint:battery?.fingerprint||null},
    observationCount:(index?.observations||[]).length,
    measurementCount:rows.length,
    rows,
  };
}

function adjudicationQueue(dataset){
  return (dataset?.rows||[])
    .filter(r=>r.measurementStatus==='adjudication_required'||r.measurementStatus==='unresolved'||r.measurementStatus==='parser_unregistered')
    .map(r=>({
      measurementId:r.measurementId,observationId:r.observationId,itemId:r.itemId,
      requestedSpecId:r.adjudicationSpecId||'answer-recovery-response-status',
      reason:r.measurementStatus==='parser_unregistered'?'parser_unregistered':(r.mechanicalReason||r.parserStatus||r.answerProjectionStatus),
      sourcePath:r.sourcePath,
    }));
}

function queryCondition(dataset,battery,condition){
  const itemIds=(battery?.items||[]).map(x=>String(x.id));
  const byItem=new Map(itemIds.map(id=>[id,[]]));
  for(const r of dataset?.rows||[]){if(r.condition===condition&&byItem.has(r.itemId))byItem.get(r.itemId).push(r);}
  return itemIds.map(itemId=>{
    const rows=byItem.get(itemId)||[];
    const resolved=rows.filter(r=>r.measurementStatus==='resolved');
    return {
      itemId,
      values:resolved.map(r=>r.usableValue),
      kinds:[...new Set(resolved.map(r=>r.usableKind).filter(Boolean))],
      n:resolved.length,
      observedN:rows.length,
      unresolvedN:rows.filter(r=>r.measurementStatus!=='resolved').length,
      notCollected:rows.length===0,
      rows,
    };
  });
}

function completeness(dataset,scopeFn=()=>true){
  const rows=(dataset?.rows||[]).filter(scopeFn);
  const counts={};
  for(const r of rows)counts[r.measurementStatus]=(counts[r.measurementStatus]||0)+1;
  return {eligible:rows.length,counts,queueN:rows.filter(r=>r.measurementStatus!=='resolved'&&r.measurementStatus!=='empty').length,complete:rows.every(r=>r.measurementStatus==='resolved'||r.measurementStatus==='empty')};
}

module.exports={sha256,measurementId,normalizeParseResult,getParser,adjudicationKey,eligibleLockedAdjudication,compileRow,compileDataset,adjudicationQueue,queryCondition,completeness};
