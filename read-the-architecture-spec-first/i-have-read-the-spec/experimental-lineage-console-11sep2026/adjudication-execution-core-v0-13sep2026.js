// Blum adjudication execution core v0 — 13 Sep 2026
// Provider-agnostic execution spine: snapshot -> packet slots -> judgement import -> consensus -> escalation.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.BlumAdjudicationExecutionCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='adjudication-execution-core-v0-13sep2026';

  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canonicalize(x){
    if(Array.isArray(x)) return x.map(canonicalize);
    if(x&&typeof x==='object') return Object.keys(x).sort().reduce((o,k)=>(o[k]=canonicalize(x[k]),o),{});
    return x;
  }
  function stableStringify(x){return JSON.stringify(canonicalize(x));}
  function fnv1a(s){
    let h=0x811c9dc5;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function fingerprint(x){return 'fnv1a:'+fnv1a(stableStringify(x));}

  function freezeExecution(spec,populationSnapshot,corpusFingerprint){
    if(!spec||!spec.adjudicationSpecId) throw new Error('missing adjudicationSpecId');
    const units=(populationSnapshot||[]).map(u=>String(u.unitId||u.observationId||u.packetId||''));
    if(units.some(x=>!x)) throw new Error('population unit missing id');
    if(new Set(units).size!==units.length) throw new Error('duplicate population unit id');
    const frozen={
      executionSchema:'blum-adjudication-execution-v0',
      adjudicationSpecId:spec.adjudicationSpecId,
      adjudicationSpecVersion:spec.version||1,
      specFingerprint:spec.fingerprint||fingerprint(spec),
      corpusFingerprint:corpusFingerprint||null,
      populationRule:clone(spec.population||null),
      populationSnapshot:units.slice(),
      panel:clone(spec.panel||{}),
      randomisation:clone(spec.randomisation||{}),
      frozenAt:new Date().toISOString()
    };
    frozen.executionFingerprint=fingerprint({...frozen,frozenAt:null});
    return frozen;
  }

  function materializeReaderSlots(execution,packetByUnit){
    const n=Math.max(1,Number(execution&&execution.panel&&execution.panel.readersPerUnit)||1);
    const out=[];
    for(const unitId of execution.populationSnapshot||[]){
      const packet=packetByUnit&&packetByUnit[unitId];
      if(!packet) throw new Error('missing packet for '+unitId);
      for(let i=1;i<=n;i++) out.push({
        assignmentSchema:'blum-adjudication-assignment-v0',
        executionFingerprint:execution.executionFingerprint,
        specFingerprint:execution.specFingerprint,
        unitId,
        packetId:packet.packetId||unitId,
        readerSlot:'r'+i,
        packet:clone(packet)
      });
    }
    return out;
  }

  function validateJudgement(j,assignment){
    const errors=[];
    if(!j||typeof j!=='object') return {ok:false,errors:['judgement_not_object']};
    if(j.executionFingerprint!==assignment.executionFingerprint) errors.push('execution_fingerprint_mismatch');
    if(j.specFingerprint!==assignment.specFingerprint) errors.push('spec_fingerprint_mismatch');
    if(String(j.unitId)!==String(assignment.unitId)) errors.push('unit_id_mismatch');
    if(String(j.readerSlot)!==String(assignment.readerSlot)) errors.push('reader_slot_mismatch');
    if(!j.answers||typeof j.answers!=='object') errors.push('answers_missing');
    if(!j.readerProvenance||typeof j.readerProvenance!=='object') errors.push('reader_provenance_missing');
    return {ok:errors.length===0,errors};
  }

  function importJudgements(assignments,judgements){
    const assignmentMap=new Map((assignments||[]).map(a=>[a.unitId+'::'+a.readerSlot,a]));
    const accepted=[],rejected=[],seen=new Set();
    for(const j of judgements||[]){
      const key=String(j&&j.unitId)+'::'+String(j&&j.readerSlot);
      const a=assignmentMap.get(key);
      if(!a){rejected.push({judgement:j,errors:['assignment_not_found']});continue;}
      if(seen.has(key)){rejected.push({judgement:j,errors:['duplicate_reader_slot']});continue;}
      const v=validateJudgement(j,a);
      if(!v.ok){rejected.push({judgement:j,errors:v.errors});continue;}
      seen.add(key);accepted.push(clone(j));
    }
    return {accepted,rejected};
  }

  function consensusForQuestion(rows,questionId){
    const vals=rows.map(r=>r.answers&&r.answers[questionId]).filter(v=>v!==undefined&&v!==null);
    if(!vals.length) return {status:'unresolved',value:null,n:0,counts:{}};
    const counts={};
    for(const v of vals){const k=typeof v==='string'?v:stableStringify(v);counts[k]=(counts[k]||0)+1;}
    const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const [winner,count]=ranked[0];
    const tie=ranked.length>1&&ranked[1][1]===count;
    return {status:tie?'disagreement':(count===vals.length?'unanimous':'majority'),value:tie?null:winner,n:vals.length,counts};
  }

  function reconcile(execution,acceptedJudgements,questionIds){
    const byUnit={};
    for(const j of acceptedJudgements||[]){(byUnit[j.unitId]||(byUnit[j.unitId]=[])).push(j);}
    const results=[];
    const required=Math.max(1,Number(execution&&execution.panel&&execution.panel.readersPerUnit)||1);
    for(const unitId of execution.populationSnapshot||[]){
      const rows=byUnit[unitId]||[];
      const questions={};
      for(const qid of questionIds||[]) questions[qid]=consensusForQuestion(rows,qid);
      const lowConfidence=rows.some(r=>r.confidence==='low'||Object.values(r.confidence||{}).includes('low'));
      const disagreement=Object.values(questions).some(x=>x.status==='disagreement');
      const incomplete=rows.length<required;
      results.push({
        unitId,readerCount:rows.length,requiredReaders:required,questions,
        status:incomplete?'incomplete':(disagreement||lowConfidence?'escalate':'resolved'),
        escalationReasons:[...(incomplete?['incomplete_panel']:[]),...(disagreement?['reader_disagreement']:[]),...(lowConfidence?['low_confidence']:[])]
      });
    }
    return results;
  }

  function deriveThresholdSemantics(consensus){
    const q=consensus&&consensus.questions||{};
    const policy=q.policy_form&&q.policy_form.value;
    const polarity=q.sentinel_polarity&&q.sentinel_polarity.value;
    if(!policy) return {semanticClass:'unresolved',polarityMismatch:null};
    return {
      semanticClass:policy,
      polarityMismatch:polarity==='mismatch'?true:(polarity==='match'?false:null)
    };
  }

  return {VERSION,canonicalize,stableStringify,fingerprint,freezeExecution,materializeReaderSlots,validateJudgement,importJudgements,consensusForQuestion,reconcile,deriveThresholdSemantics};
});
