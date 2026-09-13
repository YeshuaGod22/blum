'use strict';

const assert=require('assert');
const R=require('./raw12-cold-counterpart-resolver-v0-13sep2026.js');

function obs(collection,condition,replicate,item,value){
  return {
    observationId:`${collection}:${condition}:r${replicate}:${item}`,
    collection,condition,family:condition,replicate,
    trunkKey:`${condition.replace(/a$/,'')}-r${replicate}`,
    forkId:collection==='raw12'?'a':'cold_schema',
    ancestryType:collection==='raw12'?'lived_trunk_branch':'cold_schema_no_lived_parent',
    canonicalItemId:item,itemCoreHash:`hash:${item}`,
    sourcePath:`${collection}/${condition}-r${replicate}-${item}.json`,
    rawOutput:`<reply>${value}</reply>`,sections:{reply:[String(value)]},callOutcome:'complete',
  };
}

const observations=[];
for(const [anchor,lived,cold] of [['AS','ASa','ASQ'],['H','Ha','HQ'],['F','Fa','FQ'],['CP','CPa','C']]){
  for(let r=1;r<=3;r++){
    observations.push(obs('raw12',lived,r,'D1',10+r));
    observations.push(obs('raw7',cold,r,'D1',50+r));
  }
  if(cold==='C')for(let r=4;r<=10;r++)observations.push(obs('raw7','C',r,'D1',50+r));
}
const result=R.resolve({observations});
assert.equal(result.anchorCount,12);
assert.equal(result.resolvedAnchorCount,12);
assert.deepEqual(result.missingAnchors,[]);
assert.equal(R.itemFor(result,'F','D1').livedN,3);
assert.equal(R.itemFor(result,'F','D1').coldN,3);
assert.equal(R.itemFor(result,'CP','D1').livedN,3);
assert.equal(R.itemFor(result,'CP','D1').coldN,10,'C retains all ten baseline replicates');
assert.equal(R.familyFor(result,'AS').coldCondition,'ASQ');
assert.equal(R.familyFor(result,'H').coldCondition,'HQ');
assert.equal(R.familyFor(result,'F').coldCondition,'FQ');
assert.equal(R.familyFor(result,'CP').coldCondition,'C');
assert.ok(result.anchors.every(a=>a.relation==='designed_counterpart_not_lineage'));
console.log('PASS raw12-cold-counterpart-resolver-v0');
console.log(JSON.stringify({anchors:result.anchorCount,cpColdN:R.itemFor(result,'CP','D1').coldN},null,2));
