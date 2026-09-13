'use strict';

// BLUM SURFACE SPAN GRAPH CORE v0 — 13 Sep 2026
// Derived, rebuildable projection only. Raw witnesses and historical XML parsing
// remain untouched. Every non-empty text run between XML-like tag tokens becomes
// an auditable span with character offsets into rawOutput.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.BlumSurfaceSpanGraphCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='surface-span-graph-core-v0-13sep2026';
  const TAG_RE=/<\/?([A-Za-z][A-Za-z0-9_.:-]*)(?:\s[^<>]*?)?\s*\/?>/g;
  function fnv1a(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function stableId(prefix,material){return prefix+':'+fnv1a(String(material));}
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canonicalize(x){if(Array.isArray(x))return x.map(canonicalize);if(x&&typeof x==='object')return Object.keys(x).sort().reduce((o,k)=>(o[k]=canonicalize(x[k]),o),{});return x;}
  function stableStringify(x){return JSON.stringify(canonicalize(x));}
  function fingerprint(x){return'fnv1a:'+fnv1a(stableStringify(x));}

  function lexOutput(rawOutput){const raw=String(rawOutput??''),tokens=[];let m;TAG_RE.lastIndex=0;while((m=TAG_RE.exec(raw))){const literal=m[0],name=m[1];tokens.push({kind:literal.startsWith('</')?'close':(literal.endsWith('/>')?'self_close':'open'),name,start:m.index,end:m.index+literal.length,literal});}return tokens;}

  function segmentOutput(rawOutput,observationId='unknown'){
    const raw=String(rawOutput??''),tokens=lexOutput(raw),spans=[],tagEvents=[],stack=[];let cursor=0,ordinal=0,anomalyOrdinal=0;
    function emitText(start,end){if(end<=start)return;const text=raw.slice(start,end);if(!text.trim())return;const path=stack.map(x=>x.name),tagName=path.length?path[path.length-1]:null,spanId=stableId('span',`${observationId}|${start}|${end}|${path.join('/')}`);spans.push({schema:'blum-surface-span-v0',spanId,observationId:String(observationId),ordinal:ordinal++,startOffset:start,endOffset:end,text,textHash:'fnv1a:'+fnv1a(text),surfaceType:tagName?'tagged':'untagged',tagName,tagPath:path,depth:path.length,containerOpenOffset:stack.length?stack[stack.length-1].start:null});}
    for(const token of tokens){emitText(cursor,token.start);const event={...token,ordinal:tagEvents.length,stackBefore:stack.map(x=>x.name),integrity:'ok'};if(token.kind==='open')stack.push({name:token.name,start:token.start});else if(token.kind==='close'){let idx=-1;for(let i=stack.length-1;i>=0;i--)if(stack[i].name.toLowerCase()===token.name.toLowerCase()){idx=i;break;}if(idx<0){event.integrity='orphan_close';anomalyOrdinal++;}else{if(idx!==stack.length-1){event.integrity='crossed_close';anomalyOrdinal++;}stack.splice(idx);}}event.stackAfter=stack.map(x=>x.name);tagEvents.push(event);cursor=token.end;}emitText(cursor,raw.length);const unclosed=stack.map(x=>({name:x.name,openOffset:x.start,integrity:'unclosed'}));anomalyOrdinal+=unclosed.length;return{schema:'blum-surface-segmentation-v0',observationId:String(observationId),rawLength:raw.length,spanCount:spans.length,tagTokenCount:tokens.length,anomalyCount:anomalyOrdinal,unclosedTags:unclosed,spans,tagEvents};
  }

  function observationMeta(o){return{collection:o.collection??null,canonicalItemId:o.canonicalItemId??null,condition:o.condition??null,family:o.family??null,replicate:o.replicate??null,trunkKey:o.trunkKey??null,forkId:o.forkId??null,parentSnapshotId:o.parentSnapshotId??null,parentVerificationStatus:o.parentVerificationStatus??null,sourcePath:o.sourcePath??null,callOutcome:o.callOutcome??null};}

  function flattenIndexObservations(index){
    if(Array.isArray(index))return index.slice();
    const out=[],seen=new Set();
    function push(o,itemId=null){if(!o)return;const copy=itemId&&!o.canonicalItemId?{...o,canonicalItemId:itemId}:o;const key=String(copy.observationId||`${copy.collection||''}|${copy.sourcePath||''}|${copy.canonicalItemId||''}|${copy.condition||''}|${copy.replicate||''}|${copy.forkId||''}`);if(seen.has(key))return;seen.add(key);out.push(copy);}
    for(const o of index&&index.observations||[])push(o);
    for(const [itemId,h] of Object.entries(index&&index.itemHistories||{}))for(const o of h&&h.observations||[])push(o,itemId);
    return out;
  }

  function buildSurfaceGraph(index){
    const observations=flattenIndexObservations(index),nodes=[],edges=[],segmentations={},byObservation={},observationIds=new Set();
    for(const o of observations){const observationId=String(o.observationId||stableId('obs',`${o.collection||''}|${o.sourcePath||''}|${o.canonicalItemId||''}|${nodes.length}`));if(observationIds.has(observationId))throw new Error('duplicate_observation_id:'+observationId);observationIds.add(observationId);const seg=segmentOutput(o.rawOutput,observationId);segmentations[observationId]=seg;const meta=observationMeta(o),spanIds=[];for(const s of seg.spans){nodes.push({...clone(s),...meta});spanIds.push(s.spanId);}byObservation[observationId]={observationId,...meta,spanIds,spanCount:spanIds.length,rawLength:seg.rawLength,anomalyCount:seg.anomalyCount};for(let i=1;i<spanIds.length;i++)edges.push({edgeId:stableId('edge',`sequence|${spanIds[i-1]}|${spanIds[i]}`),kind:'sequence',source:spanIds[i-1],target:spanIds[i],observationId});}
    return{schema:'blum-surface-graph-v0',coreVersion:VERSION,sourceIndexSchema:index&&index.schema||null,observationCount:observations.length,nodeCount:nodes.length,edgeCount:edges.length,nodes,edges,observations:byObservation,segmentations};
  }

  function groupKey(node,mode){if(mode==='tag')return node.surfaceType==='untagged'?'[untagged]':String(node.tagName||'[tagged]');if(mode==='item')return String(node.canonicalItemId||'[missing item]');if(mode==='trunk')return String(node.trunkKey||'[no trunk]');if(mode==='collection')return String(node.collection||'[missing collection]');if(mode==='condition')return String(node.condition||'[missing condition]');if(mode==='observation')return String(node.observationId);return'[all]';}
  function census(graph){const out={tagged:0,untagged:0,byTag:{},byCollection:{},observationsWithUntagged:0},untagObs=new Set();for(const n of graph&&graph.nodes||[]){out[n.surfaceType]=(out[n.surfaceType]||0)+1;const tag=n.tagName||'[untagged]';out.byTag[tag]=(out.byTag[tag]||0)+1;const col=n.collection||'[missing]';out.byCollection[col]=(out.byCollection[col]||0)+1;if(n.surfaceType==='untagged')untagObs.add(n.observationId);}out.observationsWithUntagged=untagObs.size;return out;}

  function spanSetFingerprint(graph){const ids=(graph&&graph.nodes||[]).map(n=>String(n.spanId)).sort();return fingerprint({schema:'blum-span-set-v0',ids});}
  function validateSemanticCoordinates(graph,artifact){
    const errors=[],warnings=[],accepted=[],rejected=[];
    if(!artifact||typeof artifact!=='object')return{ok:false,errors:['artifact_not_object'],warnings,accepted,rejected,missing:[]};
    if(artifact.schema!=='blum-semantic-coordinate-artifact-v0')errors.push('wrong_artifact_schema');
    const spec=artifact.spec||{};
    if(!String(spec.semanticCoordinateSpecId||'').trim())errors.push('missing_spec_id');
    if(spec.inputUnit!=='surface_span')errors.push('unsupported_input_unit');
    if(!spec.embedding||!String(spec.embedding.model||'').trim())warnings.push('embedding_model_not_declared');
    if(!spec.projection||Number(spec.projection.dimensions)!==2)errors.push('projection_must_be_2d');
    if(!String(spec.projection&&spec.projection.method||'').trim())errors.push('projection_method_missing');
    if(!String(spec.projection&&spec.projection.seed||'').trim())warnings.push('projection_seed_missing');
    const coverage=spec.coverage||'complete';if(!['complete','partial'].includes(coverage))errors.push('invalid_coverage_policy');
    if(artifact.specFingerprint&&artifact.specFingerprint!==fingerprint(spec))errors.push('spec_fingerprint_mismatch');
    const expectedSpanSetFingerprint=spanSetFingerprint(graph);if(artifact.spanSetFingerprint&&artifact.spanSetFingerprint!==expectedSpanSetFingerprint)errors.push('span_set_fingerprint_mismatch');
    const known=new Set((graph&&graph.nodes||[]).map(n=>String(n.spanId))),seen=new Set();
    for(const row of artifact.coordinates||[]){const rowErrors=[],spanId=String(row&&row.spanId||''),x=Number(row&&row.x),y=Number(row&&row.y);if(!spanId)rowErrors.push('span_id_missing');if(spanId&&!known.has(spanId))rowErrors.push('unknown_span_id');if(spanId&&seen.has(spanId))rowErrors.push('duplicate_span_id');if(!Number.isFinite(x)||!Number.isFinite(y))rowErrors.push('non_finite_coordinate');if(rowErrors.length)rejected.push({row,errors:rowErrors});else{seen.add(spanId);accepted.push({spanId,x,y});}}
    const missing=[...known].filter(id=>!seen.has(id));if(coverage==='complete'&&missing.length)errors.push('incomplete_coordinate_coverage');if(missing.length)warnings.push('missing_coordinates:'+missing.length);
    return{ok:errors.length===0&&rejected.length===0,errors,warnings,accepted,rejected,missing,expectedSpanSetFingerprint};
  }
  function semanticCoordinateMap(graph,artifact){const v=validateSemanticCoordinates(graph,artifact);if(!v.ok)throw new Error('invalid_semantic_coordinates:'+v.errors.concat(v.rejected.flatMap(x=>x.errors)).join(','));return new Map(v.accepted.map(r=>[r.spanId,{x:r.x,y:r.y}]));}

  return{VERSION,lexOutput,segmentOutput,flattenIndexObservations,buildSurfaceGraph,groupKey,census,stableId,canonicalize,stableStringify,fingerprint,spanSetFingerprint,validateSemanticCoordinates,semanticCoordinateMap};
});
