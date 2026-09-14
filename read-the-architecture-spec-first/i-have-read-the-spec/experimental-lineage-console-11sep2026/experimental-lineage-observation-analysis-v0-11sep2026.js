'use strict';

// BLUM EXPERIMENTAL LINEAGE OBSERVATION ANALYSIS v0
// 11 Sep 2026
//
// Analysis boundary shared by prospective runner observations and retrospective
// imported observations. It does not execute models and does not alter witnesses.

(function expose(factory) {
  let core = null;
  if (typeof module !== 'undefined' && module.exports) {
    core = require('./experimental-lineage-runner-core-v0-11sep2026.js');
    module.exports = factory(core);
  }
  if (typeof window !== 'undefined') {
    window.BlumLineageObservationAnalysis = factory(window.BlumLineageRunner);
  }
})(function buildApi(core) {
  if (!core) throw new Error('BlumLineageRunner_core_required');

  function active(items) { return (items || []).filter(x => x && x.enabled !== false); }

  async function projectAndEmbedObservations({ observations, analysisStreams, embedText = null, embeddingMetadata = {} }) {
    const projections = [];
    const embeddings = [];

    for (const observation of observations || []) {
      for (const stream of active(analysisStreams || [])) {
        const projection = core.projectObservation(observation, stream);
        projections.push(projection);
        if (projection.status !== 'ok' || typeof embedText !== 'function') continue;

        const result = await embedText({
          text: projection.selectedText,
          observationId: observation.observationId,
          analysisStreamId: stream.id,
          metadata: { ...embeddingMetadata },
        });
        const vector = Array.isArray(result) || ArrayBuffer.isView(result)
          ? Array.from(result)
          : Array.from(result?.vector || []);
        if (!vector.length) throw new Error('embedder_returned_empty_vector');

        const providerMeta = (result && !Array.isArray(result) && !ArrayBuffer.isView(result)) ? (result.meta || {}) : {};
        embeddings.push({
          embeddingId: core.deterministicId('emb', {
            projectionId: projection.projectionId,
            provider: providerMeta.provider || embeddingMetadata.provider || null,
            model: providerMeta.model || embeddingMetadata.model || null,
            vector,
          }),
          projectionId: projection.projectionId,
          observationId: observation.observationId,
          analysisStreamId: stream.id,
          vector,
          provider: providerMeta.provider || embeddingMetadata.provider || null,
          model: providerMeta.model || embeddingMetadata.model || null,
          version: providerMeta.version || embeddingMetadata.version || null,
        });
      }
    }
    return { projections, embeddings };
  }

  async function analyzeObservations({ observations, analysisStreams, embedText = null, embeddingMetadata = {} }) {
    const witnesses = observations || [];
    const siblingPairs = core.buildSiblingPairs(witnesses);
    const { projections, embeddings } = await projectAndEmbedObservations({
      observations: witnesses,
      analysisStreams,
      embedText,
      embeddingMetadata,
    });
    const siblingDivergence = embedText
      ? core.measureSiblingDivergence({ siblingPairs, embeddings })
      : [];

    return {
      observationCount: witnesses.length,
      siblingPairs,
      projections,
      embeddings,
      metrics: { siblingDivergence },
    };
  }

  return { projectAndEmbedObservations, analyzeObservations };
});
