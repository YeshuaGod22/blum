'use strict';

// BLUM COHORT × BATTERY QUERY CORE v0 — 14 Sep 2026
// Registry-first projection over the normalized corpus. The caller supplies the
// frozen item registry/order; responses are left-joined so zero-observation
// items remain visible. Parsing is delegated to Blum's answer-outcome and
// behavioral-output modules rather than rediscovered here.

function median(xs) {
  if (!xs.length) return null;
  const a=[...xs].sort((x,y)=>x-y), n=a.length;
  return n%2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
}

function queryCohortBattery(index, recipe, deps) {
  if (!index || index.schema !== 'blum-dae-unified-observation-index-v1') throw new Error('unsupported_index_schema');
  if (!recipe || !Array.isArray(recipe.itemIds) || !recipe.itemIds.length) throw new Error('registry_item_ids_required');
  if (!deps?.answerOutcome?.project || !deps?.behavioral?.parse) throw new Error('blum_projection_dependencies_required');

  const collection = String(recipe.collection || '').trim();
  const conditionRegex = recipe.conditionRegex instanceof RegExp
    ? recipe.conditionRegex
    : new RegExp(String(recipe.conditionRegex || '.*'));
  const expectedReplicates = Number.isInteger(recipe.expectedReplicates) ? recipe.expectedReplicates : null;
  const itemIds=[...new Set(recipe.itemIds.map(String))];
  const rows=[];
  const summaries=[];

  for (const itemId of itemIds) {
    const history=index.itemHistories?.[itemId] || null;
    const candidates=(history?.observations || []).filter(o =>
      (!collection || o.collection===collection) && conditionRegex.test(String(o.condition || ''))
    );

    const itemRows=candidates.map(o => {
      const answer=deps.answerOutcome.project(o);
      const value=answer.status==='ok'
        ? deps.behavioral.parse(answer.text)
        : {kind:'missing',parsed:false,value:null,body:'',raw:''};
      return {
        observationId:o.observationId,
        collection:o.collection,
        condition:o.condition,
        family:o.family,
        replicate:o.replicate,
        itemId,
        answerStatus:answer.status,
        answerSource:answer.source || null,
        answerText:answer.text ?? null,
        parseKind:value.kind,
        parseStatus:value.parsed ? 'parsed' : (answer.status==='ok' ? 'unparsed' : answer.status),
        score:value.kind==='number' ? value.value : null,
        sentinel:value.kind==='sentinel' ? value.value : null,
        categorical:value.kind==='text' ? String(answer.text ?? '').trim() : null,
        sourcePath:o.sourcePath || null,
        stopReason:o.stopReason || null,
        callOutcome:o.callOutcome || null,
        presentationHash:o.presentationHash || null,
        itemCoreHash:o.itemCoreHash || null,
      };
    }).sort((a,b)=>(Number(a.replicate)||0)-(Number(b.replicate)||0));

    rows.push(...itemRows);
    const nums=itemRows.filter(r=>typeof r.score==='number').map(r=>r.score).sort((a,b)=>a-b);
    const sentinels=itemRows.filter(r=>r.sentinel).map(r=>r.sentinel);
    const categoricalValues=itemRows.filter(r=>r.categorical!==null).map(r=>r.categorical);
    const parseStatuses={};
    for (const r of itemRows) parseStatuses[r.parseStatus]=(parseStatuses[r.parseStatus]||0)+1;
    const sentinelCounts={};
    for (const s of sentinels) sentinelCounts[s]=(sentinelCounts[s]||0)+1;
    const replicates=[...new Set(itemRows.map(r=>r.replicate).filter(x=>x!==null&&x!==undefined))];

    summaries.push({
      itemId,
      registered:true,
      observationCount:itemRows.length,
      replicateCount:replicates.length,
      expectedReplicates,
      missingCount:expectedReplicates===null ? null : Math.max(0, expectedReplicates-itemRows.length),
      numericCount:nums.length,
      numericValues:nums,
      median:median(nums),
      min:nums.length ? nums[0] : null,
      max:nums.length ? nums[nums.length-1] : null,
      sentinelCount:sentinels.length,
      sentinelCounts,
      categoricalCount:categoricalValues.length,
      categoricalValues,
      unparsedCount:itemRows.filter(r=>r.parseStatus==='unparsed').length,
      parseStatuses,
    });
  }

  return {
    schema:'blum-cohort-battery-query-result-v0',
    sourceIndex:{
      schema:index.schema,
      generatedAt:index.generatedAt || null,
      observationCount:index.observationCount ?? null,
      itemCount:index.itemCount ?? null,
      repository:index.source?.repository || null,
      commit:index.source?.commit || null,
    },
    recipe:{
      collection:collection || null,
      conditionRegex:conditionRegex.source,
      expectedReplicates,
      itemIds,
    },
    itemCount:itemIds.length,
    observationCount:rows.length,
    summaries,
    rows,
  };
}

module.exports={median,queryCohortBattery};
