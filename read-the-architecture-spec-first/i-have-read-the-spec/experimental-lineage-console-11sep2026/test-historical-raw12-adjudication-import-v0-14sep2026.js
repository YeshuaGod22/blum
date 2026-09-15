'use strict';
const assert=require('assert');
const I=require('./historical-raw12-adjudication-import-v0-14sep2026.js');
const O=require('./apply-adjudication-overlay-v0-14sep2026.js');

function row(measurementId,sourcePath,extra={}) {
  return {
    schema:'blum-canonical-measurement-row-v0',measurementId,observationId:'obs-'+measurementId,itemId:extra.itemId||'N4',itemVersion:1,
    collection:extra.collection||'raw12',condition:extra.condition||'C',family:'C',replicate:1,sourcePath,
    parseStatus:extra.parseStatus||'unparsed',resolutionStatus:extra.resolutionStatus||'adjudication_required',
    valueKind:extra.valueKind||null,value:extra.value??null,adjudicationTask:{taskId:'adj-'+measurementId},parserEvidence:{parserId:'strict_number'},
    packageProvenance:{
      status:'call_resolved',joinMethod:'observation_id',callUid:'call-'+measurementId,inputPackageUid:'in-'+measurementId,
      outputPackageUid:'out-'+measurementId,outputSectionUid:'sec-'+measurementId,outputSectionStatus:'resolved_by_tag',
    },
  };
}
const measurements={
  schema:'blum-canonical-measurement-dataset-v0',generatedAt:'fixture',measurementCount:5,itemIds:['N4','R2'],
  rows:[
    row('m_exact','experiments/EXP-003-the-sixth-question/raw12/AS0-r2-N4.json'),
    row('m_range','experiments/EXP-003-the-sixth-question/raw12/AS0-r2-R2.json',{itemId:'R2',parseStatus:'parsed',resolutionStatus:'mechanically_resolved',valueKind:'number',value:2}),
    row('m_dup1','experiments/EXP-003-the-sixth-question/raw12/DUP.json'),
    row('m_dup2','mirror/raw12/DUP.json'),
    row('m_wrong_collection','experiments/EXP-003-the-sixth-question/raw11/ONLY11.json',{collection:'raw11'}),
  ],
};
const artifact={
  schema_version:1,
  rubric:'Frozen historical fixture rubric.',
  rows:{
    'AS0-r2-N4.json':{validated_status:'refusal_no_single_answer',validated_numeric_value:null,validated_sentinel:null,basis:'refused scalar'},
    'AS0-r2-R2.json':{validated_status:'range_midpoint_answer',validated_numeric_value:3,validated_sentinel:null,basis:'2-4 range under historical midpoint rule'},
    'DUP.json':{validated_status:'parser_boundary_corrected',validated_numeric_value:42,validated_sentinel:null,basis:'fixture duplicate'},
    'MISSING.json':{validated_status:'answer_despite_objection',validated_numeric_value:55,validated_sentinel:null,basis:'fixture missing'},
    'ONLY11.json':{validated_status:'parser_boundary_corrected',validated_numeric_value:7,validated_sentinel:null,basis:'wrong collection must not match'},
  },
};

const imported=I.importRaw12Adjudications(measurements,artifact,{commit:'fixture-dae-commit'});
assert.equal(imported.importedCount,2);
assert.equal(imported.ambiguousCount,1);
assert.equal(imported.unmatchedCount,2);
assert.deepEqual(imported.imported.map(x=>x.measurementId).sort(),['m_exact','m_range']);
assert.equal(imported.ambiguous[0].fileName,'DUP.json');
assert.deepEqual(imported.ambiguous[0].measurementIds.sort(),['m_dup1','m_dup2']);
assert.deepEqual(imported.unmatched.map(x=>x.fileName).sort(),['MISSING.json','ONLY11.json']);
assert.ok(imported.sourceArtifact.fingerprint.startsWith('sha256:'));
assert.equal(imported.imported[0].provenance.importPolicy,'exact_raw12_collection_plus_exact_source_basename_unique_match_v0');
assert.equal(imported.imported[0].provenance.measurementPackageProvenanceCopiedAfterExactMeasurementMatch,true);

const exactEntry=imported.imported.find(x=>x.measurementId==='m_exact');
assert.equal(exactEntry.packageProvenance.callUid,'call-m_exact');
assert.equal(exactEntry.packageProvenance.inputPackageUid,'in-m_exact');
assert.equal(exactEntry.packageProvenance.outputPackageUid,'out-m_exact');
assert.equal(exactEntry.packageProvenance.outputSectionUid,'sec-m_exact');
assert.equal(exactEntry.packageProvenance.status,'call_resolved');

const effective=O.applyAdjudicationOverlay(measurements,imported);
assert.equal(effective.schema,'blum-effective-measurement-dataset-v0');
assert.equal(effective.adjudicationOverlay.appliedCount,2);
assert.deepEqual(effective.adjudicationOverlay.danglingMeasurementIds,[]);
const byId=Object.fromEntries(effective.rows.map(r=>[r.measurementId,r]));

// Historical refusal resolves substantive status without manufacturing a number.
assert.equal(byId.m_exact.effective.status,'adjudicated_no_single_answer');
assert.equal(byId.m_exact.effective.value,null);
assert.equal(byId.m_exact.effective.source,'historical_adjudication');
assert.equal(byId.m_exact.mechanical.parseStatus,'unparsed');
assert.equal(byId.m_exact.parseStatus,'unparsed','top-level canonical mechanical fields remain unchanged');
assert.equal(byId.m_exact.adjudication.packageProvenance.callUid,'call-m_exact');
assert.equal(byId.m_exact.adjudication.packageProvenance.outputPackageUid,'out-m_exact');
assert.equal(byId.m_exact.adjudication.packageProvenance.outputSectionUid,'sec-m_exact');

// Historical midpoint remains explicitly attributed to its historical frozen rule.
assert.equal(byId.m_range.effective.status,'adjudicated_resolved');
assert.equal(byId.m_range.effective.valueKind,'number');
assert.equal(byId.m_range.effective.value,3);
assert.equal(byId.m_range.effective.derivation,'historical_range_midpoint_rule');
assert.equal(byId.m_range.value,2,'mechanical value must not be overwritten');
assert.equal(byId.m_range.mechanical.value,2);
assert.equal(byId.m_range.adjudication.judgment.validatedStatus,'range_midpoint_answer');
assert.equal(byId.m_range.adjudication.packageProvenance.callUid,'call-m_range');

// Unmatched/ambiguous historical rows cannot silently alter measurements.
assert.equal(byId.m_dup1.adjudication,null);
assert.equal(byId.m_dup1.effective.source,'mechanical');
assert.equal(byId.m_wrong_collection.adjudication,null);

console.log('historical RAW12 adjudication import + overlay package-provenance regression: PASS');
