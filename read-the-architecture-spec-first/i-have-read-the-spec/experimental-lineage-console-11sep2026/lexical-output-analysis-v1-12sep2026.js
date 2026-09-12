'use strict';

// LEXICAL OUTPUT ANALYSIS v1 — 12 Sep 2026
// Deterministic, model-free text comparison with explicit applicability.
// Bare numeric/sentinel surfaces are classified as behavioral rather than prose.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumLexicalAnalysisV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function normalizeText(text) { return String(text ?? '').normalize('NFKC').toLocaleLowerCase('en-US'); }
  function tokenize(text) {
    const s = normalizeText(text);
    try { return s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []; }
    catch (_) { return s.match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) || []; }
  }
  function stripMarkup(text) { return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/[*_`#>]/g, ' ').trim(); }
  function behavioralSurface(text) {
    const body = stripMarkup(text).trim();
    if (!body) return { behavioralLike: false, kind: 'empty', value: null };
    if (/^[+-]?\d+(?:\.\d+)?$/.test(body)) return { behavioralLike: true, kind: 'number', value: Number(body) };
    if (/^(always|never)$/i.test(body)) return { behavioralLike: true, kind: 'sentinel', value: body.toUpperCase() };
    return { behavioralLike: false, kind: 'text', value: null };
  }
  function normalizeAblationTerms(terms) {
    if (typeof terms === 'string') terms = terms.split(/[\s,;]+/g);
    const out = new Set();
    for (const t of (terms || [])) for (const token of tokenize(t)) if (token) out.add(token);
    return out;
  }
  function ablateTokens(tokens, terms) {
    const block = terms instanceof Set ? terms : normalizeAblationTerms(terms);
    return (tokens || []).filter(t => !block.has(t));
  }
  function ngrams(tokens, n) {
    if (!Number.isInteger(n) || n < 1) throw new Error('ngram_n_must_be_positive_integer');
    const out = [];
    for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(' '));
    return out;
  }
  function sortedSet(values) { return [...new Set(values || [])].sort((a,b)=>a.localeCompare(b)); }
  function intersection(a,b) { const B=b instanceof Set?b:new Set(b||[]); return [...new Set(a||[])].filter(x=>B.has(x)); }
  function finiteJaccard(a,b) {
    const A=a instanceof Set?a:new Set(a||[]), B=b instanceof Set?b:new Set(b||[]);
    const union=new Set([...A,...B]);
    if (!union.size) return { applicable:false, value:null, reason:'both_sets_empty' };
    let both=0; for (const x of A) if (B.has(x)) both++;
    return { applicable:true, value:both/union.size, reason:null };
  }
  function finiteContainment(source,target) {
    const A=source instanceof Set?source:new Set(source||[]), B=target instanceof Set?target:new Set(target||[]);
    if (!A.size) return { applicable:false, value:null, reason:'source_set_empty' };
    let both=0; for (const x of A) if (B.has(x)) both++;
    return { applicable:true, value:both/A.size, reason:null };
  }
  function counts(values){const m=new Map();for(const v of values||[])m.set(v,(m.get(v)||0)+1);return m;}
  function repeatedNgrams(tokens,n=2){return [...counts(ngrams(tokens||[],n)).entries()].filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([gram,count])=>({gram,count}));}
  function profile(text,options={}) {
    const tokens=tokenize(text), unique=sortedSet(tokens), behavior=behavioralSurface(text);
    return {
      schema:'blum-lexical-profile-v1', tokenizer:'unicode-word-lowercase-nfkc-v0',
      tokenCount:tokens.length, uniqueTokenCount:unique.length,
      typeTokenRatio:tokens.length?unique.length/tokens.length:0,
      tokens, uniqueTokens:unique, uniqueBigrams:sortedSet(ngrams(tokens,2)),
      repeatedBigrams:repeatedNgrams(tokens,2), repeatedTrigrams:repeatedNgrams(tokens,3),
      behavioralSurface:behavior,
      proseEligible:!behavior.behavioralLike && tokens.length>=2,
      options:{label:options.label||null},
    };
  }
  function compareTokenSequences(leftTokens,rightTokens) {
    const L=new Set(leftTokens||[]),R=new Set(rightTokens||[]),LB=new Set(ngrams(leftTokens||[],2)),RB=new Set(ngrams(rightTokens||[],2));
    return {
      unigramJaccard:finiteJaccard(L,R), bigramJaccard:finiteJaccard(LB,RB),
      leftContainedInRight:finiteContainment(L,R), rightContainedInLeft:finiteContainment(R,L),
      sharedTokens:intersection(L,R).sort(), leftOnlyTokens:[...L].filter(x=>!R.has(x)).sort(), rightOnlyTokens:[...R].filter(x=>!L.has(x)).sort(), sharedBigrams:intersection(LB,RB).sort(),
    };
  }
  function deltaMetric(after,before){return after?.applicable&&before?.applicable?after.value-before.value:null;}
  function compare(leftText,rightText,options={}) {
    const ablationTerms=normalizeAblationTerms(options.ablationTerms||[]);
    const left=profile(leftText,{label:options.leftLabel}), right=profile(rightText,{label:options.rightLabel});
    const pairProseEligible=left.proseEligible&&right.proseEligible;
    const raw=compareTokenSequences(left.tokens,right.tokens);
    const leftAblated=ablateTokens(left.tokens,ablationTerms), rightAblated=ablateTokens(right.tokens,ablationTerms);
    const afterAblation=compareTokenSequences(leftAblated,rightAblated);
    return {
      schema:'blum-lexical-comparison-v1', tokenizer:left.tokenizer,
      applicability:{
        pairProseEligible,
        reason:pairProseEligible?null:(left.behavioralSurface.behavioralLike||right.behavioralSurface.behavioralLike?'behavioral_surface':'insufficient_text'),
        unigram:raw.unigramJaccard.applicable,
        bigram:raw.bigramJaccard.applicable,
      },
      left,right,
      ablation:{terms:[...ablationTerms].sort(),leftRemoved:left.tokens.length-leftAblated.length,rightRemoved:right.tokens.length-rightAblated.length,leftRemaining:leftAblated.length,rightRemaining:rightAblated.length},
      raw,afterAblation,
      deltas:{unigramJaccard:deltaMetric(afterAblation.unigramJaccard,raw.unigramJaccard),bigramJaccard:deltaMetric(afterAblation.bigramJaccard,raw.bigramJaccard)},
    };
  }
  return {normalizeText,tokenize,stripMarkup,behavioralSurface,normalizeAblationTerms,ablateTokens,ngrams,profile,compare,finiteJaccard,finiteContainment};
});
