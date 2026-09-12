'use strict';

// DAE UNIFIED OBSERVATION INDEX v1 — 12 Sep 2026
// Separates canonical item identity, literal item-core wording, and complete
// model-visible presentation wording. v0 remains available for provenance.

const crypto = require('crypto');

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function sha256Text(text) {
  return 'sha256:' + crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}
function lastUserText(messages) {
  for (let i = (messages || []).length - 1; i >= 0; i--) {
    const m = messages[i] || {};
    if (m.role === 'user') return String(m.content ?? '');
  }
  return null;
}
function sourcePath(x) { return x?.source?.path || x?.source_file || null; }

function extractItemCoreText(presentationText) {
  if (presentationText === null || presentationText === undefined) return null;
  const text = String(presentationText);
  const start = text.lastIndexOf('“');
  if (start < 0) return null;
  const end = text.indexOf('”', start + 1);
  if (end <= start) return null;
  const core = text.slice(start + 1, end).trim();
  return core || null;
}

function identityFields(promptText) {
  const presentationText = promptText === null ? null : String(promptText);
  const presentationHash = presentationText === null ? null : sha256Text(presentationText);
  const itemCoreText = extractItemCoreText(presentationText);
  const itemCoreHash = itemCoreText === null ? null : sha256Text(itemCoreText);
  return { presentationText, presentationHash, itemCoreText, itemCoreHash };
}

function normalizeRawObservation(observation, collection, instrument = null) {
  const promptText = lastUserText(observation.modelVisibleMessages);
  const canonicalItemId = String(observation.probeId ?? observation.questionId ?? 'unknown');
  return {
    indexSchema: 'blum-dae-observation-index-row-v1',
    observationId: observation.observationId || sha256Text(`${collection}|${sourcePath(observation)}|${canonicalItemId}`),
    collection,
    provenanceClass: 'raw_call_record',
    canonicalItemId,
    ...identityFields(promptText),
    instrument: instrument || null,
    condition: observation.family || observation.trunkKey || null,
    family: observation.family || null,
    replicate: observation.replicate ?? null,
    trunkKey: observation.trunkKey || null,
    ancestryType: observation.ancestryType || null,
    forkId: observation.forkId || null,
    parentSnapshotId: observation.parentSnapshotId || null,
    parentVerificationStatus: observation.parentVerificationStatus || null,
    rawOutput: String(observation.rawOutput ?? ''),
    sections: clone(observation.xml?.sections || {}),
    sectionIntegrity: clone(observation.xml?.sectionIntegrity || {}),
    callOutcome: observation.callOutcome || null,
    stopReason: observation.stopReason || null,
    sourcePath: sourcePath(observation),
    modelVisibleMessages: clone(observation.modelVisibleMessages || []),
  };
}

function normalizePilot1Record(record, options = {}) {
  if (!record || !Array.isArray(record.cells)) throw new Error('pilot1_record_cells_required');
  const collection = options.collection || 'pilot1';
  const instrument = options.instrument || 'record.json:design';
  const rows = [];
  for (const cell of record.cells) {
    const base = {
      collection,
      provenanceClass: 'reconstructed_from_jsonl',
      instrument,
      condition: cell.cell || null,
      family: cell.cell || null,
      replicate: cell.replicate ?? null,
      trunkKey: cell.trunk_id || null,
      sourcePath: cell.source_file || cell.trunk_id || null,
    };
    for (const turn of (cell.turns || [])) {
      if (!turn.is_battery_item) continue;
      const promptText = String(turn.sent ?? '');
      const item = String(turn.question_id ?? 'unknown');
      rows.push({
        indexSchema: 'blum-dae-observation-index-row-v1',
        observationId: sha256Text(`${collection}|${base.trunkKey}|turn|${turn.n}|${item}`),
        ...base,
        canonicalItemId: item,
        ...identityFields(promptText),
        ancestryType: 'pilot1_lived_trunk',
        forkId: null,
        parentSnapshotId: null,
        parentVerificationStatus: 'pilot1_reconstruction_no_raw2_prefix_hash',
        rawOutput: String(turn.raw_response ?? ''),
        sections: clone(turn.sections || {}),
        sectionIntegrity: {},
        callOutcome: (turn.anomalies || []).some(a => a.type === 'empty_response') ? 'empty' : 'complete',
        stopReason: null,
        sourcePath: turn.source_file || base.sourcePath,
        modelVisibleMessages: [{ role: 'user', content: promptText }],
        anomalies: clone(turn.anomalies || []),
      });
    }
    for (const branch of (cell.branches || [])) {
      const promptText = String(branch.sent ?? '');
      const item = String(branch.item ?? 'unknown');
      const isCold = cell.kind === 'cold';
      rows.push({
        indexSchema: 'blum-dae-observation-index-row-v1',
        observationId: sha256Text(`${collection}|${base.trunkKey}|branch|${item}|${branch.branch || '-'}|${base.replicate}`),
        ...base,
        canonicalItemId: item,
        ...identityFields(promptText),
        ancestryType: isCold ? 'cold_no_lived_parent' : 'pilot1_lived_trunk_branch',
        forkId: isCold ? 'cold' : (branch.branch || null),
        parentSnapshotId: null,
        parentVerificationStatus: isCold ? 'cold_no_lived_parent' : 'pilot1_declared_parent_only',
        rawOutput: String(branch.raw_response ?? ''),
        sections: clone(branch.sections || {}),
        sectionIntegrity: {},
        callOutcome: (branch.anomalies || []).some(a => a.type === 'empty_response') ? 'empty' : 'complete',
        stopReason: null,
        sourcePath: branch.source_file || base.sourcePath,
        modelVisibleMessages: [{ role: 'user', content: promptText }],
        rating: clone(branch.rating || null),
        anomalies: clone(branch.anomalies || []),
      });
    }
  }
  return rows;
}

