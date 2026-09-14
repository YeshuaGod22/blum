'use strict';

// MATERIALIZE MEASUREMENT ADJUDICATION QUEUE v0 — 14 Sep 2026
// Converts unresolved canonical measurement rows into blinded, frozen
// blum-adjudication-batch-v2 assignments. Experimental labels and source
// provenance remain outside reader packets.

const crypto=require('crypto');
const E=require('./adjudication-execution-core-v2-13sep2026.js');

function sha256(text) {
  return crypto.createHash('sha256').update(String(text ?? ''),'utf8').digest('hex');
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function questionProjection(spec) {
  return (spec.questions || []).map(q=>({
    id:q.id,type:q.type,prompt:q.prompt,options:q.options || [],
    evidence:q.evidence || null,confidence:Boolean(q.confidence),
  }));
}
function observationMap(index) {
  return new Map((index.observations || []).map(o=>[String(o.observationId),o]));
}
function itemMap(battery) {
  return new Map((battery.items || []).map(i=>[String(i.id),i]));
}
function opaqueUnitId(specId, measurementId) {
  return 'u_' + sha256(specId+'|'+measurementId).slice(0,12);
}
function makePacket(spec,row,observation,item) {
  if (!observation) throw new Error('observation_missing:'+row.observationId);
  if (!item) throw new Error('item_missing:'+row.itemId);
  const unitId=opaqueUnitId(spec.adjudicationSpecId,row.measurementId);
  const rawResponse=String(observation.rawOutput ?? '');
  const exactQuestion=observation.presentationText || item.text || null;
  const packet={
    packetSchema:'blum-adjudication-packet-v2',
    packetId:'pkt_'+sha256(spec.adjudicationSpecId+'|'+unitId+'|'+sha256(rawResponse)).slice(0,16),
    unitId,
    adjudicationSpecId:spec.adjudicationSpecId,
    instructions:{
      purpose:spec.purpose,
      questions:questionProjection(spec),
      readerRule:spec.blinding?.readerInstruction || 'Judge only the visible packet. Do not infer hidden experimental labels or preferred results.',
      nonClaims:clone(spec.nonClaims || []),
    },
    evidence:{
      exact_question:exactQuestion,
      raw_response:rawResponse,
      mechanical_projection:clone(row.responseSurface),
      mechanical_parser_result:clone(row.parserEvidence),
    },
    integrity:{
      rawResponseSha256:'sha256:'+sha256(rawResponse),
      presentationHash:observation.presentationHash || null,
      itemCoreHash:observation.itemCoreHash || null,
      callOutcome:observation.callOutcome || null,
      stopReason:observation.stopReason || null,
    },
  };
  return {unitId,packet};
}
function executionSpec(spec) {
  return {
    adjudicationSpecId:spec.adjudicationSpecId,
    version:Number.isInteger(spec.version)?spec.version:1,
    fingerprint:E.fingerprint(spec),
    population:clone(spec.population || null),
    panel:clone(spec.panel || {readersPerUnit:3,independent:true,agreementRule:'unanimous_or_majority',escalationRule:'disagreement_or_low_confidence'}),
    randomisation:clone(spec.randomisation || {shuffle:true,opaqueUnitIds:true}),
  };
}
function materialize(measurements,index,battery,spec,options={}) {
  if (!measurements || measurements.schema!=='blum-canonical-measurement-dataset-v0') throw new Error('unsupported_measurement_schema');
  if (!index || index.schema!=='blum-dae-unified-observation-index-v1') throw new Error('unsupported_index_schema');
  if (!battery || battery.schema!=='blum-battery-v0') throw new Error('unsupported_battery_schema');
  if (!spec || !spec.adjudicationSpecId) throw new Error('adjudication_spec_required');
  const allowedTaskTypes=new Set(options.taskTypes || ['answer_surface','measurement_parse']);
  const rows=(measurements.rows || []).filter(r=>r.resolutionStatus==='adjudication_required' && r.adjudicationTask && allowedTaskTypes.has(r.adjudicationTask.taskType));
  const obsById=observationMap(index), itemsById=itemMap(battery);
  const packetByUnit={},population=[],provenance=[];
  for (const row of rows) {
    const observation=obsById.get(String(row.observationId));
    const item=itemsById.get(String(row.itemId));
    const {unitId,packet}=makePacket(spec,row,observation,item);
    packetByUnit[unitId]=packet;
    population.push({unitId});
    provenance.push({
      unitId,
      taskId:row.adjudicationTask.taskId,
      taskType:row.adjudicationTask.taskType,
      measurementId:row.measurementId,
      observationId:row.observationId,
      itemId:row.itemId,
      collection:row.collection,
      condition:row.condition,
      family:row.family,
      replicate:row.replicate,
      sourcePath:row.sourcePath,
    });
  }
  const corpusFingerprint='sha256:'+sha256(E.stableStringify({
    sourceIndex:measurements.sourceIndex,
    batteryRef:measurements.batteryRef,
    measurementIds:rows.map(r=>r.measurementId),
  }));
  const execution=E.freezeExecution(executionSpec(spec),population,corpusFingerprint);
  const assignments=E.materializeReaderSlots(execution,packetByUnit);
  return {
    schema:'blum-adjudication-batch-v2',
    purpose:spec.purpose,
    sourceMeasurementSchema:measurements.schema,
    execution,
    assignments,
    provenance,
    privacyBoundary:{
      readerPacketsOmit:['collection','condition','family','replicate','sourcePath','hypothesis','siblingResponse','aggregateStatistics','downstreamClaim'],
      provenanceStoredOutsideReaderPacket:true,
    },
  };
}

module.exports={sha256,questionProjection,observationMap,itemMap,opaqueUnitId,makePacket,executionSpec,materialize};
