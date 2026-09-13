'use strict';

// Build a paper-facing descriptive report for the 12 raw12 lived trunks and
// their designed trunkless counterparts: ASa↔ASQ, Ha↔HQ, Fa↔FQ, CPa↔C.
// Usage: node build-raw12-cold-counterpart-report-v0-13sep2026.js <EXP-003-root> [out.json]

const fs=require('fs');
const path=require('path');
const Whole=require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Resolver=require('./raw12-cold-counterpart-resolver-v0-13sep2026.js');

function median(xs){
  const a=xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function mean(xs){const a=xs.filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function replySurface(o){
  const reply=o?.sections?.reply;
  if(Array.isArray(reply)&&reply.length)return String(reply[0]??'').trim();
  if(typeof reply==='string')return reply.trim();
  const m=String(o?.rawOutput??'').match(/<reply(?:\s[^>]*)?>([\s\S]*?)<\/reply\s*>/i);
  return m?m[1].trim():String(o?.rawOutput??'').trim();
}
function numericReply(o){
  const s=replySurface(o).replace(/[*_`#>]/g,' ').trim();
  return /^[+-]?\d+(?:\.\d+)?$/.test(s)?Number(s):null;
}
function point(o){return {
  value:numericReply(o),reply:replySurface(o),observationId:o.observationId??null,
  collection:o.collection??null,condition:o.condition??null,replicate:o.replicate??null,
  trunkKey:o.trunkKey??null,sourcePath:o.sourcePath??null,itemCoreHash:o.itemCoreHash??null,
  presentationHash:o.presentationHash??null,ancestryType:o.ancestryType??null,
};}
function summarize(points){
  const values=points.map(x=>x.value).filter(Number.isFinite);
  return {n:points.length,nNumeric:values.length,nNonNumeric:points.length-values.length,values,median:median(values),mean:mean(values),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};
}
function buildReport(experimentRoot){
  const index=Whole.buildWholeCorpusIndex(experimentRoot);
  const resolution=Resolver.resolve(index);
  const families=[];
  const ranked=[];
  for(const family of resolution.families){
    const items={};
    for(const [itemId,row] of Object.entries(family.items)){
      const livedPoints=row.lived.map(point);
      const coldPoints=row.cold.map(point);
      const lived=summarize(livedPoints),cold=summarize(coldPoints);
      const numericComplete=lived.nNumeric>0&&cold.nNumeric>0;
      const medianDelta=numericComplete?lived.median-cold.median:null;
      const meanDelta=numericComplete?lived.mean-cold.mean:null;
      items[itemId]={itemId,lived,cold,medianDelta,meanDelta,absMedianDelta:medianDelta===null?null:Math.abs(medianDelta),livedPoints,coldPoints};
      if(numericComplete)ranked.push({anchorFamily:family.anchorFamily,measuredCondition:family.measuredCondition,coldCondition:family.coldCondition,itemId,livedN:lived.nNumeric,coldN:cold.nNumeric,livedMedian:lived.median,coldMedian:cold.median,medianDelta,absMedianDelta:Math.abs(medianDelta),livedMean:lived.mean,coldMean:cold.mean,meanDelta});
    }
    families.push({anchorFamily:family.anchorFamily,measuredCondition:family.measuredCondition,coldCondition:family.coldCondition,coldPopulationPolicy:family.coldPopulationPolicy,items});
  }
  ranked.sort((a,b)=>b.absMedianDelta-a.absMedianDelta||String(a.itemId).localeCompare(String(b.itemId))||String(a.anchorFamily).localeCompare(String(b.anchorFamily)));
  return {
    schema:'blum-raw12-cold-counterpart-paper-report-v0',
    generatedAt:new Date().toISOString(),
    experiment:'EXP-003-the-sixth-question',
    comparisonSemantics:'designed trunked-vs-trunkless counterparts',
    mapping:Resolver.DEFAULT_DESIGN,
    anchorCount:resolution.anchorCount,
    resolvedAnchorCount:resolution.resolvedAnchorCount,
    missingAnchors:resolution.missingAnchors,
    indexObservationCount:index.observationCount,
    collectionSummaries:index.collectionSummaries,
    families,
    rankedNumericContrasts:ranked,
  };
}
function csv(report){
  const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  const head=['family','lived_condition','cold_condition','item','lived_n','cold_n','lived_median','cold_median','median_delta','abs_median_delta','lived_mean','cold_mean','mean_delta'];
  const rows=report.rankedNumericContrasts.map(r=>[r.anchorFamily,r.measuredCondition,r.coldCondition,r.itemId,r.livedN,r.coldN,r.livedMedian,r.coldMedian,r.medianDelta,r.absMedianDelta,r.livedMean,r.coldMean,r.meanDelta]);
  return [head,...rows].map(row=>row.map(q).join(',')).join('\n')+'\n';
}
function main(argv){
  const root=argv[2],out=argv[3]||'raw12-cold-counterpart-report-v0.json';
  if(!root)throw new Error('EXP-003 root required');
  const report=buildReport(root);
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  const csvOut=out.replace(/\.json$/i,'.csv');
  fs.writeFileSync(csvOut,csv(report));
  console.log(JSON.stringify({out,csvOut,anchors:report.resolvedAnchorCount,indexObservations:report.indexObservationCount,numericContrasts:report.rankedNumericContrasts.length,top:report.rankedNumericContrasts.slice(0,12)},null,2));
}
if(require.main===module)main(process.argv);
module.exports={median,mean,replySurface,numericReply,point,summarize,buildReport,csv};
