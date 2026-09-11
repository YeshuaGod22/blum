'use strict';

// DAE UNIFIED OBSERVATION INDEX v0 — 11 Sep 2026
// Joins Pilot 1's validated record.json derivation with pilot-2-onward
// retrospective lineage datasets without flattening their provenance differences.

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

function normalizeRawObservation(observation, collection, instrument = null) {
  const promptText = lastUserText(observation.modelVisibleMessages);
  const canonicalItemId = String(observation.probeId ?? observation.questionId ?? 'unknown');
  return {
    indexSchema: 'blum-dae-observation-index-row-v0',
    observationId: observation.observationId || sha256Text(`${collection}|${sourcePath(observation)}|${canonicalItemId}`),
    collection,
    provenanceClass: 'raw_call_record',
    canonicalItemId,
    exactPromptText: promptText,
    exactPromptHash: promptText === null ? null : sha256Text(promptText),
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

    // Pilot 1 trunk turns are developmental questions, not battery observations,
    // unless the validated ingest explicitly marks one as a battery item.
    for (const turn of (cell.turns || [])) {
      if (!turn.is_battery_item) continue;
      const promptText = String(turn.sent ?? '');
      const item = String(turn.question_id ?? 'unknown');
      rows.push({
        indexSchema: 'blum-dae-observation-index-row-v0',
        observationId: sha256Text(`${collection}|${base.trunkKey}|turn|${turn.n}|${item}`),
        ...base,
        canonicalItemId: item,
        exactPromptText: promptText,
        exactPromptHash: sha256Text(promptText),
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
        indexSchema: 'blum-dae-observation-index-row-v0',
        observationId: sha256Text(`${collection}|${base.trunkKey}|branch|${item}|${branch.branch || '-'}|${base.replicate}`),
        ...base,
        canonicalItemId: item,
        exactPromptText: promptText,
        exactPromptHash: sha256Text(promptText),
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

function promptVariants(rows) {
  const byHash = new Map();
  for (const row of rows) {
    const hash = row.exactPromptHash || '<missing>';
    if (!byHash.has(hash)) byHash.set(hash, {
      exactPromptHash: row.exactPromptHash,
      exactPromptText: row.exactPromptText,
      count: 0,
      collections: new Set(),
      instruments: new Set(),
    });
    const v = byHash.get(hash);
    v.count += 1;
    v.collections.add(row.collection);
    if (row.instrument) v.instruments.add(row.instrument);
  }
  return [...byHash.values()].map(v => ({
    ...v,
    collections: [...v.collections].sort(),
    instruments: [...v.instruments].sort(),
  })).sort((a, b) => b.count - a.count || String(a.exactPromptHash).localeCompare(String(b.exactPromptHash)));
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
    const variants = promptVariants(itemRows);
    histories[id] = {
      canonicalItemId: id,
      observationCount: itemRows.length,
      promptVariantCount: variants.length,
      promptVariants: variants,
      collections: [...new Set(itemRows.map(r => r.collection))].sort(),
      observations: itemRows
        .slice()
        .sort((a, b) => String(a.collection).localeCompare(String(b.collection)) ||
          String(a.condition).localeCompare(String(b.condition)) ||
          Number(a.replicate || 0) - Number(b.replicate || 0) ||
          String(a.forkId).localeCompare(String(b.forkId))),
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
    for (const obs of (entry.dataset.observations || [])) {
      rows.push(normalizeRawObservation(obs, name, instrument));
    }
  }
  const itemHistories = buildItemHistories(rows);
  return {
    schema: 'blum-dae-unified-observation-index-v0',
    generatedAt: new Date().toISOString(),
    observationCount: rows.length,
    itemCount: Object.keys(itemHistories).length,
    collections: [...new Set(rows.map(r => r.collection))].sort(),
    observations: rows,
    itemHistories,
  };
}

function selectItem(index, canonicalItemId, mode = 'canonical', exactPromptHash = null) {
  const history = index?.itemHistories?.[canonicalItemId];
  if (!history) return { canonicalItemId, mode, observations: [], promptVariants: [] };
  let observations = history.observations;
  if (mode === 'exact_text') {
    if (!exactPromptHash) throw new Error('exact_prompt_hash_required');
    observations = observations.filter(x => x.exactPromptHash === exactPromptHash);
  } else if (mode !== 'canonical') {
    throw new Error(`unsupported_item_history_mode:${mode}`);
  }
  return {
    canonicalItemId,
    mode,
    exactPromptHash: exactPromptHash || null,
    observationCount: observations.length,
    promptVariants: promptVariants(observations),
    observations,
  };
}

module.exports = {
  sha256Text,
  lastUserText,
  normalizeRawObservation,
  normalizePilot1Record,
  promptVariants,
  buildItemHistories,
  buildUnifiedIndex,
  selectItem,
};
