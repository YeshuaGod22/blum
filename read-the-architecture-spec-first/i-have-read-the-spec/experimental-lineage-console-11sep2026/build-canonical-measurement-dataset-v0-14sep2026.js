'use strict';

// Build the searchable canonical measurement dataset and unresolved adjudication queue.
// Usage:
// node build-canonical-measurement-dataset-v0-14sep2026.js \
//   <EXP-003-root> <battery.json> <parser-registry.js> [adjudications.json] [out-prefix]

const fs=require('fs');
const path=require('path');
const Whole=require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Measurement=require('./canonical-measurement-layer-v0-14sep2026.js');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function loadAdjudications(file){
  if(!file||!fs.existsSync(file))return[];
  const x=readJson(file);
  if(Array.isArray(x))return x;
  if(Array.isArray(x.rows))return x.rows;
  if(Array.isArray(x.adjudications))return x.adjudications;
  throw new Error('adjudications_json_requires_array_rows_or_adjudications');
}
function loadParserRegistry(file){
  const mod=require(path.resolve(file));
  if(mod&&typeof mod==='object'&&mod.parsers&&typeof mod.parsers==='object')return mod.parsers;
  if(mod&&typeof mod==='object')return mod;
  throw new Error('parser_registry_module_invalid');
}
function csvEscape(x){return '"'+String(x??'').replace(/"/g,'""')+'"';}
function datasetCsv(dataset){
  const cols=['measurementId','observationId','collection','condition','family','replicate','forkId','trunkKey','itemId','itemCoreHash','presentationHash','sourcePath','answerProjectionStatus','answerSource','parserId','parserStatus','mechanicalValue','mechanicalKind','adjudicationStatus','adjudicationSpecId','adjudicationExecutionFingerprint','adjudicatedValue','adjudicatedKind','resolutionSource','usableValue','usableKind','measurementStatus'];
  const scalar=x=>x==null?'':(typeof x==='object'?JSON.stringify(x):x);
  return [cols,...dataset.rows.map(r=>cols.map(c=>scalar(r[c])))].map(row=>row.map(csvEscape).join(',')).join('\n')+'\n';
}
function queueCsv(queue){
  const cols=['measurementId','observationId','itemId','requestedSpecId','reason','sourcePath'];
  return [cols,...queue.map(r=>cols.map(c=>r[c]??''))].map(row=>row.map(csvEscape).join(',')).join('\n')+'\n';
}
function main(argv){
  const [root,batteryFile,parserFile,adjudicationsFile,outPrefix='canonical-measurements-v0']=argv.slice(2);
  if(!root||!batteryFile||!parserFile){
    console.error('Usage: node build-canonical-measurement-dataset-v0-14sep2026.js <EXP-003-root> <battery.json> <parser-registry.js> [adjudications.json] [out-prefix]');
    process.exitCode=2;return;
  }
  const battery=readJson(batteryFile);
  const parserRegistry=loadParserRegistry(parserFile);
  const adjudications=loadAdjudications(adjudicationsFile);
  const index=Whole.buildWholeCorpusIndex(root);
  const dataset=Measurement.compileDataset({index,battery,parserRegistry,adjudications});
  dataset.source={experimentRoot:path.resolve(root),batteryFile:path.resolve(batteryFile),parserRegistryFile:path.resolve(parserFile),adjudicationsFile:adjudicationsFile?path.resolve(adjudicationsFile):null,indexSource:index.source||null};
  const queue=Measurement.adjudicationQueue(dataset);
  const completeness=Measurement.completeness(dataset);
  const prefix=path.resolve(outPrefix);
  fs.mkdirSync(path.dirname(prefix),{recursive:true});
  fs.writeFileSync(prefix+'.json',JSON.stringify(dataset,null,2)+'\n');
  fs.writeFileSync(prefix+'.csv',datasetCsv(dataset));
  fs.writeFileSync(prefix+'.adjudication-queue.json',JSON.stringify({schema:'blum-canonical-adjudication-queue-v0',generatedAt:new Date().toISOString(),sourceDataset:prefix+'.json',count:queue.length,rows:queue},null,2)+'\n');
  fs.writeFileSync(prefix+'.adjudication-queue.csv',queueCsv(queue));
  fs.writeFileSync(prefix+'.completeness.json',JSON.stringify(completeness,null,2)+'\n');
  console.log(JSON.stringify({dataset:prefix+'.json',measurements:dataset.measurementCount,queue:queue.length,completeness},null,2));
}
if(require.main===module)main(process.argv);
module.exports={readJson,loadAdjudications,loadParserRegistry,datasetCsv,queueCsv};
