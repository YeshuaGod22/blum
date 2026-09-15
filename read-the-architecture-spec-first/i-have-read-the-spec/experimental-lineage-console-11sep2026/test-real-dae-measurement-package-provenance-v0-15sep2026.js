'use strict';

const assert = require('assert');
const path = require('path');
const Whole = require('./dae-whole-corpus-index-cli-v1-12sep2026.js');
const Answer = require('./answer-outcome-projection-v0-12sep2026.js');
const Provenance = require('./measurement-package-provenance-v0-15sep2026.js');

function countBy(rows, field) {
  return rows.reduce((out, row) => {
    const key = String(row?.[field] ?? '<missing>');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-real-dae-measurement-package-provenance-v0-15sep2026.js <dae-repo-root>');
  const experimentRoot = path.join(path.resolve(daeRoot), 'experiments/EXP-003-the-sixth-question');
  const index = Whole.buildWholeCorpusIndex(experimentRoot, {
    repository: 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: 'e2d484b41461013832c00e9f1ba3549ac0ef2517',
    pathPrefix: 'experiments/EXP-003-the-sixth-question',
  });

  assert.equal(index.observationCount, 2378);
  const rows = index.observations.map(observation => {
    const answer = Answer.project(observation);
    const responseSurface = {
      status: answer.status || null,
      source: answer.source || null,
      section: answer.section || null,
      text: answer.status === 'ok' ? (answer.text ?? null) : null,
      candidateText: answer.status === 'adjudication_required' ? (answer.candidateText ?? null) : null,
    };
    return {
      observationId: observation.observationId,
      collection: observation.collection,
      sourcePath: observation.sourcePath,
      answerStatus: answer.status,
      answerSection: answer.section || null,
      ...Provenance.resolveObservationPackageProvenance(index, observation, responseSurface),
    };
  });

  const unresolvedCalls = rows.filter(row => row.status !== 'call_resolved');
  const missingPackageRefs = rows.filter(row => row.status === 'call_resolved' && (!row.callUid || !row.inputPackageUid || !row.outputPackageUid));
  const badSectionResolution = rows.filter(row => row.answerSection && !['resolved_by_tag', 'resolved_by_tag_and_text', 'section_ambiguous'].includes(row.outputSectionStatus));

  console.log('MEASUREMENT PACKAGE PROVENANCE CENSUS');
  console.log(JSON.stringify({
    observations: rows.length,
    callStatuses: countBy(rows, 'status'),
    joinMethods: countBy(rows, 'joinMethod'),
    outputSectionStatuses: countBy(rows, 'outputSectionStatus'),
    unresolvedCalls: unresolvedCalls.slice(0, 20),
    missingPackageRefs: missingPackageRefs.slice(0, 20),
    badSectionResolution: badSectionResolution.slice(0, 20),
  }, null, 2));

  assert.equal(unresolvedCalls.length, 0, 'every normalized observation must bind to exactly one inference call');
  assert.equal(missingPackageRefs.length, 0, 'every resolved observation must expose input/output package UIDs');
  assert.equal(badSectionResolution.length, 0, 'designated answer sections must resolve or explicitly report multiple occurrences');
  assert.equal(rows.filter(row => row.joinMethod === 'observation_id').length, 2368, 'all raw2+ observations should join by observationId');
  assert.equal(rows.filter(row => row.joinMethod === 'pilot1_metadata').length, 10, 'Pilot-1 observations should use the explicit historical metadata bridge');

  console.log('PASS real DAE measurement/package provenance conservation');
}

main();
