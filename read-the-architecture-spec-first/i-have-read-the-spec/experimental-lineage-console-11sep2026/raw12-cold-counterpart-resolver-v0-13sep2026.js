'use strict';

// RAW12 ↔ COLD COUNTERPART RESOLVER v0 — 13 Sep 2026
// Turns the EXP-003 design relation into an explicit, provenance-bearing projection.
// These are designed counterparts, not ancestry edges.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BlumRaw12ColdCounterpartsV0=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_DESIGN=[
    {anchorFamily:'AS', measuredCondition:'ASa', coldCondition:'ASQ'},
    {anchorFamily:'H',  measuredCondition:'Ha',  coldCondition:'HQ'},
    {anchorFamily:'F',  measuredCondition:'Fa',  coldCondition:'FQ'},
    {anchorFamily:'CP', measuredCondition:'CPa', coldCondition:'C'},
  ];
  const DEFAULT_REPLICATES=[1,2,3];

  function allObservations(index){
    if(Array.isArray(index?.observations)&&index.observations.length)return index.observations.slice();
    const out=[];
    for(const h of Object.values(index?.itemHistories||{}))for(const o of h?.observations||[])out.push(o);
    return out;
  }
  function slim(o){
    return {
      observationId:o.observationId??o.id??null,
      collection:o.collection??null,condition:o.condition??null,family:o.family??null,
      replicate:o.replicate??null,trunkKey:o.trunkKey??null,forkId:o.forkId??null,
      ancestryType:o.ancestryType??null,parentSnapshotId:o.parentSnapshotId??null,
      canonicalItemId:o.canonicalItemId??null,itemCoreHash:o.itemCoreHash??null,
      presentationHash:o.presentationHash??null,sourcePath:o.sourcePath??null,
      rawOutput:o.rawOutput??'',sections:o.sections??{},callOutcome:o.callOutcome??null,
    };
  }
  function sortObservations(xs){
    return xs.slice().sort((a,b)=>String(a.canonicalItemId??'').localeCompare(String(b.canonicalItemId??''))||Number(a.replicate??0)-Number(b.replicate??0)||String(a.sourcePath??'').localeCompare(String(b.sourcePath??'')));
  }
  function indexByItem(xs){
    const out={};
    for(const o of xs){
      const id=String(o.canonicalItemId??'unknown');
      if(!out[id])out[id]=[];
      out[id].push(slim(o));
    }
    for(const id of Object.keys(out))out[id]=sortObservations(out[id]);
    return out;
  }
  function resolve(index,options={}){
    const raw12Collection=options.raw12Collection||'raw12';
    const coldCollection=options.coldCollection||'raw7';
    const design=options.design||DEFAULT_DESIGN;
    const replicates=options.replicates||DEFAULT_REPLICATES;
    const obs=allObservations(index);
    const anchors=[];
    const families=[];

    for(const spec of design){
      const livedAll=obs.filter(o=>o.collection===raw12Collection&&o.condition===spec.measuredCondition&&replicates.includes(Number(o.replicate)));
      const coldAll=obs.filter(o=>o.collection===coldCollection&&o.condition===spec.coldCondition);
      for(const replicate of replicates){
        const lived=livedAll.filter(o=>Number(o.replicate)===Number(replicate));
        anchors.push({
          schema:'blum-raw12-cold-counterpart-anchor-v0',
          anchorId:`${spec.anchorFamily}-r${replicate}`,
          anchorFamily:spec.anchorFamily,
          replicate:Number(replicate),
          expectedSnapshotPath:`${raw12Collection}/${spec.anchorFamily}-r${replicate}.messages.json`,
          measuredCondition:spec.measuredCondition,
          coldCondition:spec.coldCondition,
          relation:'designed_counterpart_not_lineage',
          measuredObservationCount:lived.length,
          measuredByItem:indexByItem(lived),
        });
      }
      const livedItems=indexByItem(livedAll);
      const coldItems=indexByItem(coldAll);
      const itemIds=[...new Set([...Object.keys(livedItems),...Object.keys(coldItems)])].sort();
      const items={};
      for(const itemId of itemIds){
        const lived=livedItems[itemId]||[];
        const cold=coldItems[itemId]||[];
        items[itemId]={
          itemId,
          lived,
          cold,
          livedN:lived.length,
          coldN:cold.length,
          complete:lived.length>0&&cold.length>0,
        };
      }
      families.push({
        schema:'blum-raw12-cold-counterpart-family-v0',
        anchorFamily:spec.anchorFamily,
        measuredCondition:spec.measuredCondition,
        coldCondition:spec.coldCondition,
        relation:'designed_counterpart_not_lineage',
        raw12Collection,coldCollection,
        anchorReplicates:replicates.slice(),
        measuredObservationCount:livedAll.length,
        coldObservationCount:coldAll.length,
        coldPopulationPolicy:'retain_all_available_cold_replicates',
        items,
      });
    }

    const missingAnchors=anchors.filter(a=>a.measuredObservationCount===0).map(a=>a.anchorId);
    return {
      schema:'blum-raw12-cold-counterpart-resolution-v0',
      raw12Collection,coldCollection,
      design:design.map(x=>({...x})),
      replicates:replicates.slice(),
      anchorCount:anchors.length,
      resolvedAnchorCount:anchors.length-missingAnchors.length,
      missingAnchors,
      anchors,
      families,
    };
  }

  function familyFor(result,anchorFamily){return result?.families?.find(x=>x.anchorFamily===anchorFamily)||null;}
  function itemFor(result,anchorFamily,itemId){return familyFor(result,anchorFamily)?.items?.[itemId]||null;}

  return {DEFAULT_DESIGN,DEFAULT_REPLICATES,allObservations,indexByItem,resolve,familyFor,itemFor};
});