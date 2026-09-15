'use strict';

// CANONICAL MEASUREMENT COMPILER v0 — 14 Sep 2026
//
// Materializes battery measurements once, upstream of analysis. The compiler
// refuses to invent parser semantics: every mechanically parsed measurement
// must name an item parser in the frozen battery and that parser must resolve
// in the supplied parser registry. Anything else remains an explicit terminal
// or adjudication-required state.
//
// When the source index carries the inference-package graph, each measurement
// is also mechanically joined to the call/output package that produced it and,
// where uniquely resolvable, the exact output section used as its answer surface.

const crypto = require('crypto');
const PackageProvenance = require('./measurement-package-provenance-v0-15sep2026.js');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function sha256(text) {
  return 'sha256:' + crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

function parserFunction(entry) {
  if (typeof entry === 'function') return entry;
  if (entry && typeof entry.parse === 'function') return entry.parse.bind(entry);
  return null;
}

function normalizeParserResult(result) {
  if (!result || typeof result !== 'object') return { parsed:false, kind:null, value:null, rawResult:result ?? null };
  if (result.status === 'parsed') return { parsed:true, kind:result.kind || null, value:result.value ?? null, rawResult:result };
  if (result.status === 'unparsed' || result.status === 'ambiguous') return { parsed:false, kind:result.kind || null, value:null, rawResult:result, status:result.status };
  return {
    parsed:Boolean(result.parsed),
    kind:result.kind || null,
    value:result.parsed ? (result.value ?? null) : null,
    rawResult:result,
    status:result.status || null,
  };
}

function measurementId(battery, observation, item) {
  const material = {
    batteryId:battery.batteryId,
    batteryVersion:battery.version,
    batteryFingerprint:battery.fingerprint,
    itemId:item.id,
    parser:item.parser || null,
    observationId:observation.observationId,
    presentationHash:observation.presentationHash || null,
    itemCoreHash:observation.itemCoreHash || null,
  };
  return 'm_' + sha256(stableStringify(material)).slice('sha256:'.length, 'sha256:'.length + 20);
}

function taskFor(row, taskType, reason) {
  const material = [row.measurementId, taskType, reason].join('|');
  return {
    taskId:'adj_' + sha256(material).slice('sha256:'.length, 'sha256:'.length + 20),
    taskType,
    reason,
    measurementId:row.measurementId,
    observationId:row.observationId,
    itemId:row.itemId,
    itemVersion:row.itemVersion,
    callUid:row.packageProvenance?.callUid || null,
    outputPackageUid:row.packageProvenance?.outputPackageUid || null,
    outputSectionUid:row.packageProvenance?.outputSectionUid || null,
  };
}

function baseRow(battery, item, observation) {
  return {
    schema:'blum-canonical-measurement-row-v0',
    measurementId:measurementId(battery, observation, item),
    observationId:observation.observationId,
    collection:observation.collection || null,
    condition:observation.condition || null,
    family:observation.family || null,
    replicate:observation.replicate ?? null,
    itemId:item.id,
    itemVersion:battery.version,
    batteryId:battery.batteryId,
    batteryFingerprint:battery.fingerprint,
    parserId:item.parser || null,
    responseType:item.responseType || null,
    presentationHash:observation.presentationHash || null,
    itemCoreHash:observation.itemCoreHash || null,
    sourcePath:observation.sourcePath || null,
    callOutcome:observation.callOutcome || null,
    stopReason:observation.stopReason || null,
    responseSurface:null,
    packageProvenance:null,
    parseStatus:null,
    resolutionStatus:null,
    valueKind:null,
    value:null,
    adjudicationTask:null,
    parserEvidence:null,
  };
}

function compileObservation(battery, item, observation, deps) {
  const row = baseRow(battery, item, observation);
  const answer = deps.answerOutcome.project(observation);
  row.responseSurface = {
    status:answer.status || null,
    source:answer.source || null,
    section:answer.section || null,
    text:answer.status === 'ok' ? (answer.text ?? null) : null,
    candidateText:answer.status === 'adjudication_required' ? (answer.candidateText ?? null) : null,
  };
  row.packageProvenance = deps.packageProvenanceResolver
    ? deps.packageProvenanceResolver(observation, row.responseSurface)
    : {
        status:'package_provenance_unavailable', joinMethod:null,
        callUid:null, inputPackageUid:null, outputPackageUid:null,
        outputSectionUid:null, outputSectionStatus:'not_resolved',
      };

  if (answer.status === 'empty') {
    row.parseStatus='empty';
    row.resolutionStatus='empty_output';
    return row;
  }

  if (answer.status !== 'ok') {
    row.parseStatus='ambiguous';
    row.resolutionStatus='adjudication_required';
    row.adjudicationTask=taskFor(row, 'answer_surface', answer.reason || 'answer_surface_unresolved');
    return row;
  }

  if (!item.parser) {
    row.parseStatus='parser_spec_unavailable';
    row.resolutionStatus='parser_spec_unavailable';
    return row;
  }

  const parse = parserFunction(deps.parsers && deps.parsers[item.parser]);
  if (!parse) {
    row.parseStatus='parser_spec_unavailable';
    row.resolutionStatus='parser_spec_unavailable';
    return row;
  }

  let normalized;
  try {
    normalized = normalizeParserResult(parse(answer.text, { item, observation, answer, battery }));
  } catch (error) {
    row.parseStatus='parser_error';
    row.resolutionStatus='adjudication_required';
    row.parserEvidence={error:String(error && error.message || error)};
    row.adjudicationTask=taskFor(row, 'measurement_parse', 'parser_error');
    return row;
  }

  row.parserEvidence={
    parserId:item.parser,
    parserResultStatus:normalized.status || null,
    rawResult:normalized.rawResult,
  };

  if (normalized.parsed) {
    row.parseStatus='parsed';
    row.resolutionStatus='mechanically_resolved';
    row.valueKind=normalized.kind;
    row.value=normalized.value;
    return row;
  }

  row.parseStatus=normalized.status === 'ambiguous' ? 'ambiguous' : 'unparsed';
  row.resolutionStatus='adjudication_required';
  row.adjudicationTask=taskFor(row, 'measurement_parse', row.parseStatus);
  return row;
}

function summarize(rows, itemIds) {
  const byItem = Object.fromEntries(itemIds.map(id => [id, {itemId:id, observationCount:0, statuses:{}, resolvedCount:0, adjudicationRequiredCount:0, parserSpecUnavailableCount:0}]));
  for (const row of rows) {
    const s=byItem[row.itemId] || (byItem[row.itemId]={itemId:row.itemId,observationCount:0,statuses:{},resolvedCount:0,adjudicationRequiredCount:0,parserSpecUnavailableCount:0});
    s.observationCount += 1;
    s.statuses[row.parseStatus]=(s.statuses[row.parseStatus]||0)+1;
    if (row.resolutionStatus === 'mechanically_resolved') s.resolvedCount += 1;
    if (row.resolutionStatus === 'adjudication_required') s.adjudicationRequiredCount += 1;
    if (row.resolutionStatus === 'parser_spec_unavailable') s.parserSpecUnavailableCount += 1;
  }
  return itemIds.map(id => byItem[id]);
}

function compileCanonicalMeasurements(index, battery, deps) {
  if (!index || index.schema !== 'blum-dae-unified-observation-index-v1') throw new Error('unsupported_index_schema');
  if (!battery || battery.schema !== 'blum-battery-v0') throw new Error('unsupported_battery_schema');
  if (battery.status !== 'frozen' || !battery.fingerprint) throw new Error('frozen_battery_required');
  if (!deps || !deps.answerOutcome || typeof deps.answerOutcome.project !== 'function') throw new Error('answer_outcome_projection_required');
  if (!deps.parsers || typeof deps.parsers !== 'object') throw new Error('parser_registry_required');

  const effectiveDeps = {
    ...deps,
    packageProvenanceResolver: typeof deps.packageProvenanceResolver === 'function'
      ? deps.packageProvenanceResolver
      : ((observation, responseSurface) => PackageProvenance.resolveObservationPackageProvenance(index, observation, responseSurface)),
  };

  const itemIds=battery.items.map(x => String(x.id));
  const rows=[];
  for (const item of battery.items) {
    const observations=index.itemHistories?.[item.id]?.observations || [];
    for (const observation of observations) rows.push(compileObservation(battery,item,observation,effectiveDeps));
  }

  const adjudicationQueue=rows.filter(r => r.resolutionStatus === 'adjudication_required').map(r => ({...r.adjudicationTask}));
  return {
    schema:'blum-canonical-measurement-dataset-v0',
    generatedAt:new Date().toISOString(),
    sourceIndex:{
      schema:index.schema,
      generatedAt:index.generatedAt || null,
      observationCount:index.observationCount ?? null,
      itemCount:index.itemCount ?? null,
      repository:index.source?.repository || null,
      commit:index.source?.commit || null,
      inferencePackageGraphSchema:index.inferencePackageGraph?.schema || null,
    },
    batteryRef:{
      batteryId:battery.batteryId,
      version:battery.version,
      fingerprint:battery.fingerprint,
    },
    itemIds,
    measurementCount:rows.length,
    summaries:summarize(rows,itemIds),
    packageProvenanceSummary:PackageProvenance.summarizePackageProvenance(rows),
    rows,
    adjudicationQueue,
  };
}

module.exports={stableStringify,sha256,parserFunction,normalizeParserResult,measurementId,taskFor,compileObservation,summarize,compileCanonicalMeasurements};
