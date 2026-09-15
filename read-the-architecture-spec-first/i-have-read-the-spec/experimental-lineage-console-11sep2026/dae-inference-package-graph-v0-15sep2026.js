'use strict';

// DAE INFERENCE PACKAGE GRAPH v0 — 15 Sep 2026
//
// Scientific unit at inference time:
//   CALL -> INPUT PACKAGE -> INFERENCE -> OUTPUT PACKAGE
//
// System framing, prior conversation messages, and the current user message are
// sections of ONE input package. Likewise XML-ish reply/reflection/etc. spans are
// second-layer sections of ONE raw output package.
//
// Event identity is separate from content identity:
// - callUid / inputPackageUid / outputPackageUid identify administered events;
// - contentHash identifies canonical normalized package/output content.
//
// Frozen witnesses remain authoritative for exact provider serialization. The
// package hash here covers the canonical structured representation retained by
// the retrospective importer: {systemPrompt, ordered modelVisibleMessages}.

const Graph = require('./dae-message-lineage-graph-v0-15sep2026.js');

function canonicalMessage(message) {
  return {
    role: String(message?.role || ''),
    content: Graph.messageText(message),
  };
}

function canonicalInputPackage(systemPrompt, messages) {
  return {
    systemPrompt: systemPrompt === null || systemPrompt === undefined ? null : String(systemPrompt),
    messages: (messages || []).map(canonicalMessage),
  };
}

function packageContentHash(pkg) {
  return 'sha256:' + Graph.hashHex(Graph.stableStringify(pkg));
}

function addUnique(map, key, value, kind) {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, value);
    return;
  }
  if (Graph.stableStringify(existing) !== Graph.stableStringify(value)) {
    throw new Error(`${kind}_identity_conflict:${key}`);
  }
}

function addInputPackage(store, spec) {
  const inputPackageUid = Graph.uid('inpkg', { callUid: spec.callUid });
  const canonical = canonicalInputPackage(spec.systemPrompt, spec.messages);
  const sectionUids = [];
  let ordinal = 0;

  if (canonical.systemPrompt !== null) {
    const sectionUid = Graph.uid('insec', { inputPackageUid, ordinal, sectionType: 'system' });
    const section = {
      sectionUid,
      packageUid: inputPackageUid,
      packageSide: 'input',
      sectionType: 'system',
      role: 'system',
      ordinal,
      content: canonical.systemPrompt,
      contentHash: Graph.sha256Text(canonical.systemPrompt),
    };
    addUnique(store.sections, sectionUid, section, 'input_section');
    sectionUids.push(sectionUid);
    ordinal += 1;
  }

  for (let messageOrdinal = 0; messageOrdinal < canonical.messages.length; messageOrdinal += 1) {
    const message = canonical.messages[messageOrdinal];
    const sectionUid = Graph.uid('insec', { inputPackageUid, ordinal, sectionType: 'message', messageOrdinal, role: message.role });
    const section = {
      sectionUid,
      packageUid: inputPackageUid,
      packageSide: 'input',
      sectionType: 'message',
      role: message.role,
      ordinal,
      messageOrdinal,
      content: message.content,
      contentHash: Graph.sha256Text(message.content),
    };
    addUnique(store.sections, sectionUid, section, 'input_section');
    sectionUids.push(sectionUid);
    ordinal += 1;
  }

  const pkg = {
    inputPackageUid,
    callUid: spec.callUid,
    canonicalPackage: canonical,
    contentHash: packageContentHash(canonical),
    sectionUids,
    sectionCount: sectionUids.length,
    serializationStatus: spec.serializationStatus || 'canonical_normalized_from_witness',
    sourcePath: spec.sourcePath || null,
  };
  addUnique(store.inputPackages, inputPackageUid, pkg, 'input_package');
  return pkg;
}

function normalizeOutputSections(xmlLike) {
  const out = [];
  if (!xmlLike || typeof xmlLike !== 'object') return out;
  const sections = xmlLike.sections && typeof xmlLike.sections === 'object' ? xmlLike.sections : {};
  const integrity = xmlLike.sectionIntegrity && typeof xmlLike.sectionIntegrity === 'object' ? xmlLike.sectionIntegrity : {};
  for (const tag of Object.keys(sections).sort()) {
    const values = Array.isArray(sections[tag]) ? sections[tag] : [sections[tag]];
    values.forEach((value, occurrence) => out.push({
      tag,
      occurrence,
      content: String(value ?? ''),
      integrity: integrity[tag] || null,
    }));
  }
  return out;
}

