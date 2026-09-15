'use strict';

// Joins canonical observation/measurement rows to the inference event that
// produced them. Exact observationId is primary. Pilot-1 historical rows use a
// deterministic metadata join because the original package graph predates
// explicit Pilot observation IDs; ambiguity is surfaced rather than guessed.

function sameNullable(a, b) {
  return (a ?? null) === (b ?? null);
}

function pilotCallCandidates(graph, observation) {
  const itemId = String(observation?.canonicalItemId ?? observation?.itemId ?? '');
  const candidates = Object.values(graph?.calls || {}).filter(call => {
    if (call.collection !== 'pilot1') return false;
    if (String(call.probeId ?? '') !== itemId) return false;
    if (!sameNullable(call.family, observation?.family || observation?.condition || null)) return false;
    if (!sameNullable(call.replicate, observation?.replicate ?? null)) return false;
    if (observation?.sourcePath && call.sourcePath !== observation.sourcePath) return false;
    const ancestry = observation?.ancestryType || null;
    if (ancestry === 'cold_no_lived_parent') return call.sourceKind === 'pilot1_cold_call' && call.forkId === 'cold';
    if (ancestry === 'pilot1_lived_trunk_branch') return call.sourceKind === 'pilot1_branch_call' && sameNullable(call.forkId, observation?.forkId ?? null);
    if (ancestry === 'pilot1_lived_trunk') return call.sourceKind === 'pilot1_trunk_turn';
    return true;
  });
  return candidates;
}

function callCandidates(graph, observation) {
  const observationId = observation?.observationId ? String(observation.observationId) : null;
  if (observationId) {
    const exact = Object.values(graph?.calls || {}).filter(call => String(call.observationId || '') === observationId);
    if (exact.length) return { joinMethod: 'observation_id', candidates: exact };
  }
  if (observation?.collection === 'pilot1') {
    return { joinMethod: 'pilot1_metadata', candidates: pilotCallCandidates(graph, observation) };
  }
  return { joinMethod: observationId ? 'observation_id' : 'none', candidates: [] };
}

function outputSectionCandidates(graph, outputPackageUid, tag) {
  if (!tag || !outputPackageUid) return [];
  const pkg = graph?.outputPackages?.[outputPackageUid];
  if (!pkg) return [];
  return (pkg.sectionUids || [])
    .map(uid => graph?.sections?.[uid])
    .filter(section => section && section.packageSide === 'output' && section.tag === tag);
}

function resolveObservationPackageProvenance(index, observation, responseSurface = null) {
  const graph = index?.inferencePackageGraph;
  if (!graph?.calls || !graph?.outputPackages || !graph?.sections) {
    return {
      status: 'package_provenance_unavailable',
      joinMethod: null,
      callUid: null,
      inputPackageUid: null,
      outputPackageUid: null,
      outputSectionUid: null,
      outputSectionStatus: 'not_resolved',
    };
  }

  const { joinMethod, candidates } = callCandidates(graph, observation);
  if (candidates.length === 0) {
    return {
      status: 'call_unresolved', joinMethod, candidateCallCount: 0,
      callUid: null, inputPackageUid: null, outputPackageUid: null,
      outputSectionUid: null, outputSectionStatus: 'not_resolved',
    };
  }
  if (candidates.length > 1) {
    return {
      status: 'call_ambiguous', joinMethod, candidateCallCount: candidates.length,
      candidateCallUids: candidates.map(x => x.callUid).sort(),
      callUid: null, inputPackageUid: null, outputPackageUid: null,
      outputSectionUid: null, outputSectionStatus: 'not_resolved',
    };
  }

  const call = candidates[0];
  const result = {
    status: 'call_resolved',
    joinMethod,
    candidateCallCount: 1,
    callUid: call.callUid,
    inputPackageUid: call.inputPackageUid,
    outputPackageUid: call.outputPackageUid,
    outputSectionUid: null,
    outputSectionStatus: 'not_requested',
  };

  const tag = responseSurface?.section || null;
  if (!tag) return result;

  const sections = outputSectionCandidates(graph, call.outputPackageUid, tag);
  if (sections.length === 0) {
    result.outputSectionStatus = 'section_not_found';
    return result;
  }
  if (sections.length > 1) {
    const text = responseSurface?.text ?? responseSurface?.candidateText ?? null;
    if (text !== null) {
      const exactText = sections.filter(section => String(section.content ?? '') === String(text));
      if (exactText.length === 1) {
        result.outputSectionUid = exactText[0].sectionUid;
        result.outputSectionStatus = 'resolved_by_tag_and_text';
        return result;
      }
    }
    result.outputSectionStatus = 'section_ambiguous';
    result.candidateOutputSectionUids = sections.map(x => x.sectionUid).sort();
    return result;
  }

  result.outputSectionUid = sections[0].sectionUid;
  result.outputSectionStatus = 'resolved_by_tag';
  return result;
}

function summarizePackageProvenance(rows) {
  const out = { rows: rows.length, callStatuses: {}, sectionStatuses: {} };
  for (const row of rows) {
    const p = row.packageProvenance || {};
    const callStatus = p.status || '<missing>';
    const sectionStatus = p.outputSectionStatus || '<missing>';
    out.callStatuses[callStatus] = (out.callStatuses[callStatus] || 0) + 1;
    out.sectionStatuses[sectionStatus] = (out.sectionStatuses[sectionStatus] || 0) + 1;
  }
  return out;
}

module.exports = {
  sameNullable,
  pilotCallCandidates,
  callCandidates,
  outputSectionCandidates,
  resolveObservationPackageProvenance,
  summarizePackageProvenance,
};
