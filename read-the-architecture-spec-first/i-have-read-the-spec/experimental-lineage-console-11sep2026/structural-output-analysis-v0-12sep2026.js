'use strict';

// STRUCTURAL OUTPUT ANALYSIS v0 — 12 Sep 2026
// Deterministic analysis of section presence/absence and section lengths.
// Missing structure is an observable outcome; it is never imputed from another section.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumStructuralAnalysisV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function sectionText(value) {
    if (Array.isArray(value)) return value.join('\n\n');
    if (value === null || value === undefined) return null;
    return String(value);
  }

  function profile(observation) {
    if (!observation || typeof observation !== 'object') throw new Error('observation_object_required');
    const sections = observation.sections || {};
    const names = Object.keys(sections).sort();
    const sectionProfiles = {};
    for (const name of names) {
      const text = sectionText(sections[name]);
      if (text === null || !text.trim()) continue;
      sectionProfiles[name] = {
        present: true,
        charCount: text.length,
        lineCount: text ? text.split(/\r?\n/).length : 0,
        integrity: observation.sectionIntegrity?.[name] || 'present_unclassified',
      };
    }
    const presentSections = Object.keys(sectionProfiles).sort();
    return {
      schema: 'blum-structural-output-profile-v0',
      observationId: observation.observationId || null,
      presentSections,
      sectionCount: presentSections.length,
      signature: presentSections.join('+'),
      sections: sectionProfiles,
      rawCharCount: String(observation.rawOutput ?? '').length,
      callOutcome: observation.callOutcome || null,
    };
  }

  function compare(leftObservation, rightObservation) {
    const left = profile(leftObservation);
    const right = profile(rightObservation);
    const names = [...new Set([...left.presentSections, ...right.presentSections])].sort();
    const sectionComparisons = {};
    const leftOnly = [];
    const rightOnly = [];
    const shared = [];

    for (const name of names) {
      const l = left.sections[name] || null;
      const r = right.sections[name] || null;
      const both = Boolean(l && r);
      if (both) shared.push(name);
      else if (l) leftOnly.push(name);
      else if (r) rightOnly.push(name);
      sectionComparisons[name] = {
        leftPresent: Boolean(l),
        rightPresent: Boolean(r),
        bothPresent: both,
        presenceAgreement: Boolean(l) === Boolean(r),
        leftCharCount: l?.charCount ?? null,
        rightCharCount: r?.charCount ?? null,
        signedCharDelta: both ? r.charCount - l.charCount : null,
        absoluteCharDelta: both ? Math.abs(r.charCount - l.charCount) : null,
        leftIntegrity: l?.integrity ?? 'missing',
        rightIntegrity: r?.integrity ?? 'missing',
      };
    }

    return {
      schema: 'blum-structural-output-comparison-v0',
      left,
      right,
      sameSignature: left.signature === right.signature,
      sharedSections: shared,
      leftOnlySections: leftOnly,
      rightOnlySections: rightOnly,
      sectionComparisons,
    };
  }

  function aggregatePairCoverage(pairs, surfaces) {
    const names = surfaces?.length ? [...new Set(surfaces)] : [...new Set((pairs || []).flatMap(([l, r]) => [
      ...Object.keys(l?.sections || {}), ...Object.keys(r?.sections || {})
    ]))].sort();
    const out = {};
    for (const name of names) out[name] = { both: 0, leftOnly: 0, rightOnly: 0, neither: 0 };
    for (const [left, right] of (pairs || [])) {
      for (const name of names) {
        const lp = Boolean(sectionText(left?.sections?.[name])?.trim());
        const rp = Boolean(sectionText(right?.sections?.[name])?.trim());
        if (lp && rp) out[name].both++;
        else if (lp) out[name].leftOnly++;
        else if (rp) out[name].rightOnly++;
        else out[name].neither++;
      }
    }
    return {
      schema: 'blum-structural-pair-coverage-v0',
      pairCount: (pairs || []).length,
      surfaces: out,
    };
  }

  return { sectionText, profile, compare, aggregatePairCoverage };
});
