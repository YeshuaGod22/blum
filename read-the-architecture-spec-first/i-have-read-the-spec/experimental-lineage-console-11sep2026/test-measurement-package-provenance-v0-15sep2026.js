'use strict';

const assert = require('assert');
const Provenance = require('./measurement-package-provenance-v0-15sep2026.js');

function fixtureGraph() {
  return {
    schema: 'blum-dae-inference-package-graph-v0',
    calls: {
      call_a: {
        callUid:'call_a', observationId:'obs-a', collection:'raw7', sourcePath:'raw7/a.json',
        inputPackageUid:'in_a', outputPackageUid:'out_a', probeId:'N4', family:'C', replicate:1, forkId:'cold',
      },
      call_b: {
        callUid:'call_b', observationId:'obs-b', collection:'raw7', sourcePath:'raw7/b.json',
        inputPackageUid:'in_b', outputPackageUid:'out_b', probeId:'N4', family:'C', replicate:2, forkId:'cold',
      },
    },
    outputPackages: {
      out_a:{outputPackageUid:'out_a',sectionUids:['sec_reply']},
      out_b:{outputPackageUid:'out_b',sectionUids:['sec_reply_1','sec_reply_2']},
    },
    sections: {
      sec_reply:{sectionUid:'sec_reply',packageUid:'out_a',packageSide:'output',tag:'reply',content:'32'},
      sec_reply_1:{sectionUid:'sec_reply_1',packageUid:'out_b',packageSide:'output',tag:'reply',content:'35'},
      sec_reply_2:{sectionUid:'sec_reply_2',packageUid:'out_b',packageSide:'output',tag:'reply',content:'36'},
    },
  };
}

const index = { inferencePackageGraph: fixtureGraph() };
const resolved = Provenance.resolveObservationPackageProvenance(index, {observationId:'obs-a',collection:'raw7'}, {section:'reply',text:'32'});
assert.equal(resolved.status,'call_resolved');
assert.equal(resolved.joinMethod,'observation_id');
assert.equal(resolved.callUid,'call_a');
assert.equal(resolved.outputPackageUid,'out_a');
assert.equal(resolved.outputSectionUid,'sec_reply');
assert.equal(resolved.outputSectionStatus,'resolved_by_tag');

const disambiguated = Provenance.resolveObservationPackageProvenance(index, {observationId:'obs-b',collection:'raw7'}, {section:'reply',text:'35'});
assert.equal(disambiguated.outputSectionUid,'sec_reply_1');
assert.equal(disambiguated.outputSectionStatus,'resolved_by_tag_and_text');

const ambiguous = Provenance.resolveObservationPackageProvenance(index, {observationId:'obs-b',collection:'raw7'}, {section:'reply',text:'not-an-occurrence'});
assert.equal(ambiguous.outputSectionUid,null);
assert.equal(ambiguous.outputSectionStatus,'section_ambiguous');
assert.deepEqual(ambiguous.candidateOutputSectionUids,['sec_reply_1','sec_reply_2']);

const missingCall = Provenance.resolveObservationPackageProvenance(index, {observationId:'obs-missing',collection:'raw7'}, {section:'reply',text:'9'});
assert.equal(missingCall.status,'call_unresolved');
assert.equal(missingCall.callUid,null);

const unavailable = Provenance.resolveObservationPackageProvenance({}, {observationId:'x'}, {section:'reply'});
assert.equal(unavailable.status,'package_provenance_unavailable');

console.log('measurement package provenance adversarial regression: PASS');