function addOutputPackage(store, spec) {
  const outputPackageUid = Graph.uid('outpkg', { callUid: spec.callUid });
  const content = String(spec.content ?? '');
  const sectionUids = [];
  const sections = normalizeOutputSections(spec.xml);

  for (let ordinal = 0; ordinal < sections.length; ordinal += 1) {
    const item = sections[ordinal];
    const sectionUid = Graph.uid('outsec', { outputPackageUid, tag: item.tag, occurrence: item.occurrence });
    const section = {
      sectionUid,
      packageUid: outputPackageUid,
      packageSide: 'output',
      sectionType: 'xml_section',
      tag: item.tag,
      occurrence: item.occurrence,
      ordinal,
      integrity: item.integrity,
      content: item.content,
      contentHash: Graph.sha256Text(item.content),
    };
    addUnique(store.sections, sectionUid, section, 'output_section');
    sectionUids.push(sectionUid);
  }

  const pkg = {
    outputPackageUid,
    callUid: spec.callUid,
    content,
    contentHash: Graph.sha256Text(content),
    sectionUids,
    sectionCount: sectionUids.length,
    callOutcome: spec.callOutcome || null,
    stopReason: spec.stopReason ?? null,
    sourcePath: spec.sourcePath || null,
  };
  addUnique(store.outputPackages, outputPackageUid, pkg, 'output_package');
  return pkg;
}

function rawInstanceHint(collection, kind, record) {
  if (kind === 'trunk') {
    return Graph.uid('inst', { collection, kind: 'lived_trunk', trunkKey: String(record.trunkKey) });
  }
  if (kind === 'branch') {
    return Graph.uid('inst', { collection, kind: 'branch_call', observationId: record.observationId });
  }
  return Graph.uid('inst', { collection, kind: 'root_call', observationId: record.observationId });
}

function addRawCall(store, collection, kind, record, trajectoryOrdinal = 0) {
  const sourcePath = record?.source?.path || null;
  const callUid = Graph.uid('call', {
    collection,
    sourcePath,
    kind,
    observationId: record?.observationId || null,
    trunkKey: record?.trunkKey || null,
    turn: record?.turn ?? null,
  });
  const input = addInputPackage(store, {
    callUid,
    systemPrompt: record?.systemPrompt ?? null,
    messages: record?.modelVisibleMessages || [],
    sourcePath,
    serializationStatus: 'canonical_normalized_from_raw_call_witness',
  });
  const output = addOutputPackage(store, {
    callUid,
    content: record?.rawOutput ?? '',
    xml: record?.xml || null,
    callOutcome: record?.callOutcome || null,
    stopReason: record?.stopReason ?? null,
    sourcePath,
  });
  const instanceUidHint = rawInstanceHint(collection, kind, record);
  const trajectoryKey = kind === 'trunk'
    ? `raw::${collection}::trunk::${record.trunkKey}`
    : `raw::${collection}::${kind}::${record.observationId}`;
  const call = {
    callUid,
    collection,
    sourcePath,
    sourceKind: `raw2_plus_${kind}`,
    inputPackageUid: input.inputPackageUid,
    outputPackageUid: output.outputPackageUid,
    instanceUidHint,
    trajectoryKey,
    trajectoryOrdinal,
    observationId: record?.observationId || null,
    trunkKey: record?.trunkKey || null,
    turn: record?.turn ?? null,
    family: record?.family || record?.source?.originalCell || null,
    replicate: record?.replicate ?? record?.source?.originalReplicate ?? null,
    probeId: record?.probeId || record?.questionId || null,
    forkId: record?.forkId || null,
    callOutcome: record?.callOutcome || null,
    stopReason: record?.stopReason ?? null,
    ancestryType: kind === 'trunk' ? 'lived_trunk' : (record?.ancestryType || null),
  };
  addUnique(store.calls, callUid, call, 'call');
  return call;
}

