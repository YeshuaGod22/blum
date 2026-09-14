'use strict';

// LEXICAL OUTPUT ANALYSIS v0 — 12 Sep 2026
// Deterministic, model-free text comparison for Blum observation surfaces.
// No stemming, synonym expansion, stopword removal, or learned model inference.

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BlumLexicalAnalysisV0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function normalizeText(text) {
    return String(text ?? '').normalize('NFKC').toLocaleLowerCase('en-US');
  }

  function tokenize(text) {
    const s = normalizeText(text);
    try {
      return s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
    } catch (_) {
      return s.match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) || [];
    }
  }

  function normalizeAblationTerms(terms) {
    if (typeof terms === 'string') terms = terms.split(/[\s,;]+/g);
    const out = new Set();
    for (const t of (terms || [])) {
      for (const token of tokenize(t)) if (token) out.add(token);
    }
    return out;
  }

  function ablateTokens(tokens, terms) {
    const block = terms instanceof Set ? terms : normalizeAblationTerms(terms);
    return (tokens || []).filter(t => !block.has(t));
  }

  function ngrams(tokens, n) {
    const out = [];
    if (!Number.isInteger(n) || n < 1) throw new Error('ngram_n_must_be_positive_integer');
    for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(' '));
    return out;
  }

  function counts(values) {
    const m = new Map();
    for (const v of values || []) m.set(v, (m.get(v) || 0) + 1);
    return m;
  }

  function sortedSet(values) {
    return [...new Set(values || [])].sort((a, b) => a.localeCompare(b));
  }

  function intersection(a, b) {
    const bs = b instanceof Set ? b : new Set(b || []);
    return [...new Set(a || [])].filter(x => bs.has(x));
  }

  function jaccard(a, b) {
    const A = a instanceof Set ? a : new Set(a || []);
    const B = b instanceof Set ? b : new Set(b || []);
    const union = new Set([...A, ...B]);
    if (!union.size) return 1;
    let both = 0;
    for (const x of A) if (B.has(x)) both++;
    return both / union.size;
  }

  function containment(source, target) {
    const A = source instanceof Set ? source : new Set(source || []);
    const B = target instanceof Set ? target : new Set(target || []);
    if (!A.size) return B.size ? 0 : 1;
    let both = 0;
    for (const x of A) if (B.has(x)) both++;
    return both / A.size;
  }

  function repeatedNgrams(tokens, n = 2) {
    return [...counts(ngrams(tokens || [], n)).entries()]
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([gram, count]) => ({ gram, count }));
  }

  function profile(text, options = {}) {
    const tokens = tokenize(text);
    const unique = sortedSet(tokens);
    const bigrams = ngrams(tokens, 2);
    return {
      schema: 'blum-lexical-profile-v0',
      tokenizer: 'unicode-word-lowercase-nfkc-v0',
      tokenCount: tokens.length,
      uniqueTokenCount: unique.length,
      typeTokenRatio: tokens.length ? unique.length / tokens.length : 0,
      tokens,
      uniqueTokens: unique,
      uniqueBigrams: sortedSet(bigrams),
      repeatedBigrams: repeatedNgrams(tokens, 2),
      repeatedTrigrams: repeatedNgrams(tokens, 3),
      options: { label: options.label || null },
    };
  }

  function compareTokenSequences(leftTokens, rightTokens) {
    const L = new Set(leftTokens || []);
    const R = new Set(rightTokens || []);
    const LB = new Set(ngrams(leftTokens || [], 2));
    const RB = new Set(ngrams(rightTokens || [], 2));
    return {
      unigramJaccard: jaccard(L, R),
      bigramJaccard: jaccard(LB, RB),
      leftContainedInRight: containment(L, R),
      rightContainedInLeft: containment(R, L),
      sharedTokens: intersection(L, R).sort(),
      leftOnlyTokens: [...L].filter(x => !R.has(x)).sort(),
      rightOnlyTokens: [...R].filter(x => !L.has(x)).sort(),
      sharedBigrams: intersection(LB, RB).sort(),
    };
  }

  function compare(leftText, rightText, options = {}) {
    const ablationTerms = normalizeAblationTerms(options.ablationTerms || []);
    const left = profile(leftText, { label: options.leftLabel });
    const right = profile(rightText, { label: options.rightLabel });
    const raw = compareTokenSequences(left.tokens, right.tokens);
    const leftAblated = ablateTokens(left.tokens, ablationTerms);
    const rightAblated = ablateTokens(right.tokens, ablationTerms);
    const ablated = compareTokenSequences(leftAblated, rightAblated);

    return {
      schema: 'blum-lexical-comparison-v0',
      tokenizer: left.tokenizer,
      left,
      right,
      ablation: {
        terms: [...ablationTerms].sort(),
        leftRemoved: left.tokens.length - leftAblated.length,
        rightRemoved: right.tokens.length - rightAblated.length,
        leftRemaining: leftAblated.length,
        rightRemaining: rightAblated.length,
      },
      raw,
      afterAblation: ablated,
      deltas: {
        unigramJaccard: ablated.unigramJaccard - raw.unigramJaccard,
        bigramJaccard: ablated.bigramJaccard - raw.bigramJaccard,
      },
    };
  }

  function corpusTermFrequencies(texts, options = {}) {
    const documentFrequency = new Map();
    const tokenFrequency = new Map();
    let documents = 0;
    let tokens = 0;
    for (const text of texts || []) {
      documents++;
      const ts = tokenize(text);
      tokens += ts.length;
      for (const t of ts) tokenFrequency.set(t, (tokenFrequency.get(t) || 0) + 1);
      for (const t of new Set(ts)) documentFrequency.set(t, (documentFrequency.get(t) || 0) + 1);
    }
    const rows = [...tokenFrequency.keys()].map(term => ({
      term,
      tokenCount: tokenFrequency.get(term),
      documentCount: documentFrequency.get(term) || 0,
      documentRate: documents ? (documentFrequency.get(term) || 0) / documents : 0,
    })).sort((a, b) => b.documentCount - a.documentCount || b.tokenCount - a.tokenCount || a.term.localeCompare(b.term));
    return {
      schema: 'blum-corpus-term-frequency-v0',
      documents,
      tokens,
      rows: options.limit ? rows.slice(0, options.limit) : rows,
    };
  }

  return {
    normalizeText,
    tokenize,
    normalizeAblationTerms,
    ablateTokens,
    ngrams,
    profile,
    jaccard,
    containment,
    compare,
    corpusTermFrequencies,
  };
});
