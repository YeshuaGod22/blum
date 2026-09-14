'use strict';

// BEHAVIORAL OUTPUT ANALYSIS v0 — 12 Sep 2026
// Handles constrained numeric/sentinel answer surfaces as behavioral outcomes,
// deliberately separate from prose similarity metrics.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumBehavioralAnalysisV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function stripMarkup(text) {
    return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/[*_`#>]/g, ' ').trim();
  }
  function parse(text) {
    const raw = String(text ?? '');
    const body = stripMarkup(raw).trim();
    if (!body) return { schema:'blum-behavioral-value-v0', raw, body, kind:'missing', parsed:false, value:null };
    if (/^[+-]?\d+(?:\.\d+)?$/.test(body)) {
      return { schema:'blum-behavioral-value-v0', raw, body, kind:'number', parsed:true, value:Number(body) };
    }
    if (/^(ALWAYS|NEVER)$/i.test(body)) {
      return { schema:'blum-behavioral-value-v0', raw, body, kind:'sentinel', parsed:true, value:body.toUpperCase() };
    }
    return { schema:'blum-behavioral-value-v0', raw, body, kind:'text', parsed:false, value:null };
  }
  function compare(leftText, rightText) {
    const left=parse(leftText), right=parse(rightText);
    const sameKind=left.kind===right.kind;
    const bothNumeric=left.kind==='number'&&right.kind==='number';
    const bothSentinel=left.kind==='sentinel'&&right.kind==='sentinel';
    return {
      schema:'blum-behavioral-comparison-v0',
      applicable:left.parsed&&right.parsed&&sameKind,
      reason:left.parsed&&right.parsed&&sameKind?null:'values_not_same_parsed_behavioral_kind',
      left,right,sameKind,bothNumeric,bothSentinel,
      exactMatch:left.parsed&&right.parsed&&sameKind ? left.value===right.value : null,
      signedDelta:bothNumeric ? right.value-left.value : null,
      absoluteDelta:bothNumeric ? Math.abs(right.value-left.value) : null,
      sentinelAgreement:bothSentinel ? left.value===right.value : null,
    };
  }
  return {stripMarkup,parse,compare};
});
