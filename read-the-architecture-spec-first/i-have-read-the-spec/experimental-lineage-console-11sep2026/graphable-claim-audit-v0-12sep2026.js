'use strict';

// GRAPHABLE CLAIM AUDIT v0 — 12 Sep 2026
// Surfaces claims that can be drawn directly from frozen observations.
// It does not assign experimental meaning to historical fork labels; collection,
// item-core wording, and fork contrast remain explicit strata.

const Answer = require('./answer-outcome-projection-v0-12sep2026.js');
const Behavioral = require('./behavioral-output-analysis-v0-12sep2026.js');
const Lexical = require('./lexical-output-analysis-v1-12sep2026.js');

function median(xs) {
  if (!xs.length) return null;
  const a = xs.slice().sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
}

function forkPairKey(a,b) {
  return [String(a ?? '<none>'), String(b ?? '<none>')].sort().join('↔');
}

function orientPair(a,b) {
  return String(a.forkId ?? '<none>').localeCompare(String(b.forkId ?? '<none>')) <= 0 ? [a,b] : [b,a];
}

function exactParentPairs(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!row.collection || !row.parentSnapshotId || !row.itemCoreHash || !row.forkId) continue;
    const key = `${row.collection}|${row.parentSnapshotId}|${row.itemCoreHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = [];
  for (const group of groups.values()) {
    for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) {
      if (group[i].forkId === group[j].forkId) continue;
      const [left,right] = orientPair(group[i],group[j]);
      out.push({
        collection:left.collection,
        parentSnapshotId:left.parentSnapshotId,
        itemCoreHash:left.itemCoreHash,
        itemCoreText:left.itemCoreText,
        forkContrast:forkPairKey(left.forkId,right.forkId),
        leftForkId:left.forkId,
        rightForkId:right.forkId,
        left,right,
      });
    }
  }
  return out;
}

function classifyPair(pair) {
  const projection = Answer.projectPair(pair.left, pair.right);
  const base = {
    collection:pair.collection,
    parentSnapshotId:pair.parentSnapshotId,
    itemCoreHash:pair.itemCoreHash,
    forkContrast:pair.forkContrast,
    leftForkId:pair.leftForkId,
    rightForkId:pair.rightForkId,
    answerComparable:projection.comparable,
    leftAnswerSource:projection.left.source,
    rightAnswerSource:projection.right.source,
  };
  if (!projection.comparable) return {...base,kind:'missing_answer',reason:projection.reason};

  const leftText=projection.left.text, rightText=projection.right.text;
  const behavior = Behavioral.compare(leftText,rightText);
  if (behavior.applicable && behavior.bothNumeric) return {
    ...base,kind:'numeric',leftValue:behavior.left.value,rightValue:behavior.right.value,
    signedDelta:behavior.signedDelta,absoluteDelta:behavior.absoluteDelta,exactMatch:behavior.exactMatch,
  };
  if (behavior.applicable && behavior.bothSentinel) return {
    ...base,kind:'sentinel',leftValue:behavior.left.value,rightValue:behavior.right.value,
    exactMatch:behavior.exactMatch,transition:`${behavior.left.value}→${behavior.right.value}`,
  };

  const leftParsed=Behavioral.parse(leftText), rightParsed=Behavioral.parse(rightText);
  if (leftParsed.parsed !== rightParsed.parsed || leftParsed.kind !== rightParsed.kind) return {
    ...base,kind:'mixed_surface',leftKind:leftParsed.kind,rightKind:rightParsed.kind,
    reason:'answer_roles_comparable_but_output_types_differ',
  };

  const lex = Lexical.compare(leftText,rightText);
  if (lex.applicability?.pairProseEligible && lex.raw?.unigramJaccard?.applicable) return {
    ...base,kind:'prose',
    unigramJaccard:lex.raw.unigramJaccard.value,
    bigramJaccard:lex.raw.bigramJaccard?.applicable ? lex.raw.bigramJaccard.value : null,
    leftTokenCount:lex.left.tokenCount,rightTokenCount:lex.right.tokenCount,
  };
  return {...base,kind:'unclassified',reason:lex.applicability?.reason || 'no_applicable_v0_analyzer'};
}

function stratumKey(pair) {
  return `${pair.collection}|${pair.itemCoreHash}|${pair.forkContrast}`;
}

function summarizeStratum(itemId, rows) {
  const classified = rows.map(classifyPair);
  const counts={};
  for (const r of classified) counts[r.kind]=(counts[r.kind]||0)+1;
  const numeric=classified.filter(x=>x.kind==='numeric');
  const sentinel=classified.filter(x=>x.kind==='sentinel');
  const prose=classified.filter(x=>x.kind==='prose');
  const transitions={};
  sentinel.forEach(x=>transitions[x.transition]=(transitions[x.transition]||0)+1);
  const first=rows[0];
  const graphPrimitives=[];
  const candidateClaims=[];

  if (numeric.length) {
    const deltas=numeric.map(x=>x.signedDelta);
    graphPrimitives.push({type:'paired_slopeplot',outcome:'numeric_answer',n:numeric.length,x:[first.leftForkId,first.rightForkId]});
    candidateClaims.push({
      claimClass:'descriptive_paired_numeric_difference',
      text:`${itemId} has ${numeric.length} matched numeric answer pair(s) in ${first.collection} for ${first.forkContrast}; median signed difference (${first.leftForkId}→${first.rightForkId}) is ${median(deltas)}.`,
      drawableBy:'paired_slopeplot',n:numeric.length,
      statistic:{medianSignedDelta:median(deltas),minSignedDelta:Math.min(...deltas),maxSignedDelta:Math.max(...deltas)},
      causalMeaning:'undeclared_until_design_map',
    });
  }
  if (sentinel.length) {
    graphPrimitives.push({type:'paired_categorical_transition',outcome:'sentinel_answer',n:sentinel.length});
    const changed=sentinel.filter(x=>!x.exactMatch).length;
    candidateClaims.push({
      claimClass:'descriptive_paired_categorical_transition',
      text:`${itemId} has ${sentinel.length} matched sentinel answer pair(s) in ${first.collection} for ${first.forkContrast}; ${changed} change category across the fork contrast.`,
      drawableBy:'paired_categorical_transition',n:sentinel.length,
      statistic:{changed,unchanged:sentinel.length-changed,transitions},
      causalMeaning:'undeclared_until_design_map',
    });
  }
  if (prose.length) {
    const uni=prose.map(x=>x.unigramJaccard).filter(Number.isFinite);
    graphPrimitives.push({type:'paired_text_plus_overlap_distribution',outcome:'prose_answer',n:prose.length});
    candidateClaims.push({
      claimClass:'descriptive_lexical_overlap',
      text:`${itemId} has ${prose.length} matched prose answer pair(s) in ${first.collection} for ${first.forkContrast}; median unigram Jaccard is ${median(uni)}.`,
      drawableBy:'paired_text_plus_overlap_distribution',n:prose.length,
      statistic:{medianUnigramJaccard:median(uni),minUnigramJaccard:Math.min(...uni),maxUnigramJaccard:Math.max(...uni)},
      causalMeaning:'undeclared_until_design_map',
    });
  }

  return {
    schema:'blum-graphable-claim-stratum-v0',
    itemId,
    collection:first.collection,
    itemCoreHash:first.itemCoreHash,
    itemCoreText:first.itemCoreText,
    forkContrast:first.forkContrast,
    leftForkId:first.leftForkId,
    rightForkId:first.rightForkId,
    exactParentPairCount:rows.length,
    outcomeTypeCounts:counts,
    graphablePairCount:numeric.length+sentinel.length+prose.length,
    graphPrimitives,
    candidateClaims,
    exclusions:classified.filter(x=>!['numeric','sentinel','prose'].includes(x.kind)),
    measurements:classified.filter(x=>['numeric','sentinel','prose'].includes(x.kind)),
  };
}

function auditItem(history) {
  const pairs=exactParentPairs(history?.observations || []);
  const strata=new Map();
  for (const pair of pairs) {
    const key=stratumKey(pair);
    if (!strata.has(key)) strata.set(key,[]);
    strata.get(key).push(pair);
  }
  const summaries=[...strata.values()].map(rows=>summarizeStratum(history.canonicalItemId,rows))
    .sort((a,b)=>b.graphablePairCount-a.graphablePairCount || a.collection.localeCompare(b.collection) || a.forkContrast.localeCompare(b.forkContrast));
  return {
    schema:'blum-graphable-claim-item-audit-v0',
    itemId:history?.canonicalItemId || null,
    observations:history?.observationCount || 0,
    exactParentPairCount:pairs.length,
    graphablePairCount:summaries.reduce((n,s)=>n+s.graphablePairCount,0),
    strata:summaries,
    candidateClaims:summaries.flatMap(s=>s.candidateClaims.map(c=>({...c,collection:s.collection,itemCoreHash:s.itemCoreHash,forkContrast:s.forkContrast}))),
  };
}

function auditIndex(index) {
  const items=Object.values(index?.itemHistories || {}).map(auditItem)
    .sort((a,b)=>b.graphablePairCount-a.graphablePairCount || a.itemId.localeCompare(b.itemId));
  const claims=items.flatMap(i=>i.candidateClaims.map(c=>({...c,itemId:i.itemId})));
  return {
    schema:'blum-graphable-claim-audit-v0',
    sourceIndexSchema:index?.schema || null,
    itemCount:items.length,
    itemsWithExactParentPairs:items.filter(x=>x.exactParentPairCount>0).length,
    itemsWithGraphableClaims:items.filter(x=>x.candidateClaims.length>0).length,
    exactParentPairCount:items.reduce((n,x)=>n+x.exactParentPairCount,0),
    graphablePairCount:items.reduce((n,x)=>n+x.graphablePairCount,0),
    candidateClaimCount:claims.length,
    items,
    candidateClaims:claims,
    policy:{
      pairing:'same collection + same parentSnapshotId + same itemCoreHash + different forkId',
      pooling:'none across collections or item-core variants',
      causalLabels:'not assigned without declared design map',
      outcomeProjection:'designated reply/answer section when structured; whole response only when genuinely unstructured',
    },
  };
}

module.exports={median,forkPairKey,orientPair,exactParentPairs,classifyPair,summarizeStratum,auditItem,auditIndex};
