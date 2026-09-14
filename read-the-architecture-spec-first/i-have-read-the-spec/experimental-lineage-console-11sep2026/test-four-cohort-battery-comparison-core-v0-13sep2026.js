'use strict';
const assert=require('assert');
const core=require('./four-cohort-battery-comparison-core-v0-13sep2026.js');

function obs({id,item='D1',hash='h:D1',collection='raw12',condition,forkId='0',replicate=1,value}){
  return {observationId:id,canonicalItemId:item,itemCoreHash:hash,collection,condition,forkId,replicate,parentSnapshotId:`p:${condition}:${replicate}`,sourcePath:`${collection}/${id}.json`,sections:{reply:String(value)},rawOutput:`<reply>${value}</reply>`};
}
const observations=[
  obs({id:'f1',condition:'F',replicate:1,value:80}),obs({id:'f2',condition:'F',replicate:2,value:82}),obs({id:'f3',condition:'F',replicate:3,value:78}),
  obs({id:'fq1',collection:'cold',condition:'FQ',replicate:1,value:55}),obs({id:'fq2',collection:'cold',condition:'FQ',replicate:2,value:57}),obs({id:'fq3',collection:'cold',condition:'FQ',replicate:3,value:53}),
  obs({id:'cp1',condition:'CP',replicate:1,value:70}),obs({id:'cp2',condition:'CP',replicate:2,value:68}),obs({id:'cp3',condition:'CP',replicate:3,value:72}),
  obs({id:'c1',collection:'cold',condition:'C',replicate:1,value:20}),obs({id:'c2',collection:'cold',condition:'C',replicate:2,value:22}),obs({id:'c3',collection:'cold',condition:'C',replicate:3,value:18}),
  // Same canonical item but different wording must form a separate row.
  obs({id:'f-other',item:'D1',hash:'h:D1:variant',condition:'F',value:99}),
  // Prose reply is not silently turned into a score.
  {...obs({id:'c-prose',collection:'cold',condition:'C',value:50}),sections:{reply:'I would choose 50, with reservations.'},rawOutput:'<reply>I would choose 50, with reservations.</reply>'},
];
const index={itemHistories:{D1:{itemCoreVariants:[{itemCoreHash:'h:D1',itemCoreText:'Rate D1'},{itemCoreHash:'h:D1:variant',itemCoreText:'Rate altered D1'}],observations}}};
const recipe=core.recipeFromMatchers({
  F:{condition:'F'},FQ:{condition:'FQ'},CP:{condition:'CP'},C:{condition:'C'}
});
const result=core.compare(index,recipe);
assert.equal(result.schema,'blum-four-cohort-battery-comparison-v0');
assert.equal(result.rows.length,2);
const main=result.rows.find(r=>r.itemCoreHash==='h:D1');
assert(main.complete);
assert.deepEqual(main.cohorts.F.values.sort((a,b)=>a-b),[78,80,82]);
assert.equal(main.cohorts.F.median,80);
assert.equal(main.cohorts.FQ.median,55);
assert.equal(main.cohorts.CP.median,70);
assert.equal(main.cohorts.C.median,20);
assert.equal(main.range,60);
assert.deepEqual(main.ordering,['F','CP','FQ','C']);
assert(main.flags.includes('CROSS_COLLECTION'));
assert.equal(main.points.C.length,3); // prose observation excluded
assert(main.points.F[0].sourcePath);
const variant=result.rows.find(r=>r.itemCoreHash==='h:D1:variant');
assert(!variant.complete);
assert(variant.flags.some(x=>x.startsWith('MISSING:')));

const strict=core.compare(index,recipe,{completeOnly:true});
assert.equal(strict.rows.length,1);

// Overlapping cohort rules are not silently double-counted.
const overlap=core.compare(index,{cohorts:[{id:'A',match:{conditionRegex:'^F'}},{id:'B',match:{condition:'F'}}]});
assert(overlap.ambiguousMembership.length>=3);

assert.equal(core.numericBody('<reply>37.5</reply>'),37.5);
assert.equal(core.numericBody('<reply>about 37.5</reply>'),null);
console.log('four-cohort battery comparison core: ok');