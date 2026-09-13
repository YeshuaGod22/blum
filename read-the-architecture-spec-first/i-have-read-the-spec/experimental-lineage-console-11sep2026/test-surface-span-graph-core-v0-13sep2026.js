const assert=require('assert');
const Core=require('./surface-span-graph-core-v0-13sep2026.js');

const raw='Prelude <reflection>inner <debate>nested</debate> tail</reflection> epilogue <reply>YES</reply>';
const seg=Core.segmentOutput(raw,'obs1');
assert.equal(seg.spans.length,6);
assert.deepEqual(seg.spans.map(x=>x.surfaceType),['untagged','tagged','tagged','tagged','untagged','tagged']);
assert.deepEqual(seg.spans.map(x=>x.tagName),[null,'reflection','debate','reflection',null,'reply']);
for(const s of seg.spans) assert.equal(raw.slice(s.startOffset,s.endOffset),s.text);
assert.equal(seg.anomalyCount,0);

const broken=Core.segmentOutput('x <reflection>y <reply>z','obs2');
assert.equal(broken.unclosedTags.length,2);
assert(broken.anomalyCount>=2);

const graph=Core.buildSurfaceGraph({schema:'fixture',observations:[
  {observationId:'o1',rawOutput:'a <reply>b</reply> c',collection:'c1',canonicalItemId:'Q1',trunkKey:'t1'},
  {observationId:'o2',rawOutput:'<reflection>d</reflection>',collection:'c1',canonicalItemId:'Q1',trunkKey:'t2'}
]});
assert.equal(graph.observationCount,2);
assert.equal(graph.nodeCount,4);
assert.equal(graph.edges.filter(e=>e.kind==='sequence').length,2);
const census=Core.census(graph);
assert.equal(census.untagged,2);
assert.equal(census.tagged,2);
assert.equal(census.observationsWithUntagged,1);
console.log('PASS test-surface-span-graph-core-v0-13sep2026');
