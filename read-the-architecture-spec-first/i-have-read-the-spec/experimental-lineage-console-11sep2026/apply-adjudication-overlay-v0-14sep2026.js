'use strict';

// APPLY ADJUDICATION OVERLAY v0 — 14 Sep 2026
// Mechanical measurement fields are immutable. Adjudication is represented as
// a separate effective-result layer with explicit provenance.

function effectiveFromEntry(entry) {
  const j=entry.judgment || {};
  if (j.validatedStatus==='refusal_no_single_answer') {
    return {status:'adjudicated_no_single_answer',valueKind:null,value:null,derivation:null};
  }
  if (j.numericValue!==null && j.numericValue!==undefined) {
    return {
      status:'adjudicated_resolved',
      valueKind:'number',
      value:j.numericValue,
      derivation:j.validatedStatus==='range_midpoint_answer' ? 'historical_range_midpoint_rule' : 'historical_validated_answer',
    };
  }
  if (j.sentinelValue!==null && j.sentinelValue!==undefined) {
    return {status:'adjudicated_resolved',valueKind:'sentinel',value:j.sentinelValue,derivation:'historical_validated_sentinel'};
  }
  return {status:'adjudicated_unresolved',valueKind:null,value:null,derivation:null};
}

function applyAdjudicationOverlay(measurements,overlay) {
  if (!measurements || measurements.schema!=='blum-canonical-measurement-dataset-v0') throw new Error('unsupported_measurement_schema');
  if (!overlay || overlay.schema!=='blum-historical-adjudication-overlay-v0') throw new Error('unsupported_overlay_schema');
  const byMeasurement=new Map();
  for (const entry of overlay.imported || []) {
    if (byMeasurement.has(entry.measurementId)) throw new Error('duplicate_overlay_measurement:'+entry.measurementId);
    byMeasurement.set(entry.measurementId,entry);
  }
  const rows=(measurements.rows || []).map(row=>{
    const entry=byMeasurement.get(row.measurementId);
    const mechanical={
      parseStatus:row.parseStatus,
      resolutionStatus:row.resolutionStatus,
      valueKind:row.valueKind,
      value:row.value,
      adjudicationTask:row.adjudicationTask,
      parserEvidence:row.parserEvidence,
    };
    if (!entry) {
      return {
        ...row,
        mechanical,
        adjudication:null,
        effective:{
          status:row.resolutionStatus,
          valueKind:row.valueKind,
          value:row.value,
          source:'mechanical',
          derivation:null,
        },
      };
    }
    const e=effectiveFromEntry(entry);
    return {
      ...row,
      mechanical,
      adjudication:{
        overlayId:entry.overlayId,
        judgment:entry.judgment,
        provenance:entry.provenance,
      },
      effective:{...e,source:'historical_adjudication'},
    };
  });
  const matched=new Set(rows.filter(r=>r.adjudication).map(r=>r.measurementId));
  const dangling=(overlay.imported || []).filter(e=>!matched.has(e.measurementId)).map(e=>e.measurementId);
  return {
    ...measurements,
    schema:'blum-effective-measurement-dataset-v0',
    baseMeasurementSchema:measurements.schema,
    baseGeneratedAt:measurements.generatedAt || null,
    adjudicationOverlay:{
      schema:overlay.schema,
      sourceArtifact:overlay.sourceArtifact,
      importedCount:overlay.importedCount,
      ambiguousCount:overlay.ambiguousCount,
      unmatchedCount:overlay.unmatchedCount,
      appliedCount:matched.size,
      danglingMeasurementIds:dangling,
    },
    rows,
  };
}

module.exports={effectiveFromEntry,applyAdjudicationOverlay};
