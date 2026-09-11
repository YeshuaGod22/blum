'use strict';

// DAE RAW-CALL → BLUM LINEAGE IMPORT ADAPTER v0
// 11 Sep 2026
//
// Retrospective import only. It does not execute experiments.
// It preserves the DAE raw record as source evidence, derives parent snapshots
// from the exact model-visible prefix in `sent`, and keeps call outcome separate
// from XML section presence / closure integrity.

(function expose(factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.DaeRawCallLineageImport = api;
})(function buildApi() {
  let nodeCrypto = null;
  try { nodeCrypto = require('crypto'); } catch (_) {}

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }

  function hashHex(value) {
    const text = typeof value === 'string' ? value : stableStringify(value);
    if (nodeCrypto) return nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex');
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0').repeat(8);
  }

  function id(prefix, material) { return `${prefix}_${hashHex(material).slice(0, 16)}`; }

  function normalizeMessages(sent) {
    if (!Array.isArray(sent)) throw new Error('dae_sent_must_be_array');
    return sent.map((m, i) => {
      if (!m || typeof m !== 'object') throw new Error(`dae_sent_message_invalid_${i}`);
      return { role: String(m.role || ''), content: String(m.content ?? '') };
    });
  }

  function classifyCallOutcome(record) {
    if (record?.error) return 'api_failure';
    const stop = String(record?.stop_reason || '').toLowerCase();
    if (stop === 'max_tokens' || stop.includes('max_token') || stop.includes('length')) return 'truncated';
    if (stop.includes('context')) return 'context_limit';
    if (stop === 'end_turn' || !stop) return 'complete';
    return `other:${stop}`;
  }

  const DEFAULT_TAGS = ['priming','meditation','examination','debate','deliberation','reply','reflection','answer','revision'];

  function inspectXmlIntegrity(rawText, tags = DEFAULT_TAGS) {
    const raw = String(rawText ?? '');
    const sections = {};
    const presentTags = [];
    const cleanlyClosedTags = [];
    const unclosedTags = [];

    for (const tag of tags) {
      const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'ig');
      const closeRe = new RegExp(`</${tag}\\s*>`, 'ig');
      const pairRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'ig');
      const opens = [...raw.matchAll(openRe)];
      const closes = [...raw.matchAll(closeRe)];
      const values = [...raw.matchAll(pairRe)].map(m => m[1]);

      if (opens.length) presentTags.push(tag);
      if (values.length) {
        sections[tag] = values;
        cleanlyClosedTags.push(tag);
      }
      if (opens.length > closes.length) unclosedTags.push(tag);

      // Positional recovery: if an opening tag exists but no clean pair, retain
      // text until the next recognized opening tag / end of output as a recovery
      // section. This is explicitly marked recovered, never presented as clean XML.
      if (opens.length && !values.length) {
        const start = opens[0].index + opens[0][0].length;
        let end = raw.length;
        for (const other of tags) {
          if (other === tag) continue;
          const re = new RegExp(`<${other}(?:\\s[^>]*)?>`, 'ig');
          re.lastIndex = start;
          const m = re.exec(raw);
          if (m && m.index < end) end = m.index;
        }
        sections[tag] = [raw.slice(start, end)];
      }
    }

    const sectionIntegrity = {};
    for (const tag of presentTags) {
      sectionIntegrity[tag] = unclosedTags.includes(tag) ? 'recovered_unclosed' : 'clean';
    }

    return { presentTags, cleanlyClosedTags, unclosedTags, sectionIntegrity, sections };
  }

  function sourceDescriptor(record, source = {}) {
    return {
      repository: source.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: source.commit || null,
      path: source.path || null,
      blobSha: source.blobSha || null,
      originalCell: record.cell ?? null,
      originalReplicate: record.replicate ?? null,
      originalKind: record.kind ?? null,
      originalBranch: record.branch ?? null,
      originalItem: record.item ?? record.question_id ?? null,
      collectedVia: record.collected_via ?? null,
      authMode: record.auth_mode ?? null,
      servedModel: record.served_model ?? null,
      timestamp: record.ts ?? null,
    };
  }

  function deriveParentPrefix(record) {
    const sent = normalizeMessages(record.sent || []);
    if (record.kind !== 'branch') return null;
    const n = Number(record.prefix_len);
    if (!Number.isInteger(n) || n < 0 || n > sent.length) {
      return { status: 'unverified', reason: 'prefix_len_missing_or_invalid', messages: null, contentHash: null };
    }
    const messages = sent.slice(0, n);
    return {
      status: 'verified_from_sent_prefix',
      messages,
      contentHash: 'sha256:' + hashHex(messages),
      declaredParentPrefix: record.parent_prefix || null,
      prefixLen: n,
    };
  }

  function makeParentSnapshot(record, source) {
    const prefix = deriveParentPrefix(record);
    if (!prefix) return null;
    if (prefix.status !== 'verified_from_sent_prefix') {
      return {
        parentSnapshotId: null,
        verificationStatus: prefix.status,
        verificationReason: prefix.reason,
        declaredParentPrefix: record.parent_prefix || null,
        prefixLen: record.prefix_len ?? null,
      };
    }
    const sourceInfo = sourceDescriptor(record, source);
    return {
      parentSnapshotId: id('snap', { contentHash: prefix.contentHash }),
      contentHash: prefix.contentHash,
      verificationStatus: prefix.status,
      declaredParentPrefix: prefix.declaredParentPrefix,
      prefixLen: prefix.prefixLen,
      messages: prefix.messages,
      source: sourceInfo,
    };
  }

  function inferTrunkKey(record) {
    const cell = String(record.cell || 'unknown');
    // Branch suffix is usually encoded in cell (e.g. ASa, ASb). Prefer the
    // declared parent-prefix stem when present; otherwise strip final branch char.
    if (record.parent_prefix) {
      return String(record.parent_prefix).replace(/\.messages\.json$/i, '');
    }
    if (record.kind === 'branch' && record.branch && cell.toLowerCase().endsWith(String(record.branch).toLowerCase())) {
      return cell.slice(0, -String(record.branch).length) + '-r' + String(record.replicate ?? '?');
    }
    return cell + '-r' + String(record.replicate ?? '?');
  }

  function importTrunkRecord(record, source = {}) {
    if (!record || record.kind !== 'trunk') throw new Error('dae_trunk_record_required');
    const sent = normalizeMessages(record.sent || []);
    const rawOutput = String(record.received ?? '');
    const xml = inspectXmlIntegrity(rawOutput);
    const trunkKey = inferTrunkKey(record);
    return {
      recordType: 'retrospective_trunk_turn',
      trunkInstanceId: id('trunk', { trunkKey }),
      trunkKey,
      family: record.cell ?? null,
      replicate: record.replicate ?? null,
      turn: record.turn ?? null,
      questionId: record.question_id ?? null,
      modelVisibleMessages: sent,
      rawOutput,
      stopReason: record.stop_reason ?? null,
      callOutcome: classifyCallOutcome(record),
      xml,
      usage: clone(record.usage || {}),
      systemPrompt: record.system_prompt ?? null,
      source: sourceDescriptor(record, source),
    };
  }

  function importBranchRecord(record, source = {}) {
    if (!record || record.kind !== 'branch') throw new Error('dae_branch_record_required');
    const sent = normalizeMessages(record.sent || []);
    const parentSnapshot = makeParentSnapshot(record, source);
    const rawOutput = String(record.received ?? '');
    const xml = inspectXmlIntegrity(rawOutput);
    const trunkKey = inferTrunkKey(record);
    const probeId = String(record.item ?? record.question_id ?? 'unknown');
    const forkId = String(record.branch ?? 'unknown');

    return {
      recordType: 'retrospective_observation',
      observationId: id('obs', {
        sourcePath: source.path || null,
        cell: record.cell,
        replicate: record.replicate,
        forkId,
        probeId,
        parentHash: parentSnapshot?.contentHash || null,
      }),
      trunkInstanceId: id('trunk', { trunkKey }),
      trunkKey,
      parentSnapshotId: parentSnapshot?.parentSnapshotId || null,
      parentVerificationStatus: parentSnapshot?.verificationStatus || 'unverified',
      declaredParentPrefix: record.parent_prefix ?? null,
      forkId,
      probeId,
      modelVisibleMessages: sent,
      rawOutput,
      stopReason: record.stop_reason ?? null,
      callOutcome: classifyCallOutcome(record),
      xml,
      usage: clone(record.usage || {}),
      systemPrompt: record.system_prompt ?? null,
      source: sourceDescriptor(record, source),
      parentSnapshot,
    };
  }

  function compareBranchParentage(left, right) {
    if (!left || !right) throw new Error('two_imported_branch_records_required');
    const l = left.parentSnapshot;
    const r = right.parentSnapshot;
    if (!l?.contentHash || !r?.contentHash) {
      return {
        contrastType: 'parent_match_unverified',
        exactSharedParent: false,
        reason: 'one_or_both_parent_prefixes_unverified',
      };
    }
    if (l.contentHash !== r.contentHash) {
      return {
        contrastType: 'cross_parent_exploratory',
        exactSharedParent: false,
        reason: 'model_visible_prefix_hash_mismatch',
        leftHash: l.contentHash,
        rightHash: r.contentHash,
      };
    }
    return {
      contrastType: 'exact_shared_parent',
      exactSharedParent: true,
      parentSnapshotId: l.parentSnapshotId,
      contentHash: l.contentHash,
      declaredPrefixAgreement: (left.declaredParentPrefix || null) === (right.declaredParentPrefix || null),
    };
  }

  function importBranchSet(recordsWithSources) {
    const imported = (recordsWithSources || []).map(x => importBranchRecord(x.record, x.source || {}));
    const groups = new Map();
    for (const obs of imported) {
      const key = `${obs.trunkKey}::${obs.probeId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(obs);
    }
    const contrasts = [];
    for (const [key, group] of groups.entries()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].forkId === group[j].forkId) continue;
          contrasts.push({
            contrastId: id('contrast', { key, a: group[i].observationId, b: group[j].observationId }),
            trunkKey: group[i].trunkKey,
            probeId: group[i].probeId,
            leftObservationId: group[i].observationId,
            leftForkId: group[i].forkId,
            rightObservationId: group[j].observationId,
            rightForkId: group[j].forkId,
            ...compareBranchParentage(group[i], group[j]),
          });
        }
      }
    }
    return { observations: imported, contrasts };
  }

  return {
    stableStringify,
    hashHex,
    classifyCallOutcome,
    inspectXmlIntegrity,
    deriveParentPrefix,
    makeParentSnapshot,
    importTrunkRecord,
    importBranchRecord,
    compareBranchParentage,
    importBranchSet,
  };
});
