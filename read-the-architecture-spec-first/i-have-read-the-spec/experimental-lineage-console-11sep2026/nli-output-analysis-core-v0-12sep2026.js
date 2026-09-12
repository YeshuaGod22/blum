'use strict';

// NLI OUTPUT ANALYSIS CORE v0 — 12 Sep 2026
// Learned-model analysis boundary. The caller injects classify({premise,hypothesis}).
// Blum preserves direction, provider provenance, labels and scores separately.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumNliAnalysisV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const LABELS = new Set(['entailment', 'neutral', 'contradiction']);

  function normalizeResult(result) {
    if (!result || typeof result !== 'object') throw new Error('nli_result_object_required');
    const label = String(result.label || '').toLowerCase();
    if (!LABELS.has(label)) throw new Error(`unsupported_nli_label:${label || 'missing'}`);
    const scores = result.scores && typeof result.scores === 'object' ? {
      entailment: Number(result.scores.entailment ?? NaN),
      neutral: Number(result.scores.neutral ?? NaN),
      contradiction: Number(result.scores.contradiction ?? NaN),
    } : null;
    if (scores && !Object.values(scores).every(Number.isFinite)) throw new Error('nli_scores_must_be_finite');
    return { label, scores, raw: result.raw ?? null };
  }

  function relationName(forward, reverse) {
    const a = forward.label, b = reverse.label;
    if (a === 'entailment' && b === 'entailment') return 'mutual_entailment';
    if (a === 'entailment' && b === 'neutral') return 'left_more_specific_or_equivalent';
    if (a === 'neutral' && b === 'entailment') return 'right_more_specific_or_equivalent';
    if (a === 'contradiction' || b === 'contradiction') return 'contradiction_present';
    if (a === 'neutral' && b === 'neutral') return 'mutual_neutrality';
    return `${a}_${b}`;
  }

  async function compare(leftText, rightText, options = {}) {
    if (typeof options.classify !== 'function') throw new Error('nli_classify_function_required');
    const left = String(leftText ?? '').trim();
    const right = String(rightText ?? '').trim();
    if (!left || !right) return {
      schema: 'blum-nli-comparison-v0',
      applicable: false,
      reason: 'empty_surface',
      forward: null,
      reverse: null,
      relation: null,
      provenance: options.provenance || null,
    };

    const forward = normalizeResult(await options.classify({
      premise: left,
      hypothesis: right,
      direction: 'left_to_right',
      metadata: options.metadata || null,
    }));
    const reverse = normalizeResult(await options.classify({
      premise: right,
      hypothesis: left,
      direction: 'right_to_left',
      metadata: options.metadata || null,
    }));

    return {
      schema: 'blum-nli-comparison-v0',
      applicable: true,
      reason: null,
      forward,
      reverse,
      relation: relationName(forward, reverse),
      provenance: options.provenance || null,
    };
  }

  return { LABELS: [...LABELS], normalizeResult, relationName, compare };
});