function pilotXmlFromSections(sections) {
  if (!sections || typeof sections !== 'object') return null;
  const normalized = {};
  for (const [tag, value] of Object.entries(sections)) normalized[tag] = Array.isArray(value) ? value : [value];
  return { sections: normalized, sectionIntegrity: Object.fromEntries(Object.keys(normalized).map(tag => [tag, 'recorded_section'])) };
}

function pilotTrunkTranscript(turns, throughIndexExclusive) {
  const messages = [];
  const ordered = (turns || []).slice().sort((a, b) => Number(a?.n || 0) - Number(b?.n || 0));
  const stop = Math.min(ordered.length, throughIndexExclusive);
  for (let i = 0; i < stop; i += 1) {
    const turn = ordered[i] || {};
    messages.push({ role: 'user', content: String(turn.sent ?? '') });
    if (turn.raw_response !== null && turn.raw_response !== undefined) {
      messages.push({ role: 'assistant', content: String(turn.raw_response) });
    }
  }
  return messages;
}

function buildPilot1Calls(store, record) {
  if (!record?.cells) return [];
  const calls = [];
  const trunkCells = new Map();

  for (const cell of record.cells) {
    if (cell?.kind !== 'trunk') continue;
    const trunkId = String(cell.trunk_id || cell.source_file || `pilot1-${cell.cell}-r${cell.replicate}`);
    trunkCells.set(trunkId, cell);
    const ordered = (cell.turns || []).slice().sort((a, b) => Number(a?.n || 0) - Number(b?.n || 0));
    const instanceUidHint = Graph.uid('inst', { collection: 'pilot1', kind: 'lived_trunk', trunkId });
    for (let i = 0; i < ordered.length; i += 1) {
      const turn = ordered[i] || {};
      const sourcePath = cell.source_file || trunkId;
      const callUid = Graph.uid('call', { collection: 'pilot1', sourcePath, kind: 'trunk', turn: turn.n ?? i + 1 });
      const messages = [...pilotTrunkTranscript(ordered, i), { role: 'user', content: String(turn.sent ?? '') }];
      const input = addInputPackage(store, {
        callUid,
        systemPrompt: turn.system_prompt ?? cell.system_prompt ?? null,
        messages,
        sourcePath,
        serializationStatus: 'reconstructed_from_pilot1_record',
      });
      const output = addOutputPackage(store, {
        callUid,
        content: turn.raw_response ?? '',
        xml: pilotXmlFromSections(turn.sections),
        callOutcome: turn.raw_response === null || turn.raw_response === undefined ? 'missing_output' : 'complete_recorded',
        stopReason: turn.stop_reason ?? null,
        sourcePath,
      });
      const call = {
        callUid,
        collection: 'pilot1',
        sourcePath,
        sourceKind: 'pilot1_trunk_turn',
        inputPackageUid: input.inputPackageUid,
        outputPackageUid: output.outputPackageUid,
        instanceUidHint,
        trajectoryKey: `pilot1::trunk::${trunkId}`,
        trajectoryOrdinal: i,
        observationId: null,
        trunkKey: trunkId,
        turn: turn.n ?? i + 1,
        family: cell.cell || null,
        replicate: cell.replicate ?? null,
        probeId: turn.question_id || null,
        forkId: null,
        callOutcome: turn.raw_response === null || turn.raw_response === undefined ? 'missing_output' : 'complete_recorded',
        stopReason: turn.stop_reason ?? null,
        ancestryType: 'pilot1_lived_trunk',
      };
      addUnique(store.calls, callUid, call, 'call');
      calls.push(call);
    }
  }

  for (const cell of record.cells) {
    if (cell?.kind === 'trunk') continue;
    const sourcePath = cell.source_file || cell.trunk_id || null;
    const isCold = cell?.kind === 'cold';
    const parentCell = !isCold && cell.parent_trunk ? trunkCells.get(String(cell.parent_trunk)) || null : null;
    const parentMessages = parentCell ? pilotTrunkTranscript(parentCell.turns || [], (parentCell.turns || []).length) : [];
    for (let i = 0; i < (cell.branches || []).length; i += 1) {
      const branch = cell.branches[i] || {};
      const callUid = Graph.uid('call', {
        collection: 'pilot1', sourcePath, kind: isCold ? 'cold' : 'branch', item: branch.item || null,
        branch: branch.branch || null, replicate: cell.replicate ?? null, ordinal: i,
      });
      const messages = [...parentMessages, { role: 'user', content: String(branch.sent ?? '') }];
      const input = addInputPackage(store, {
        callUid,
        systemPrompt: branch.system_prompt ?? cell.system_prompt ?? null,
        messages,
        sourcePath,
        serializationStatus: parentCell ? 'reconstructed_from_explicit_pilot1_parent_trunk' : 'reconstructed_from_pilot1_record',
      });
      const output = addOutputPackage(store, {
        callUid,
        content: branch.raw_response ?? '',
        xml: pilotXmlFromSections(branch.sections),
        callOutcome: branch.raw_response === null || branch.raw_response === undefined ? 'missing_output' : 'complete_recorded',
        stopReason: branch.stop_reason ?? null,
        sourcePath,
      });
      const instanceUidHint = Graph.uid('inst', {
        collection: 'pilot1', kind: isCold ? 'cold_call' : 'branch_call', sourcePath,
        item: branch.item || null, branch: branch.branch || null, replicate: cell.replicate ?? null, ordinal: i,
      });
      const call = {
        callUid,
        collection: 'pilot1',
        sourcePath,
        sourceKind: isCold ? 'pilot1_cold_call' : 'pilot1_branch_call',
        inputPackageUid: input.inputPackageUid,
        outputPackageUid: output.outputPackageUid,
        instanceUidHint,
        trajectoryKey: `pilot1::${isCold ? 'cold' : 'branch'}::${sourcePath}::${i}`,
        trajectoryOrdinal: parentCell ? (parentCell.turns || []).length : 0,
        observationId: null,
        trunkKey: cell.trunk_id || sourcePath,
        turn: null,
        family: cell.cell || null,
        replicate: cell.replicate ?? null,
        probeId: branch.item || null,
        forkId: isCold ? 'cold' : (branch.branch || null),
        callOutcome: branch.raw_response === null || branch.raw_response === undefined ? 'missing_output' : 'complete_recorded',
        stopReason: branch.stop_reason ?? null,
        ancestryType: isCold ? 'cold_no_lived_parent' : 'pilot1_lived_trunk_branch',
        parentTrajectoryKey: parentCell ? `pilot1::trunk::${String(cell.parent_trunk)}` : null,
      };
      addUnique(store.calls, callUid, call, 'call');
      calls.push(call);
    }
  }
  return calls;
}

