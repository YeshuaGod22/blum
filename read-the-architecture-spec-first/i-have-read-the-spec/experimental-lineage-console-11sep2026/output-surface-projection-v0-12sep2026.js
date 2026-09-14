'use strict';

// OUTPUT SURFACE PROJECTION v0 — 12 Sep 2026
// One requested surface in, one explicit projection out. Never falls back
// silently to whole output or to a different XML section.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumOutputSurfaceProjectionV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function textFromSectionValue(value) {
    if (Array.isArray(value)) return value.join('\n\n');
    if (value === null || value === undefined) return null;
    return String(value);
  }

  function project(observation, surface = '__whole__') {
    if (!observation || typeof observation !== 'object') throw new Error('observation_object_required');
    if (!surface) throw new Error('surface_required');

    if (surface === '__whole__') {
      const text = String(observation.rawOutput ?? '');
      return {
        schema: 'blum-output-surface-projection-v0',
        surface,
        status: text.trim() ? 'ok' : 'missing',
        text: text.trim() ? text : null,
        integrity: observation.callOutcome || null,
        sourceObservationId: observation.observationId || null,
      };
    }

    const value = observation.sections?.[surface];
    const text = textFromSectionValue(value);
    if (text === null || !text.trim()) {
      return {
        schema: 'blum-output-surface-projection-v0',
        surface,
        status: 'missing',
        text: null,
        integrity: observation.sectionIntegrity?.[surface] || 'missing',
        sourceObservationId: observation.observationId || null,
      };
    }

    return {
      schema: 'blum-output-surface-projection-v0',
      surface,
      status: 'ok',
      text,
      integrity: observation.sectionIntegrity?.[surface] || 'present_unclassified',
      sourceObservationId: observation.observationId || null,
    };
  }

  function projectPair(left, right, surface = '__whole__') {
    const l = project(left, surface);
    const r = project(right, surface);
    return {
      schema: 'blum-output-surface-pair-v0',
      surface,
      comparable: l.status === 'ok' && r.status === 'ok',
      reason: l.status === 'ok' && r.status === 'ok' ? null : 'surface_missing_on_one_or_both_observations',
      left: l,
      right: r,
    };
  }

  function availableOnBoth(left, right) {
    const a = new Set(Object.keys(left?.sections || {}));
    const b = new Set(Object.keys(right?.sections || {}));
    return [...a].filter(x => b.has(x)).sort();
  }

  return { textFromSectionValue, project, projectPair, availableOnBoth };
});
