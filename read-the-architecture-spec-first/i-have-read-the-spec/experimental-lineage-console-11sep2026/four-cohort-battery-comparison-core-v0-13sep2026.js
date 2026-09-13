'use strict';

// FOUR-COHORT BATTERY COMPARISON CORE v0 — 13 Sep 2026
// Paper-facing descriptive projection for historical cohorts such as F / FQ / CP / C.
// It deliberately does not infer causal roles from labels. Cohort membership is an explicit recipe.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BlumFourCohortBatteryV0=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_ORDER=['F','FQ','CP','C'];

  function arr(x){return Array.isArray(x)?x:(x==null?[]:[x]);}
  function finiteNumber(x){const n=Number(x);return Number.isFinite(n)?n:null;}
  function median(xs){
    const a=xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    if(!a.length)return null;
    const m=Math.floor(a.length/2);
    return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }
  function mean(xs){const a=xs.filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
  function numericBody(text){
    const body=String(text??'').replace(/<[^>]+>/g,' ').replace(/[*_`#>]/g,' ').trim();
    return /^[+-]?\d+(?:\.\d+)?$/.test(body)?Number(body):null;
  }
  function answerText(obs){
    const reply=obs?.sections?.reply;
    if(Array.isArray(reply)&&reply.length===1)return String(reply[0]??'');
    if(typeof reply==='string')return reply;
    // Whole-output fallback is intentionally strict: it only succeeds when the complete surface is numeric.
    return String(obs?.rawOutput??'');
  }
  function observationValue(obs){return numericBody(answerText(obs));}

  function matchScalar(actual,expected){
    if(expected==null||expected==='')return true;
    if(Array.isArray(expected))return expected.includes(actual);
    return actual===expected;
  }
  function matchRegex(actual,pattern){
    if(!pattern)return true;
    try{return new RegExp(pattern).test(String(actual??''));}catch(_){return false;}
  }
  function matches(obs,rule){
    const m=rule?.match||{};
    if(!matchScalar(obs.collection,m.collection))return false;
    if(!matchScalar(obs.condition,m.condition))return false;
    if(!matchScalar(obs.forkId,m.forkId))return false;
    if(!matchScalar(obs.family,m.family))return false;
    if(!matchRegex(obs.collection,m.collectionRegex))return false;
    if(!matchRegex(obs.condition,m.conditionRegex))return false;
    if(!matchRegex(obs.forkId,m.forkRegex))return false;
    if(!matchRegex(obs.family,m.familyRegex))return false;
    if(typeof rule?.predicate==='function'&&!rule.predicate(obs))return false;
    return true;
  }
  function cohortFor(obs,recipe){
    const hits=[];
    for(const rule of recipe?.cohorts||[])if(matches(obs,rule))hits.push(rule.id);
    return hits;
  }
  function provenance(obs,value,cohort){
    return {
      cohort,value,
      collection:obs.collection??null,condition:obs.condition??null,
      replicate:obs.replicate??null,forkId:obs.forkId??null,family:obs.family??null,
      parentSnapshotId:obs.parentSnapshotId??null,canonicalItemId:obs.canonicalItemId??null,
      itemCoreHash:obs.itemCoreHash??null,presentationHash:obs.presentationHash??null,
      sourcePath:obs.sourcePath??null,observationId:obs.observationId??obs.id??null,
      rawOutput:obs.rawOutput??'',sections:obs.sections??{}
    };
  }
  function summarize(points){
    const values=points.map(p=>p.value).filter(Number.isFinite);
    return {n:values.length,median:median(values),mean:mean(values),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,values};
  }
  function allObservations(index){
    const out=[];
    for(const [canonicalItemId,h] of Object.entries(index?.itemHistories||{})){
      for(const o of h?.observations||[])out.push(o.canonicalItemId?o:{...o,canonicalItemId});
    }
    if(!out.length&&Array.isArray(index?.observations))return index.observations.slice();
    return out;
  }
  function itemTextLookup(index){
    const m=new Map();
    for(const h of Object.values(index?.itemHistories||{})){
      for(const v of h?.itemCoreVariants||[]){
        const hash=v.itemCoreHash||v.hash;
        if(hash&&!m.has(hash))m.set(hash,v.itemCoreText??v.text??null);
      }
    }
    return m;
  }
  function compare(index,recipe,options={}){
    const cohortIds=(recipe?.cohorts||[]).map(x=>x.id);
    if(cohortIds.length<2)throw new Error('recipe requires at least two cohorts');
    if(new Set(cohortIds).size!==cohortIds.length)throw new Error('cohort ids must be unique');
    const textByHash=itemTextLookup(index);
    const groups=new Map(),ambiguous=[];
    for(const obs of allObservations(index)){
      const hits=cohortFor(obs,recipe);
      if(hits.length>1){ambiguous.push({observationId:obs.observationId??obs.id??null,hits,sourcePath:obs.sourcePath??null});continue;}
      if(hits.length!==1)continue;
      const value=observationValue(obs);if(value===null)continue;
      const hash=obs.itemCoreHash||null;
      if(options.requireExactItemWording!==false&&!hash)continue;
      const key=hash||`canonical:${obs.canonicalItemId??'unknown'}`;
      if(!groups.has(key))groups.set(key,{key,itemCoreHash:hash,canonicalItems:new Set(),points:Object.fromEntries(cohortIds.map(id=>[id,[]]))});
      const g=groups.get(key);g.canonicalItems.add(obs.canonicalItemId??'unknown');
      g.points[hits[0]].push(provenance(obs,value,hits[0]));
    }
    const rows=[];
    for(const g of groups.values()){
      const summaries={};for(const id of cohortIds)summaries[id]=summarize(g.points[id]);
      const present=cohortIds.filter(id=>summaries[id].n>0);
      const medians=present.map(id=>summaries[id].median);
      const range=medians.length?Math.max(...medians)-Math.min(...medians):null;
      const ordering=present.slice().sort((a,b)=>summaries[b].median-summaries[a].median);
      const flags=[];
      const missing=cohortIds.filter(id=>summaries[id].n===0);if(missing.length)flags.push(`MISSING:${missing.join(',')}`);
      const collections=new Set(Object.values(g.points).flat().map(p=>p.collection).filter(Boolean));if(collections.size>1)flags.push('CROSS_COLLECTION');
      rows.push({
        schema:'blum-four-cohort-battery-row-v0',key:g.key,itemCoreHash:g.itemCoreHash,
        itemCoreText:g.itemCoreHash?textByHash.get(g.itemCoreHash)??null:null,
        canonicalItemIds:[...g.canonicalItems].sort(),cohorts:summaries,points:g.points,
        complete:missing.length===0,range,ordering,flags
      });
    }
    const completeOnly=options.completeOnly===true;
    const filtered=completeOnly?rows.filter(r=>r.complete):rows;
    filtered.sort((a,b)=>(b.complete-a.complete)||((b.range??-Infinity)-(a.range??-Infinity))||String(a.key).localeCompare(String(b.key)));
    return {
      schema:'blum-four-cohort-battery-comparison-v0',recipe:{id:recipe?.id??null,label:recipe?.label??null,cohorts:(recipe?.cohorts||[]).map(({predicate,...r})=>r)},
      cohortIds,requireExactItemWording:options.requireExactItemWording!==false,completeOnly,
      observationCount:allObservations(index).length,rowCount:filtered.length,completeRowCount:filtered.filter(r=>r.complete).length,
      ambiguousMembership:ambiguous,rows:filtered
    };
  }

  function recipeFromMatchers(matchers,order=DEFAULT_ORDER){
    return {id:'explicit-four-cohort-recipe-v0',label:order.join(' / '),cohorts:order.map(id=>({id,match:matchers?.[id]||{}}))};
  }

  return {DEFAULT_ORDER,numericBody,observationValue,median,mean,matches,cohortFor,compare,recipeFromMatchers};
});