function bindPackagesToInstances(index) {
  const census = index?.instanceStartCensus;
  const graph = index?.inferencePackageGraph;
  if (!census?.instances || !graph?.calls) return index;
  const calls = Object.values(graph.calls);
  const byInstance = new Map();
  for (const call of calls) {
    if (!byInstance.has(call.instanceUidHint)) byInstance.set(call.instanceUidHint, []);
    byInstance.get(call.instanceUidHint).push(call);
  }
  const callsByTrajectoryKey = new Map();
  for (const call of calls) {
    if (!callsByTrajectoryKey.has(call.trajectoryKey)) callsByTrajectoryKey.set(call.trajectoryKey, []);
    callsByTrajectoryKey.get(call.trajectoryKey).push(call);
  }
  for (const group of callsByTrajectoryKey.values()) group.sort((a, b) => Number(a.trajectoryOrdinal || 0) - Number(b.trajectoryOrdinal || 0));

  for (const instance of census.instances) {
    const owned = (byInstance.get(instance.instanceUid) || []).slice().sort((a, b) => Number(a.trajectoryOrdinal || 0) - Number(b.trajectoryOrdinal || 0));
    let inherited = [];
    if (instance.instanceKind === 'branch_from_lived_trunk' && owned.length === 1 && owned[0].parentTrajectoryKey) {
      inherited = (callsByTrajectoryKey.get(owned[0].parentTrajectoryKey) || []).slice();
    } else if (instance.instanceKind === 'branch_from_lived_trunk' && instance.parentInstanceUid) {
      inherited = (byInstance.get(instance.parentInstanceUid) || []).slice().sort((a, b) => Number(a.trajectoryOrdinal || 0) - Number(b.trajectoryOrdinal || 0));
    }
    const trajectoryCalls = [...inherited, ...owned];
    instance.ownedCallUids = owned.map(x => x.callUid);
    instance.inheritedCallUids = inherited.map(x => x.callUid);
    instance.callUids = trajectoryCalls.map(x => x.callUid);
    instance.callCount = trajectoryCalls.length;
    instance.firstCallUid = trajectoryCalls[0]?.callUid || null;
    instance.firstInputPackageUid = trajectoryCalls[0]?.inputPackageUid || null;
    instance.firstOutputPackageUid = trajectoryCalls[0]?.outputPackageUid || null;
    instance.terminalCallUid = trajectoryCalls.at(-1)?.callUid || null;
    instance.terminalInputPackageUid = trajectoryCalls.at(-1)?.inputPackageUid || null;
    instance.terminalOutputPackageUid = trajectoryCalls.at(-1)?.outputPackageUid || null;
    instance.packageBindingStatus = trajectoryCalls.length ? 'bound' : 'unbound';
  }
  census.packageBoundInstanceCount = census.instances.filter(x => x.packageBindingStatus === 'bound').length;
  census.packageUnboundInstanceCount = census.instances.filter(x => x.packageBindingStatus !== 'bound').length;
  return index;
}