function variantsBy(rows, hashField, textField) {
  const byHash = new Map();
  for (const row of rows) {
    const key = row[hashField] || '<missing>';
    if (!byHash.has(key)) byHash.set(key, { hash: row[hashField] || null, text: row[textField] ?? null, count: 0, collections: new Set(), instruments: new Set() });
    const v = byHash.get(key);
    v.count += 1;
    v.collections.add(row.collection);
    if (row.instrument) v.instruments.add(row.instrument);
  }
  return [...byHash.values()].map(v => ({ ...v, collections: [...v.collections].sort(), instruments: [...v.instruments].sort() }))
    .sort((a, b) => b.count - a.count || String(a.hash).localeCompare(String(b.hash)));
}

function buildItemHistories(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = row.canonicalItemId || 'unknown';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  const histories = {};
  for (const [id, itemRows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const presentationVariants = variantsBy(itemRows, 'presentationHash', 'presentationText');
    const itemCoreVariants = variantsBy(itemRows, 'itemCoreHash', 'itemCoreText');
    histories[id] = {
      canonicalItemId: id,
      observationCount: itemRows.length,
      presentationVariantCount: presentationVariants.length,
      presentationVariants,
      itemCoreVariantCount: itemCoreVariants.length,
      itemCoreVariants,
      collections: [...new Set(itemRows.map(r => r.collection))].sort(),
      observations: itemRows.slice().sort((a, b) => String(a.collection).localeCompare(String(b.collection)) || String(a.condition).localeCompare(String(b.condition)) || Number(a.replicate || 0) - Number(b.replicate || 0) || String(a.forkId).localeCompare(String(b.forkId))),
    };
  }
  return histories;
}

function buildUnifiedIndex({ pilot1Record = null, collections = [] } = {}) {
  const rows = [];
  if (pilot1Record) rows.push(...normalizePilot1Record(pilot1Record));
  for (const entry of collections) {
    if (!entry?.dataset) continue;
    const name = entry.name || entry.collection || 'unknown';
    const instrument = entry.instrument || null;
    for (const obs of (entry.dataset.observations || [])) rows.push(normalizeRawObservation(obs, name, instrument));
  }
  const itemHistories = buildItemHistories(rows);
  return {
    schema: 'blum-dae-unified-observation-index-v1',
    identitySemantics: {
      canonicalItemId: 'historical item label',
      itemCoreHash: 'SHA-256 of deterministically extracted quoted battery question text when available',
      presentationHash: 'SHA-256 of complete final model-visible user presentation including intervention/framing',
    },
    generatedAt: new Date().toISOString(),
    observationCount: rows.length,
    itemCount: Object.keys(itemHistories).length,
    collections: [...new Set(rows.map(r => r.collection))].sort(),
    observations: rows,
    itemHistories,
  };
}

function selectItem(index, canonicalItemId, mode = 'canonical', identityHash = null) {
  const history = index?.itemHistories?.[canonicalItemId];
  if (!history) return { canonicalItemId, mode, observations: [] };
  let observations = history.observations;
  if (mode === 'exact_presentation') {
    if (!identityHash) throw new Error('presentation_hash_required');
    observations = observations.filter(x => x.presentationHash === identityHash);
  } else if (mode === 'exact_item_text') {
    if (!identityHash) throw new Error('item_core_hash_required');
    observations = observations.filter(x => x.itemCoreHash === identityHash);
  } else if (mode !== 'canonical') throw new Error(`unsupported_item_history_mode:${mode}`);
  return { canonicalItemId, mode, identityHash: identityHash || null, observationCount: observations.length, observations };
}

module.exports = { sha256Text, lastUserText, extractItemCoreText, identityFields, normalizeRawObservation, normalizePilot1Record, variantsBy, buildItemHistories, buildUnifiedIndex, selectItem };
