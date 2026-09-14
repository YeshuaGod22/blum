// Blum adjudication pass core v0 — 12 Sep 2026
// Provider-free deterministic contract for designing and rendering semantic adjudication passes.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.BlumAdjudicationPassCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='adjudication-pass-core-v0-12sep2026';

  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canonicalize(x){
    if(Array.isArray(x)) return x.map(canonicalize);
    if(x&&typeof x==='object') return Object.keys(x).sort().reduce((o,k)=>(o[k]=canonicalize(x[k]),o),{});
    return x;
  }
  function stableStringify(x){return JSON.stringify(canonicalize(x));}

  function defaultPass(){
    return {
      adjudicationSpecId:'answer-commitment-v1',
      version:1,
      title:'Answer commitment',
      purpose:'Read what the response adopts without exposing experimental condition or downstream hypothesis.',
      population:{source:'',filter:'',sampling:'all',sampleSize:null},
      visibility:{
        itemQuestion:true, rawResponse:true, mechanicalParse:false, integrityFlags:true,
        collection:false, condition:false, fork:false, parentId:false, siblingResponse:false,
        aggregateStatistics:false, modelIdentity:false
      },
      questions:[
        {id:'adopted_answer',type:'categorical',prompt:'Does the response ultimately adopt an answer of its own to the requested question?',options:['yes','no','unclear'],evidence:'required',confidence:true},
        {id:'answer_form',type:'categorical',prompt:'What form does the adopted answer take?',options:['single_value','range','sentinel','name','categorical_choice','prose_stance','other','not_applicable','unclear'],evidence:'optional',confidence:false},
        {id:'adopted_answer_literal',type:'literal',prompt:'What exactly is the adopted answer? Return null if there is no recoverable answer.',options:[],evidence:'required_if_non_null',confidence:true},
        {id:'objects_or_reframes',type:'categorical',prompt:'Does the response substantially object to or reframe the requested response form before answering?',options:['yes','no','unclear'],evidence:'required_if_yes',confidence:true},
        {id:'alternatives_not_adopted',type:'categorical',prompt:'Are other candidate answers mentioned but not adopted as the response’s own answer?',options:['yes','no','unclear'],evidence:'required_if_yes',confidence:true}
      ],
      panel:{strategy:'fixed_ensemble',readersPerUnit:3,independent:true,agreementRule:'unanimous_or_majority',escalationRule:'disagreement_or_low_confidence'},
      randomisation:{shuffle:true,seed:'20260912'},
      derivations:[],
      provenance:{coreVersion:VERSION,sourcePrecedents:['RAW12-ADJUDICATIONS.json','BLIND-CODING-AND-CORRECTION.md'],createdAt:new Date().toISOString()},
      frozen:false,fingerprint:null,frozenAt:null
    };
  }

  function validatePass(spec){
    const errors=[],warnings=[];
    if(!spec||typeof spec!=='object') return {ok:false,errors:['spec_not_object'],warnings};
    if(!String(spec.adjudicationSpecId||'').trim()) errors.push('missing_spec_id');
    if(!String(spec.title||'').trim()) errors.push('missing_title');
    if(!spec.population||!String(spec.population.source||'').trim()) warnings.push('population_source_not_declared');
    if(!Array.isArray(spec.questions)||!spec.questions.length) errors.push('no_reader_questions');
    const seen=new Set();
    for(const q of spec.questions||[]){
      if(!q.id||!q.prompt||!q.type) errors.push('question_missing_required_field');
      if(seen.has(q.id)) errors.push('duplicate_question_id:'+q.id); else seen.add(q.id);
      if(q.type==='categorical'&&(!Array.isArray(q.options)||q.options.length<2)) errors.push('categorical_without_options:'+q.id);
      if(q.type==='categorical'&&Array.isArray(q.options)&&!q.options.includes('unclear')) warnings.push('categorical_without_unclear:'+q.id);
    }
    if(!spec.visibility||spec.visibility.condition!==false) warnings.push('condition_not_blinded');
    if(spec.visibility&&spec.visibility.aggregateStatistics!==false) warnings.push('aggregate_statistics_visible');
    if(!spec.panel||!(Number(spec.panel.readersPerUnit)>0)) errors.push('invalid_panel_size');
    if(!spec.randomisation||!String(spec.randomisation.seed||'').trim()) warnings.push('shuffle_seed_not_declared');
    return {ok:errors.length===0,errors,warnings};
  }

  function projectObservation(observation,visibility){
    const o=observation||{}, v=visibility||{};
    const out={};
    const map={
      itemQuestion:'itemQuestion',rawResponse:'rawResponse',mechanicalParse:'mechanicalParse',integrityFlags:'integrityFlags',
      collection:'collection',condition:'condition',fork:'fork',parentId:'parentId',siblingResponse:'siblingResponse',
      aggregateStatistics:'aggregateStatistics',modelIdentity:'modelIdentity'
    };
    for(const [flag,key] of Object.entries(map)) if(v[flag]) out[key]=clone(o[key]??null);
    return out;
  }

  function buildPacket(spec,observation,packetId){
    const check=validatePass(spec);
    if(!check.ok) throw new Error('invalid adjudication spec: '+check.errors.join(', '));
    return {
      packetSchema:'blum-adjudication-packet-v0',
      packetId:packetId||String(observation&&observation.observationId||'unassigned'),
      adjudicationSpecId:spec.adjudicationSpecId,
      adjudicationSpecVersion:spec.version,
      evidence:projectObservation(observation,spec.visibility),
      questions:clone(spec.questions),
      instructions:{
        independence:'Judge only the evidence shown. Do not infer hidden condition, hypothesis, sibling outcome, or aggregate effect.',
        uncertainty:'Use unclear when the evidence does not support a stable judgement.',
        evidence:'Where requested, return the shortest exact passage that supports the judgement.'
      }
    };
  }

  function freezePayload(spec){
    const s=clone(spec);
    delete s.fingerprint; delete s.frozenAt; delete s.frozen;
    if(s.provenance) delete s.provenance.updatedAt;
    return canonicalize(s);
  }

  function deriveConsensus(judgements,questionId){
    const rows=(judgements||[]).map(j=>j&&j.answers&&j.answers[questionId]).filter(v=>v!==undefined&&v!==null);
    if(!rows.length) return {status:'unresolved',value:null,n:0,counts:{}};
    const counts={}; for(const v of rows){const k=typeof v==='string'?v:stableStringify(v);counts[k]=(counts[k]||0)+1;}
    const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const [winner,n]=ranked[0];
    const tie=ranked.length>1&&ranked[1][1]===n;
    return {status:tie?'disagreement':(n===rows.length?'unanimous':'majority'),value:tie?null:winner,n:rows.length,counts};
  }

  return {VERSION,defaultPass,canonicalize,stableStringify,validatePass,projectObservation,buildPacket,freezePayload,deriveConsensus};
});
