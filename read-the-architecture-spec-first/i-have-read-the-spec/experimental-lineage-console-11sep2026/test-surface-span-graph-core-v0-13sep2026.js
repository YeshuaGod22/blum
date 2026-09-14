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

const observations=[
  {observationId:'o1',rawOutput:'a <reply>b</reply> c',collection:'c1',canonicalItemId:'Q1',trunkKey:'t1'},
  {observationId:'o2',rawOutput:'<reflection>d</reflection>',collection:'c1',canonicalItemId:'Q1',trunkKey:'t2'}
];
const graph=Core.buildSurfaceGraph({schema:'fixture',observations});
assert.equal(graph.observationCount,2);
assert.equal(graph.nodeCount,4);
assert.equal(graph.edges.filter(e=>e.kind==='sequence').length,2);
const census=Core.census(graph);
assert.equal(census.untagged,2);
assert.equal(census.tagged,2);
assert.equal(census.observationsWithUntagged,1);

const compact=Core.buildSurfaceGraph({schema:'portable-fixture',itemHistories:{Q1:{observations}}});
assert.equal(compact.observationCount,2);
assert.equal(compact.nodeCount,4);
const both=Core.flattenIndexObservations({observations:[observations[0]],itemHistories:{Q1:{observations}}});
assert.equal(both.length,2);

const manifest=Core.semanticInputManifest(graph);
assert.equal(manifest.schema,'blum-semantic-input-manifest-v0');
assert.equal(manifest.unitCount,graph.nodeCount);
assert.equal(manifest.units[0].spanId,graph.nodes[0].spanId);
assert.equal(manifest.units[0].text,graph.nodes[0].text);
assert.equal(manifest.spanSetFingerprint,Core.spanSetFingerprint(graph));

const semanticSpec={
  semanticCoordinateSpecId:'fixture-semantic-v0',version:0,inputUnit:'surface_span',
  embedding:{provider:'fixture',model:'fixture-embedding',dimensions:8,normalization:'unit'},
  projection:{method:'fixture-2d',dimensions:2,seed:'42',parameters:{}},coverage:'complete'
};
const semanticArtifact={
  schema:'blum-semantic-coordinate-artifact-v0',
  spec:semanticSpec,
  specFingerprint:Core.fingerprint(semanticSpec),
  spanSetFingerprint:Core.spanSetFingerprint(graph),
  coordinates:graph.nodes.map((n,i)=>({spanId:n.spanId,x:i/10,y:-i/20}))
};
let semanticCheck=Core.validateSemanticCoordinates(graph,semanticArtifact);
assert.equal(semanticCheck.ok,true);
assert.equal(semanticCheck.accepted.length,graph.nodeCount);
assert.equal(Core.semanticCoordinateMap(graph,semanticArtifact).size,graph.nodeCount);

const wrongSet={...semanticArtifact,spanSetFingerprint:'fnv1a:deadbeef'};
assert(Core.validateSemanticCoordinates(graph,wrongSet).errors.includes('span_set_fingerprint_mismatch'));
const duplicate={...semanticArtifact,coordinates:[...semanticArtifact.coordinates,semanticArtifact.coordinates[0]]};
assert.equal(Core.validateSemanticCoordinates(graph,duplicate).ok,false);
const partialSpec={...semanticSpec,coverage:'partial'};
const partial={schema:'blum-semantic-coordinate-artifact-v0',spec:partialSpec,specFingerprint:Core.fingerprint(partialSpec),spanSetFingerprint:Core.spanSetFingerprint(graph),coordinates:semanticArtifact.coordinates.slice(0,2)};
semanticCheck=Core.validateSemanticCoordinates(graph,partial);
assert.equal(semanticCheck.ok,true);
assert.equal(semanticCheck.missing.length,2);

console.log('PASS test-surface-span-graph-core-v0-13sep2026');
