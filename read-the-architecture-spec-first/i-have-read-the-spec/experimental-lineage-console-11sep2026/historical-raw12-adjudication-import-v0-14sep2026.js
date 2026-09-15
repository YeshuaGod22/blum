'use strict';

// HISTORICAL RAW12 ADJUDICATION IMPORT v0 — 14 Sep 2026
//
// Imports the frozen DAE EXP-003/RAW12-ADJUDICATIONS.json artifact as an
// adjudication overlay. Matching remains deliberately conservative:
//   collection == raw12 AND exact source basename == historical row key
// must identify exactly one canonical measurement row.
// No response semantics are consulted and no fuzzy filename matching occurs.
// Package/event provenance is copied only AFTER that exact measurement match.

const path=require('path');
const crypto=require('crypto');

function stableStringify(value) {
  if (value===null || typeof value!=='object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(stableStringify).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}
function sha256(text) {
  return 'sha256:'+crypto.createHash('sha256').update(String(text ?? ''),'utf8').digest('hex');
}
function basename(p) { return p ? path.posix.basename(String(p).replace(/\\/g,'/')) : null; }

function validateHistoricalArtifact(artifact) {
  if (!artifact || artifact.schema_version!==1 || !artifact.rows || typeof artifact.rows!=='object') {
    throw new Error('unsupported_raw12_adjudication_artifact');
  }
  if (typeof artifact.rubric!=='string' || !artifact.rubric.trim()) throw new Error('historical_rubric_required');
}

function normalizeJudgment(fileName, judgment) {
  const status=String(judgment && judgment.validated_status || '');
  const numeric=judgment ? judgment.validated_numeric_value : null;
  const sentinel=judgment ? judgment.validated_sentinel : null;
  const basis=judgment && typeof judgment.basis==='string' ? judgment.basis : null;
  const allowed=new Set(['refusal_no_single_answer','range_midpoint_answer','parser_boundary_corrected','answer_despite_objection']);
  if (!allowed.has(status)) throw new Error('unsupported_historical_status:'+fileName+':'+status);
  if (numeric!==null && typeof numeric!=='number') throw new Error('invalid_historical_numeric:'+fileName);
  if (numeric!==null && sentinel!==null) throw new Error('historical_value_collision:'+fileName);
  return {fileName,status,numericValue:numeric,sentinelValue:sentinel ?? null,basis};
}

function candidateRows(measurements,fileName) {
  return (measurements.rows || []).filter(r =>
    String(r.collection || '').toLowerCase()==='raw12' && basename(r.sourcePath)===fileName
  );
}

function packageProvenanceFromRow(row) {
  const p=row?.packageProvenance || {};
  return {
    status:p.status || null,
    joinMethod:p.joinMethod || null,
    callUid:p.callUid || null,
    inputPackageUid:p.inputPackageUid || null,
    outputPackageUid:p.outputPackageUid || null,
    outputSectionUid:p.outputSectionUid || null,
    outputSectionStatus:p.outputSectionStatus || null,
  };
}

function importRaw12Adjudications(measurements,artifact,source={}) {
  if (!measurements || measurements.schema!=='blum-canonical-measurement-dataset-v0') throw new Error('unsupported_measurement_schema');
  validateHistoricalArtifact(artifact);
  const imported=[],ambiguous=[],unmatched=[];
  const artifactFingerprint=source.sha256 || sha256(stableStringify(artifact));
  for (const [fileName,rawJudgment] of Object.entries(artifact.rows).sort(([a],[b])=>a.localeCompare(b))) {
    const judgment=normalizeJudgment(fileName,rawJudgment);
    const candidates=candidateRows(measurements,fileName);
    if (candidates.length===0) {
      unmatched.push({fileName,reason:'no_exact_raw12_source_basename_match'});
      continue;
    }
    if (candidates.length!==1) {
      ambiguous.push({fileName,reason:'non_unique_exact_raw12_source_basename_match',measurementIds:candidates.map(r=>r.measurementId)});
      continue;
    }
    const row=candidates[0];
    imported.push({
      schema:'blum-historical-adjudication-overlay-entry-v0',
      overlayId:'hao_'+sha256([artifactFingerprint,fileName,row.measurementId].join('|')).slice('sha256:'.length,'sha256:'.length+20),
      measurementId:row.measurementId,
      observationId:row.observationId,
      itemId:row.itemId,
      packageProvenance:packageProvenanceFromRow(row),
      sourceMatch:{collection:'raw12',sourceBasename:fileName,sourcePath:row.sourcePath},
      judgment:{
        validatedStatus:judgment.status,
        numericValue:judgment.numericValue,
        sentinelValue:judgment.sentinelValue,
        basis:judgment.basis,
      },
      provenance:{
        sourceRepository:source.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
        sourcePath:source.path || 'experiments/EXP-003-the-sixth-question/RAW12-ADJUDICATIONS.json',
        sourceCommit:source.commit || null,
        sourceArtifactFingerprint:artifactFingerprint,
        sourceSchemaVersion:artifact.schema_version,
        sourceRubric:artifact.rubric,
        importPolicy:'exact_raw12_collection_plus_exact_source_basename_unique_match_v0',
        measurementPackageProvenanceCopiedAfterExactMeasurementMatch:true,
      },
    });
  }
  return {
    schema:'blum-historical-adjudication-overlay-v0',
    generatedAt:new Date().toISOString(),
    sourceArtifact:{
      repository:source.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
      path:source.path || 'experiments/EXP-003-the-sixth-question/RAW12-ADJUDICATIONS.json',
      commit:source.commit || null,
      fingerprint:artifactFingerprint,
      schemaVersion:artifact.schema_version,
      rubric:artifact.rubric,
    },
    importedCount:imported.length,
    ambiguousCount:ambiguous.length,
    unmatchedCount:unmatched.length,
    imported,
    ambiguous,
    unmatched,
  };
}

module.exports={stableStringify,sha256,basename,validateHistoricalArtifact,normalizeJudgment,candidateRows,packageProvenanceFromRow,importRaw12Adjudications};
