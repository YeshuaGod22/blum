'use strict';

// BLUM COHORT × BATTERY QUERY CORE v1 — 14 Sep 2026
// Pure projection over the canonical measurement dataset. No response parsing
// is permitted here. Registered items are left-joined so zero-observation items
// remain visible, including explicit missingness and unresolved states.

function median(xs) {
  if (!xs.length) return null;
  const a=[...xs].sort((x,y)=>x-y), n=a.length;
  return n%2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
}

function queryCohortBattery(measurements, recipe) {
  if (!measurements || measurements.schema !== 'blum-canonical-measurement-dataset-v0') throw new Error('unsupported_measurement_schema');
  if (!recipe || !Array.isArray(recipe.itemIds) || !recipe.itemIds.length) throw new Error('registry_item_ids_required');

  const collection=String(recipe.collection || '').trim();
  const conditionRegex=recipe.conditionRegex instanceof RegExp
    ? recipe.conditionRegex
    : new RegExp(String(recipe.conditionRegex || '.*'));
  const expectedReplicates=Number.isInteger(recipe.expectedReplicates) ? recipe.expectedReplicates : null;
  const itemIds=[...new Set(recipe.itemIds.map(String))];
  const knownItems=new Set(measurements.itemIds || []);
  const rows=[];
  const summaries=[];

  for (const itemId of itemIds) {
    const itemRows=(measurements.rows || []).filter(r =>
      r.itemId===itemId &&
      (!collection || r.collection===collection) &&
      conditionRegex.test(String(r.condition || ''))
    ).sort((a,b)=>(Number(a.replicate)||0)-(Number(b.replicate)||0));

    rows.push(...itemRows);
    const nums=itemRows.filter(r=>r.parseStatus==='parsed'&&r.valueKind==='number'&&typeof r.value==='number').map(r=>r.value).sort((a,b)=>a-b);
    const sentinels=itemRows.filter(r=>r.parseStatus==='parsed'&&r.valueKind==='sentinel').map(r=>r.value);
    const categoricalValues=itemRows.filter(r=>r.parseStatus==='parsed'&&r.valueKind==='text').map(r=>r.value);
    const parseStatuses={};
    const resolutionStatuses={};
    for (const r of itemRows) {
      parseStatuses[r.parseStatus]=(parseStatuses[r.parseStatus]||0)+1;
      resolutionStatuses[r.resolutionStatus]=(resolutionStatuses[r.resolutionStatus]||0)+1;
    }
    const sentinelCounts={};
    for (const s of sentinels) sentinelCounts[s]=(sentinelCounts[s]||0)+1;
    const replicates=[...new Set(itemRows.map(r=>r.replicate).filter(x=>x!==null&&x!==undefined))];
    const missingReplicateCount=expectedReplicates===null ? null : Math.max(0, expectedReplicates-replicates.length);

    summaries.push({
      itemId,
      registered:knownItems.has(itemId),
      observationCount:itemRows.length,
      replicateCount:replicates.length,
      expectedReplicates,
      missingReplicateCount,
      numericCount:nums.length,
      numericValues:nums,
      median:median(nums),
      min:nums.length ? nums[0] : null,
      max:nums.length ? nums[nums.length-1] : null,
      sentinelCount:sentinels.length,
      sentinelCounts,
      categoricalCount:categoricalValues.length,
      categoricalValues,
      parsedCount:itemRows.filter(r=>r.parseStatus==='parsed').length,
      ambiguousCount:itemRows.filter(r=>r.parseStatus==='ambiguous').length,
      unparsedCount:itemRows.filter(r=>r.parseStatus==='unparsed').length,
      parserSpecUnavailableCount:itemRows.filter(r=>r.parseStatus==='parser_spec_unavailable').length,
      adjudicationRequiredCount:itemRows.filter(r=>r.resolutionStatus==='adjudication_required').length,
      parseStatuses,
      resolutionStatuses,
      status:itemRows.length===0 ? 'not_collected' : (
        itemRows.every(r=>r.resolutionStatus==='mechanically_resolved') ? 'resolved' : 'partially_or_unresolved'
      ),
    });
  }

  return {
    schema:'blum-cohort-battery-query-result-v1',
    sourceMeasurements:{
      schema:measurements.schema,
      generatedAt:measurements.generatedAt || null,
      measurementCount:measurements.measurementCount ?? null,
      batteryRef:measurements.batteryRef || null,
      sourceIndex:measurements.sourceIndex || null,
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
