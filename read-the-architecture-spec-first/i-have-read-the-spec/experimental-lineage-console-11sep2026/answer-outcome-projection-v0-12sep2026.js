'use strict';

// ANSWER OUTCOME PROJECTION v0 — 12 Sep 2026
// Normalizes the final answer role across structured and deliberately unstructured
// outputs. This is not generic section fallback: if a response is structured but
// lacks a designated answer/reply section, the answer outcome is missing.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumAnswerOutcomeProjectionV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const PROCESS_TAGS = new Set([
    'working','priming','meditation','examination','debate','deliberation',
    'reflection','revision','identity','thinking'
  ]);

  function textValue(v) {
    if (Array.isArray(v)) return v.map(x => String(x ?? '')).join('\n\n').trim();
    return String(v ?? '').trim();
  }

  function presentSectionEntries(observation) {
    return Object.entries(observation?.sections || {})
      .map(([k,v]) => [k, textValue(v)])
      .filter(([,v]) => Boolean(v));
  }

  function project(observation) {
    const sections = observation?.sections || {};
    for (const key of ['reply','answer']) {
      const text = textValue(sections[key]);
      if (text) return {
        schema:'blum-answer-outcome-projection-v0',
        status:'ok',
        text,
        source:key === 'reply' ? 'reply_section' : 'answer_section',
        section:key,
        observationId:observation?.observationId || null,
      };
    }

    const present = presentSectionEntries(observation);
    const structured = present.length > 0 || /<\/?[A-Za-z][^>]*>/.test(String(observation?.rawOutput ?? ''));
    if (structured) {
      return {
        schema:'blum-answer-outcome-projection-v0',
        status:'missing',
        text:null,
        source:null,
        section:null,
        reason:'structured_output_without_designated_answer',
        presentSections:present.map(([k]) => k),
        observationId:observation?.observationId || null,
      };
    }

    const raw = String(observation?.rawOutput ?? '').trim();
    if (raw) return {
      schema:'blum-answer-outcome-projection-v0',
      status:'ok',
      text:raw,
      source:'plain_response',
      section:null,
      observationId:observation?.observationId || null,
    };

    return {
      schema:'blum-answer-outcome-projection-v0',
      status:'missing',
      text:null,
      source:null,
      section:null,
      reason:'empty_output',
      observationId:observation?.observationId || null,
    };
  }

  function projectPair(left, right) {
    const L = project(left), R = project(right);
    return {
      schema:'blum-answer-outcome-pair-v0',
      comparable:L.status === 'ok' && R.status === 'ok',
      reason:L.status === 'ok' && R.status === 'ok' ? null : 'answer_missing_on_one_or_both_observations',
      left:L,
      right:R,
    };
  }

  return {PROCESS_TAGS,textValue,presentSectionEntries,project,projectPair};
});
