'use strict';

// ANSWER OUTCOME PROJECTION v0 — 12 Sep 2026
// Normalizes the final-answer role across structured and deliberately unstructured
// outputs. Parser visibility is not treated as evidential absence: structured
// responses without a designated answer/reply section are queued for adjudication.

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
        confidence:'mechanical',
        observationId:observation?.observationId || null,
      };
    }

    const raw = String(observation?.rawOutput ?? '').trim();
    const present = presentSectionEntries(observation);
    const structured = present.length > 0 || /<\/?[A-Za-z][^>]*>/.test(raw);
    if (structured && raw) {
      return {
        schema:'blum-answer-outcome-projection-v0',
        status:'adjudication_required',
        text:null,
        candidateText:raw,
        source:null,
        section:null,
        confidence:null,
        reason:'parser_found_no_designated_answer_section_but_substantive_output_exists',
        presentSections:present.map(([k]) => k),
        observationId:observation?.observationId || null,
      };
    }

    if (raw) return {
      schema:'blum-answer-outcome-projection-v0',
      status:'ok',
      text:raw,
      source:'plain_response',
      section:null,
      confidence:'mechanical',
      observationId:observation?.observationId || null,
    };

    return {
      schema:'blum-answer-outcome-projection-v0',
      status:'empty',
      text:null,
      source:null,
      section:null,
      confidence:'mechanical',
      reason:'empty_output',
      observationId:observation?.observationId || null,
    };
  }

  function projectPair(left, right) {
    const L = project(left), R = project(right);
    const comparable=L.status === 'ok' && R.status === 'ok';
    let reason=null;
    if (!comparable) {
      if (L.status === 'adjudication_required' || R.status === 'adjudication_required') reason='answer_adjudication_required';
      else reason='answer_unavailable_on_one_or_both_observations';
    }
    return {
      schema:'blum-answer-outcome-pair-v0',
      comparable,
      reason,
      left:L,
      right:R,
    };
  }

  return {PROCESS_TAGS,textValue,presentSectionEntries,project,projectPair};
});
