'use strict';

// Materialize blinded, provider-agnostic assignments for the raw12 CF1 re-review.
// Usage:
//   node materialize-raw12-cf1-rereview-v0-13sep2026.js \
//     <DevelopmentalAttractorEngineering-root> [output.json]
//
// This does not call readers and does not adjudicate. It only converts the three
// frozen re-review source records into evidence-addressable assignments for the
// Blum execution spine. Prior CF1 labels and experimental condition labels are
// deliberately not copied into reader packets.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./dae-raw-call-lineage-import-adapter-v0-11sep2026.js');
const E = require('./adjudication-execution-core-v2-13sep2026.js');

const EXP_REL = 'experiments/EXP-003-the-sixth-question';
const RAW_REL = path.join(EXP_REL, 'raw12');
const SPEC_NAME = 'raw12-cf1-rereview-adjudication-pass-v0-13sep2026.json';
const SOURCE_FILES = ['F0-r1-D1.json', 'F0-r3-D1.json', 'AS0-r3-R2.json'];

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8'); }
function normalizeQuestion(spec) {
  return (spec.questions || []).map(q => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    requiresTargetEvidenceSpan: Boolean(q.requiresTargetEvidenceSpan),
    requiresShortRationale: Boolean(q.requiresShortRationale),
  }));
}
function currentBatteryQuestion(record) {
  const sent = A.deriveParentPrefix(record);
  const messages = Array.isArray(record.sent) ? record.sent : [];
  const n = Number(record.prefix_len);
  const after = Number.isInteger(n) ? messages.slice(n) : [];
  const user = after.find(m => String(m && m.role) === 'user');
  if (user && typeof user.content === 'string') return user.content;
  const lastUser = [...messages].reverse().find(m => String(m && m.role) === 'user');
  return lastUser && typeof lastUser.content === 'string' ? lastUser.content : null;
}
function antecedentWitness(record) {
  const prefix = A.deriveParentPrefix(record);
  if (!prefix || prefix.status !== 'verified_from_sent_prefix') {
    throw new Error('unverified_parent_prefix:' + String(record.cell) + ':' + String(record.replicate));
  }
  return prefix.messages;
}
function opaqueUnitId(specId, fileName, record) {
  const material = [specId, fileName, record.parent_prefix, record.item, record.replicate].join('|');
  return 'u_' + sha256(material).slice(0, 12);
}
function makePacket(spec, fileName, record) {
  const imported = A.importBranchRecord(record, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    path: path.posix.join(EXP_REL, 'raw12', fileName),
  });
  const unitId = opaqueUnitId(spec.passId, fileName, record);
  const target = String(record.received ?? '');
  if (!target.trim()) throw new Error('target_response_missing:' + fileName);
  const packet = {
    packetSchema: 'blum-adjudication-packet-v2',
    packetId: 'pkt_' + sha256(spec.passId + '|' + unitId + '|' + sha256(target)).slice(0, 16),
    unitId,
    adjudicationSpecId: spec.passId,
    instructions: {
      purpose: spec.purpose,
      questions: normalizeQuestion(spec),
      derivations: spec.derivations || [],
      antiOverclaim: spec.antiOverclaim || [],
      readerRule: 'Judge only from the visible packet. Use the complete target response as the primary witness. Consult antecedent_context only when needed to resolve what a backward-looking phrase refers to. Do not infer family, condition, prior label, or hypothesis.',
    },
    evidence: {
      battery_question: currentBatteryQuestion(record),
      complete_target_response: target,
      antecedent_context: antecedentWitness(record),
    },
    integrity: {
      targetSha256: 'sha256:' + sha256(target),
      parentContentHash: imported.parentSnapshot && imported.parentSnapshot.contentHash || null,
      parentVerificationStatus: imported.parentVerificationStatus,
      callOutcome: imported.callOutcome,
      stopReason: imported.stopReason,
    },
  };
  return { unitId, packet };
}
function executionSpec(spec) {
  return {
    adjudicationSpecId: spec.passId,
    version: 1,
    fingerprint: E.fingerprint(spec),
    population: spec.population,
    panel: {
      readersPerUnit: Number(spec.panel && spec.panel.recommendedReadersPerUnit) || 3,
      independent: Boolean(spec.panel && spec.panel.independentCalls),
      agreementRule: spec.panel && spec.panel.agreementRule || 'unanimous',
      escalationRule: 'disagreement_or_low_confidence',
    },
    randomisation: {
      shuffle: true,
      opaqueUnitIds: true,
      seed: '20260913-cf1-rereview-v0',
    },
  };
}
function materialize(daeRoot) {
  const spec = readJson(path.join(__dirname, SPEC_NAME));
  const packetByUnit = {};
  const population = [];
  const provenance = [];
  for (const fileName of SOURCE_FILES) {
    const filePath = path.join(daeRoot, RAW_REL, fileName);
    if (!fs.existsSync(filePath)) throw new Error('source_missing:' + filePath);
    const record = readJson(filePath);
    const { unitId, packet } = makePacket(spec, fileName, record);
    packetByUnit[unitId] = packet;
    population.push({ unitId });
    provenance.push({
      unitId,
      sourceRepository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
      sourcePath: path.posix.join(EXP_REL, 'raw12', fileName),
      sourceFileSha256: 'sha256:' + sha256(fs.readFileSync(filePath, 'utf8')),
    });
  }
  const corpusFingerprint = 'sha256:' + sha256(provenance.map(x => x.sourceFileSha256).join('|'));
  const execution = E.freezeExecution(executionSpec(spec), population, corpusFingerprint);
  const assignments = E.materializeReaderSlots(execution, packetByUnit);
  return {
    schema: 'blum-adjudication-batch-v2',
    purpose: spec.purpose,
    sourceSpec: SPEC_NAME,
    execution,
    assignments,
    provenance,
    privacyBoundary: {
      readerPacketsOmit: ['family_label','condition_label','replicate_label','source_filename','prior_CF1_code','exploratory_CF2_code','exploratory_CF3_code','aggregate_statistics','hypothesis'],
      provenanceStoredOutsideReaderPacket: true,
    },
  };
}
function main(argv) {
  const daeRoot = argv[2];
  const out = argv[3] || 'raw12-cf1-rereview-batch-v0-13sep2026.json';
  if (!daeRoot) {
    console.error('Usage: node materialize-raw12-cf1-rereview-v0-13sep2026.js <DevelopmentalAttractorEngineering-root> [output.json]');
    process.exitCode = 2;
    return;
  }
  const batch = materialize(path.resolve(daeRoot));
  writeJson(out, batch);
  console.error(`Wrote ${out}`);
  console.error(JSON.stringify({
    units: batch.execution.populationSnapshot.length,
    assignments: batch.assignments.length,
    readersPerUnit: batch.execution.panel.readersPerUnit,
    executionFingerprint: batch.execution.executionFingerprint,
    specFingerprint: batch.execution.specFingerprint,
    corpusFingerprint: batch.execution.corpusFingerprint,
  }, null, 2));
}
if (require.main === module) main(process.argv);
module.exports = { sha256, currentBatteryQuestion, antecedentWitness, opaqueUnitId, makePacket, executionSpec, materialize };
