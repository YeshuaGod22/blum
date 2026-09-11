'use strict';

// BLUM EXPERIMENTAL LINEAGE RUNNER CORE v0
// 11 Sep 2026
//
// Pure orchestration over a frozen lineage manifest.
// No provider credentials. No room logic. No persistent global state.
// A caller injects callModel(); this module preserves lineage, provenance,
// raw output, XML projections, and exact-shared-parent semantics.

(function expose(factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.BlumLineageRunner = api;
})(function buildApi() {
  let nodeCrypto = null;
  try { nodeCrypto = require('crypto'); } catch (_) {}

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }

  function hashHexSync(value) {
    const text = typeof value === 'string' ? value : stableStringify(value);
    if (nodeCrypto) return nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex');
    // Browser fallback for deterministic IDs in synchronous code. Not cryptographic.
    // Frozen manifest verification in the UI should continue using SubtleCrypto.
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    return h1.toString(16).padStart(8, '0').repeat(8);
  }

  function deterministicId(prefix, material) {
    return `${prefix}_${hashHexSync(material).slice(0, 16)}`;
  }

  function nowIso(clock) {
    return (clock ? clock() : new Date()).toISOString();
  }

  function assertFrozenManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') throw new Error('manifest_required');
    if (!manifest.frozen) throw new Error('manifest_not_frozen');
    if (!manifest.fingerprint) throw new Error('manifest_fingerprint_missing');
    if (!Array.isArray(manifest.trunks)) throw new Error('manifest_trunks_missing');
    if (!Array.isArray(manifest.forks)) throw new Error('manifest_forks_missing');
    if (!Array.isArray(manifest.battery)) throw new Error('manifest_battery_missing');
    return true;
  }

  function normalizeModelResponse(result) {
    if (typeof result === 'string') return { text: result, stopReason: 'end_turn', meta: {} };
    if (!result || typeof result !== 'object') throw new Error('model_response_invalid');
    return {
      text: String(result.text ?? ''),
      stopReason: String(result.stopReason ?? 'end_turn'),
      meta: clone(result.meta || {}),
    };
  }

  function classifyOutcome(response, thrownError) {
    if (thrownError) return 'api_failure';
    const stop = String(response?.stopReason || '').toLowerCase();
    if (stop.includes('max_token') || stop.includes('length')) return 'truncated';
    if (stop.includes('context')) return 'context_limit';
    return 'complete';
  }

  function extractXmlSections(rawText) {
    const raw = String(rawText ?? '');
    const sections = {};
    const presentTags = [];

    // Intentionally accepts ordinary XML-like tag names, attributes on opening tags,
    // and repeated blocks. It does not attempt to repair malformed nesting.
    const re = /<([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
    let match;
    while ((match = re.exec(raw)) !== null) {
      const tag = match[1];
      if (!sections[tag]) {
        sections[tag] = [];
        presentTags.push(tag);
      }
      sections[tag].push(match[2]);
    }

    return { presentTags, sections };
  }

  function normalizeTagList(tags) {
    if (Array.isArray(tags)) return tags.map(x => String(x).trim()).filter(Boolean);
    return String(tags || '').split(',').map(x => x.trim()).filter(Boolean);
  }

  function projectObservation(observation, stream) {
    if (!observation) throw new Error('observation_required');
    if (!stream) throw new Error('analysis_stream_required');

    const projectionBase = {
      projectionId: deterministicId('proj', {
        observationId: observation.observationId,
        streamId: stream.id,
        mode: stream.mode,
        tags: stream.tags,
        missingPolicy: stream.missingPolicy,
      }),
      observationId: observation.observationId,
      analysisStreamId: stream.id,
      extractorVersion: 'xml-selector-v1',
      status: 'ok',
      selectedText: '',
      selectedTags: [],
      missingTags: [],
    };

    if (stream.mode === 'whole') {
      projectionBase.selectedText = observation.rawOutput;
      projectionBase.selectedTags = ['__whole_output__'];
      return projectionBase;
    }

    const tags = normalizeTagList(stream.tags);
    const chunks = [];
    for (const tag of tags) {
      const values = observation.xml?.sections?.[tag] || [];
      if (!values.length) {
        projectionBase.missingTags.push(tag);
        continue;
      }
      projectionBase.selectedTags.push(tag);
      // Preserve repeated blocks in source order.
      chunks.push(values.join('\n'));
    }

    if (projectionBase.missingTags.length) {
      const policy = stream.missingPolicy || 'NA';
      if (policy === 'fail-run') {
        projectionBase.status = 'failed_missing_tag';
        projectionBase.selectedText = null;
        return projectionBase;
      }
      if (policy === 'record-empty') {
        projectionBase.status = 'missing_recorded_empty';
        projectionBase.selectedText = chunks.join('\n');
        return projectionBase;
      }
      if (policy === 'exclude-turn') {
        projectionBase.status = 'excluded_missing_tag';
        projectionBase.selectedText = null;
        return projectionBase;
      }
      projectionBase.status = 'missing';
      projectionBase.selectedText = null;
      return projectionBase;
    }

    projectionBase.selectedText = chunks.join('\n');
    return projectionBase;
  }

  function cosineDistance(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
      throw new Error('embedding_shape_mismatch');
    }
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      aa += a[i] * a[i];
      bb += b[i] * b[i];
    }
    if (!aa || !bb) throw new Error('zero_norm_embedding');
    return 1 - dot / (Math.sqrt(aa) * Math.sqrt(bb));
  }

  async function callWithLedger({ callModel, messages, modelConfig, metadata, ledger, clock, maxAttempts = 1 }) {
    if (typeof callModel !== 'function') throw new Error('callModel_required');
    let last = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const executionId = deterministicId('exec', { ...metadata, attempt });
      const entry = {
        executionId,
        manifestFingerprint: metadata.manifestFingerprint,
        trunkInstanceId: metadata.trunkInstanceId || null,
        parentSnapshotId: metadata.parentSnapshotId || null,
        forkId: metadata.forkId || null,
        probeId: metadata.probeId || null,
        phase: metadata.phase,
        turnId: metadata.turnId || null,
        attempt,
        startedAt: nowIso(clock),
        completedAt: null,
        stopReason: null,
        outcome: null,
        error: null,
      };
      ledger.push(entry);

      try {
        const response = normalizeModelResponse(await callModel({
          messages: clone(messages),
          modelConfig: clone(modelConfig || {}),
          metadata: clone({ ...metadata, executionId, attempt }),
        }));
        entry.completedAt = nowIso(clock);
        entry.stopReason = response.stopReason;
        entry.outcome = classifyOutcome(response, null);
        last = { response, entry };
        if (entry.outcome === 'complete') return last;
      } catch (error) {
        entry.completedAt = nowIso(clock);
        entry.outcome = classifyOutcome(null, error);
        entry.error = String(error?.message || error);
        last = { response: null, entry, error };
      }
    }

    return last;
  }

  function active(items) {
    return (items || []).filter(x => x && x.enabled !== false);
  }

  function probeById(manifest, id) {
    return (manifest.battery || []).find(x => x.id === id) || null;
  }

  function makeObservation({ manifest, trunkInstanceId, parentSnapshotId, fork, probe, execution, clock }) {
    const rawOutput = execution?.response?.text || '';
    const xml = extractXmlSections(rawOutput);
    const observationId = deterministicId('obs', {
      manifestFingerprint: manifest.fingerprint,
      trunkInstanceId,
      parentSnapshotId,
      forkId: fork.id,
      probeId: probe.id,
      executionId: execution.entry.executionId,
    });
    return {
      observationId,
      executionId: execution.entry.executionId,
      manifestFingerprint: manifest.fingerprint,
      trunkInstanceId,
      parentSnapshotId,
      forkId: fork.id,
      probeId: probe.id,
      createdAt: nowIso(clock),
      rawOutput,
      stopReason: execution.entry.stopReason,
      outcome: execution.entry.outcome,
      xml: {
        presentTags: xml.presentTags,
        missingTags: [],
        sections: xml.sections,
      },
    };
  }

  function makeSnapshot({ manifest, trunkInstanceId, messages, modelConfig, clock }) {
    const contentHash = 'sha256:' + hashHexSync({ messages, modelConfig });
    return {
      parentSnapshotId: deterministicId('snap', {
        manifestFingerprint: manifest.fingerprint,
        trunkInstanceId,
        contentHash,
      }),
      trunkInstanceId,
      manifestFingerprint: manifest.fingerprint,
      messages: clone(messages),
      modelConfig: clone(modelConfig || {}),
      createdAt: nowIso(clock),
      contentHash,
    };
  }

  async function buildTrunkInstance({ manifest, trunk, replicateIndex, callModel, ledger, clock, maxAttempts, modelConfig }) {
    const trunkInstanceId = deterministicId('trunk', {
      manifestFingerprint: manifest.fingerprint,
      trunkId: trunk.id,
      replicateIndex,
    });
    const messages = [];
    const turnResults = [];

    for (const turn of active(trunk.turns)) {
      messages.push({ role: 'user', content: String(turn.text || '') });
      const execution = await callWithLedger({
        callModel,
        messages,
        modelConfig,
        ledger,
        clock,
        maxAttempts,
        metadata: {
          manifestFingerprint: manifest.fingerprint,
          trunkInstanceId,
          phase: 'trunk',
          turnId: turn.id,
        },
      });
      turnResults.push({ turnId: turn.id, executionId: execution.entry.executionId, outcome: execution.entry.outcome });
      if (!execution.response || execution.entry.outcome !== 'complete') break;
      messages.push({ role: 'assistant', content: execution.response.text });
    }

    const snapshot = makeSnapshot({ manifest, trunkInstanceId, messages, modelConfig, clock });
    return { trunkInstanceId, turnResults, snapshot };
  }

  function branchMessagesFromSnapshot(snapshot, fork) {
    const messages = clone(snapshot?.messages || []);
    if (String(fork.intervention || '').trim()) {
      messages.push({ role: 'user', content: String(fork.intervention).trim(), _experimentalRole: 'fork_intervention' });
    }
    return messages;
  }

  async function runForkProbe({ manifest, trunkInstanceId, snapshot, fork, probe, callModel, ledger, observations, clock, maxAttempts, modelConfig }) {
    const parentSnapshotId = snapshot?.parentSnapshotId || null;
    const messages = fork.trunkLived === false ? [] : branchMessagesFromSnapshot(snapshot, fork);
    if (fork.trunkLived === false && String(fork.intervention || '').trim()) {
      messages.push({ role: 'user', content: String(fork.intervention).trim(), _experimentalRole: 'cold_intervention' });
    }
    messages.push({ role: 'user', content: String(probe.text || ''), _experimentalRole: 'probe', probeId: probe.id });

    const execution = await callWithLedger({
      callModel,
      messages,
      modelConfig,
      ledger,
      clock,
      maxAttempts,
      metadata: {
        manifestFingerprint: manifest.fingerprint,
        trunkInstanceId,
        parentSnapshotId,
        forkId: fork.id,
        probeId: probe.id,
        phase: 'probe',
      },
    });

    if (!execution.response) return null;
    const observation = makeObservation({ manifest, trunkInstanceId, parentSnapshotId, fork, probe, execution, clock });
    observations.push(observation);
    return observation;
  }

  function buildSiblingPairs(observations) {
    const groups = new Map();
    for (const obs of observations) {
      if (!obs.parentSnapshotId) continue;
      const key = `${obs.parentSnapshotId}::${obs.probeId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(obs);
    }
    const pairs = [];
    for (const [key, group] of groups.entries()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].forkId === group[j].forkId) continue;
          pairs.push({
            pairId: deterministicId('pair', { key, a: group[i].observationId, b: group[j].observationId }),
            parentSnapshotId: group[i].parentSnapshotId,
            probeId: group[i].probeId,
            leftObservationId: group[i].observationId,
            leftForkId: group[i].forkId,
            rightObservationId: group[j].observationId,
            rightForkId: group[j].forkId,
            contrastType: 'exact_shared_parent',
          });
        }
      }
    }
    return pairs;
  }

  async function projectAndEmbed({ observations, analysisStreams, embedText }) {
    const projections = [];
    const embeddings = [];
    for (const observation of observations) {
      for (const stream of active(analysisStreams || [])) {
        const projection = projectObservation(observation, stream);
        projections.push(projection);
        if (projection.status !== 'ok' || typeof embedText !== 'function') continue;
        const vector = await embedText({
          text: projection.selectedText,
          observationId: observation.observationId,
          analysisStreamId: stream.id,
        });
        embeddings.push({
          embeddingId: deterministicId('emb', { projectionId: projection.projectionId, vector }),
          projectionId: projection.projectionId,
          observationId: observation.observationId,
          analysisStreamId: stream.id,
          vector: Array.from(vector),
        });
      }
    }
    return { projections, embeddings };
  }

  function measureSiblingDivergence({ siblingPairs, embeddings }) {
    const byObservationStream = new Map();
    for (const emb of embeddings || []) {
      byObservationStream.set(`${emb.observationId}::${emb.analysisStreamId}`, emb);
    }
    const results = [];
    for (const pair of siblingPairs || []) {
      const streams = new Set((embeddings || []).filter(e => e.observationId === pair.leftObservationId).map(e => e.analysisStreamId));
      for (const streamId of streams) {
        const left = byObservationStream.get(`${pair.leftObservationId}::${streamId}`);
        const right = byObservationStream.get(`${pair.rightObservationId}::${streamId}`);
        if (!left || !right) continue;
        results.push({
          metricId: deterministicId('metric', { pairId: pair.pairId, streamId, metric: 'sibling_cosine_distance' }),
          metric: 'sibling_cosine_distance',
          pairId: pair.pairId,
          parentSnapshotId: pair.parentSnapshotId,
          probeId: pair.probeId,
          analysisStreamId: streamId,
          leftForkId: pair.leftForkId,
          rightForkId: pair.rightForkId,
          value: cosineDistance(left.vector, right.vector),
        });
      }
    }
    return results;
  }

  async function runLineage({ manifest, callModel, embedText = null, clock = null, maxAttempts = 1, modelConfig = null }) {
    assertFrozenManifest(manifest);
    const ledger = [];
    const observations = [];
    const snapshots = [];
    const trunkInstances = [];
    const resolvedModelConfig = modelConfig || {
      provider: manifest.experiment?.provider || '',
      model: manifest.experiment?.model || '',
    };

    for (const trunk of active(manifest.trunks)) {
      const reps = Math.max(1, Number(trunk.replicates || 1));
      for (let replicateIndex = 1; replicateIndex <= reps; replicateIndex++) {
        const built = await buildTrunkInstance({
          manifest, trunk, replicateIndex, callModel, ledger, clock, maxAttempts, modelConfig: resolvedModelConfig,
        });
        snapshots.push(built.snapshot);
        trunkInstances.push({
          trunkInstanceId: built.trunkInstanceId,
          trunkId: trunk.id,
          replicateIndex,
          parentSnapshotId: built.snapshot.parentSnapshotId,
          turnResults: built.turnResults,
        });

        for (const fork of active(manifest.forks).filter(f => f.trunkLived !== false)) {
          for (const probeId of fork.batteryIds || []) {
            const probe = probeById(manifest, probeId);
            if (!probe || probe.enabled === false) continue;
            await runForkProbe({
              manifest,
              trunkInstanceId: built.trunkInstanceId,
              snapshot: built.snapshot,
              fork,
              probe,
              callModel,
              ledger,
              observations,
              clock,
              maxAttempts,
              modelConfig: resolvedModelConfig,
            });
          }
        }
      }
    }

    // Cold controls have no lived parent and are executed independently.
    for (const fork of active(manifest.forks).filter(f => f.trunkLived === false)) {
      const reps = Math.max(1, Number(fork.replicates || 1));
      for (let replicateIndex = 1; replicateIndex <= reps; replicateIndex++) {
        const coldTrunkInstanceId = deterministicId('cold', {
          manifestFingerprint: manifest.fingerprint,
          forkId: fork.id,
          replicateIndex,
        });
        for (const probeId of fork.batteryIds || []) {
          const probe = probeById(manifest, probeId);
          if (!probe || probe.enabled === false) continue;
          await runForkProbe({
            manifest,
            trunkInstanceId: coldTrunkInstanceId,
            snapshot: null,
            fork,
            probe,
            callModel,
            ledger,
            observations,
            clock,
            maxAttempts,
            modelConfig: resolvedModelConfig,
          });
        }
      }
    }

    const siblingPairs = buildSiblingPairs(observations);
    const { projections, embeddings } = await projectAndEmbed({
      observations,
      analysisStreams: manifest.analysisStreams,
      embedText,
    });
    const siblingDivergence = embedText ? measureSiblingDivergence({ siblingPairs, embeddings }) : [];

    return {
      manifestFingerprint: manifest.fingerprint,
      trunkInstances,
      parentSnapshots: snapshots,
      executionLedger: ledger,
      observations,
      siblingPairs,
      projections,
      embeddings,
      metrics: { siblingDivergence },
    };
  }

  return {
    stableStringify,
    hashHexSync,
    deterministicId,
    assertFrozenManifest,
    extractXmlSections,
    projectObservation,
    cosineDistance,
    buildSiblingPairs,
    measureSiblingDivergence,
    runLineage,
  };
});