function attachInferencePackageGraph(index, { pilot1Record = null, collections = [] } = {}) {
  if (!index || typeof index !== 'object') throw new Error('inference_package_index_required');
  const store = {
    calls: new Map(),
    inputPackages: new Map(),
    outputPackages: new Map(),
    sections: new Map(),
  };

  buildPilot1Calls(store, pilot1Record);
  for (const entry of collections || []) {
    const collection = String(entry?.name || entry?.collection || 'unknown');
    const dataset = entry?.dataset || {};
    const trunkGroups = new Map();
    for (const turn of dataset.trunkTurns || []) {
      const key = String(turn?.trunkKey || 'unknown');
      if (!trunkGroups.has(key)) trunkGroups.set(key, []);
      trunkGroups.get(key).push(turn);
    }
    for (const group of trunkGroups.values()) {
      group.sort((a, b) => Number(a?.turn ?? -1) - Number(b?.turn ?? -1) || String(a?.source?.path || '').localeCompare(String(b?.source?.path || '')));
      group.forEach((turn, ordinal) => addRawCall(store, collection, 'trunk', turn, ordinal));
    }
    for (const observation of dataset.branchObservations || []) addRawCall(store, collection, 'branch', observation, 0);
    for (const observation of dataset.coldObservations || []) addRawCall(store, collection, 'cold', observation, 0);
  }

  function sortedObject(map) {
    return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
  const calls = sortedObject(store.calls);
  const inputPackages = sortedObject(store.inputPackages);
  const outputPackages = sortedObject(store.outputPackages);
  const sections = sortedObject(store.sections);
  const callRows = Object.values(calls);

  index.inferencePackageGraph = {
    schema: 'blum-dae-inference-package-graph-v0',
    identitySemantics: {
      callUid: 'one administered inference call event',
      inputPackageUid: 'one complete canonical model-visible input package event for a call',
      outputPackageUid: 'one complete raw output package event for a call',
      inputPackageContentHash: 'content identity of canonical {systemPrompt, ordered messages}; not provider-byte serialization identity',
      sectionUid: 'second-layer addressable subdivision of an input or output package',
      trajectory: 'ordered call references; inherited calls may be referenced by branch trajectories but are owned once',
    },
    callCount: callRows.length,
    inputPackageCount: Object.keys(inputPackages).length,
    outputPackageCount: Object.keys(outputPackages).length,
    sectionCount: Object.keys(sections).length,
    calls,
    inputPackages,
    outputPackages,
    sections,
  };
  return index;
}

module.exports = {
  canonicalMessage,
  canonicalInputPackage,
  packageContentHash,
  normalizeOutputSections,
  buildPilot1Calls,
  attachInferencePackageGraph,
  bindPackagesToInstances,
};
