'use strict';

// BLUM CORPUS VISUALIZATION MODEL v0 — 11 Sep 2026
// Converts imported lineage datasets into UI-ready summaries without losing ancestry.

function inc(obj, key, by = 1) {
  const k = key == null || key === '' ? '<missing>' : String(key);
  obj[k] = (obj[k] || 0) + by;
}

function sourceBase(record) {
  const p = record?.source?.path || '';
  return String(p).split('/').pop() || '';
}

function parseLegacyIdentity(record) {
  const base = sourceBase(record).replace(/\.json$/i, '');
  // Examples: AS-r1-t5, ASa-r1-N4, C-r2-A1.
  let m = base.match(/^([A-Za-z0-9]+)-r(\d+)-t(\d+)$/);
  if (m) return { family: m[1], replicate: Number(m[2]), turn: Number(m[3]), fork: null, probeId: null };
  m = base.match(/^([A-Za-z0-9]+?)([a-z0-9])?-r(\d+)-(.+)$/i);
  if (m) return { family: m[1], fork: m[2] || record?.forkId || record?.branch || null, replicate: Number(m[3]), turn: null, probeId: record?.probeId || m[4] || null };
  return {
    family: record?.family || record?.trunkFamily || '<unknown>',
    replicate: record?.replicate || null,
    turn: record?.turn || null,
    fork: record?.forkId || record?.branch || null,
    probeId: record?.probeId || null,
  };
}

function canonicalIdentity(record, kind) {
  const legacy = parseLegacyIdentity(record);
  return {
    kind,
    family: record?.family || record?.trunkFamily || legacy.family || '<unknown>',
    replicate: record?.replicate || legacy.replicate || null,
    turn: record?.turn || legacy.turn || null,
    fork: record?.forkId || record?.branch || legacy.fork || null,
    probeId: record?.probeId || legacy.probeId || null,
    parentSnapshotId: record?.parentSnapshotId || null,
    outcome: record?.callOutcome || record?.outcome || '<unknown>',
    stopReason: record?.stopReason || null,
    sourcePath: record?.source?.path || null,
  };
}

function buildCoverage(dataset) {
  const cells = new Map();
  const observations = [
    ...(dataset.branchObservations || []).map(x => [x, 'branch']),
    ...(dataset.coldObservations || []).map(x => [x, 'cold']),
  ];
  for (const [record, kind] of observations) {
    const id = canonicalIdentity(record, kind);
    const rowKey = kind === 'cold'
      ? `cold:r${id.replicate ?? '?'}`
      : `${id.family}:r${id.replicate ?? '?'}:${id.fork ?? '?'}`;
    const probeKey = id.probeId || '<unknown>';
    const key = `${rowKey}||${probeKey}`;
    if (!cells.has(key)) cells.set(key, { rowKey, family: id.family, replicate: id.replicate, fork: id.fork, kind, probeId: probeKey, count: 0, outcomes: {}, exactSiblingContrast: false, sourcePaths: [] });
    const cell = cells.get(key);
    cell.count += 1;
    inc(cell.outcomes, id.outcome);
    if (id.sourcePath) cell.sourcePaths.push(id.sourcePath);
  }

  for (const contrast of dataset.contrasts || []) {
    if (contrast.contrastType !== 'exact_shared_parent') continue;
    const probeId = contrast.probeId || '<unknown>';
    for (const fork of [contrast.leftForkId, contrast.rightForkId]) {
      for (const cell of cells.values()) {
        if (cell.kind === 'branch' && cell.probeId === probeId && String(cell.fork) === String(fork)) cell.exactSiblingContrast = true;
      }
    }
  }
  return [...cells.values()].sort((a, b) => a.rowKey.localeCompare(b.rowKey) || a.probeId.localeCompare(b.probeId));
}

function buildLineage(dataset) {
  const trunks = new Map();
  for (const record of dataset.trunkTurns || []) {
    const id = canonicalIdentity(record, 'trunk');
    const key = `${id.family}:r${id.replicate ?? '?'}`;
    if (!trunks.has(key)) trunks.set(key, { key, family: id.family, replicate: id.replicate, turns: [], forks: {}, anomalies: [] });
    const t = trunks.get(key);
    t.turns.push(id);
    if (id.outcome !== 'complete') t.anomalies.push(id);
  }
  for (const record of dataset.branchObservations || []) {
    const id = canonicalIdentity(record, 'branch');
    const key = `${id.family}:r${id.replicate ?? '?'}`;
    if (!trunks.has(key)) trunks.set(key, { key, family: id.family, replicate: id.replicate, turns: [], forks: {}, anomalies: [] });
    const t = trunks.get(key);
    const fork = id.fork || '<unknown>';
    if (!t.forks[fork]) t.forks[fork] = { fork, observations: [], probeIds: new Set(), parentSnapshotIds: new Set(), anomalies: [] };
    const f = t.forks[fork];
    f.observations.push(id);
    if (id.probeId) f.probeIds.add(id.probeId);
    if (id.parentSnapshotId) f.parentSnapshotIds.add(id.parentSnapshotId);
    if (id.outcome !== 'complete') f.anomalies.push(id);
  }
  return [...trunks.values()].map(t => ({
    ...t,
    turns: t.turns.sort((a, b) => (a.turn || 0) - (b.turn || 0)),
    forks: Object.values(t.forks).map(f => ({
      ...f,
      probeIds: [...f.probeIds].sort(),
      parentSnapshotIds: [...f.parentSnapshotIds].sort(),
    })).sort((a, b) => String(a.fork).localeCompare(String(b.fork))),
  })).sort((a, b) => a.family.localeCompare(b.family) || (a.replicate || 0) - (b.replicate || 0));
}

function buildCorpusVisualization(dataset) {
  const lineage = buildLineage(dataset);
  const coverage = buildCoverage(dataset);
  const probes = [...new Set(coverage.map(x => x.probeId))].sort();
  const families = [...new Set(lineage.map(x => x.family))].sort();
  const anomalies = [];
  for (const t of lineage) {
    anomalies.push(...t.anomalies.map(x => ({ ...x, lineageKey: t.key })));
    for (const f of t.forks) anomalies.push(...f.anomalies.map(x => ({ ...x, lineageKey: t.key, fork: f.fork })));
  }
  return {
    schema: 'blum-corpus-visualization-v0',
    summary: {
      ...(dataset.summary || {}),
      trunkInstances: lineage.length,
      families: families.length,
      probes: probes.length,
      anomalyCount: anomalies.length,
    },
    families,
    probes,
    lineage,
    coverage,
    anomalies,
    exactContrasts: (dataset.contrasts || []).filter(x => x.contrastType === 'exact_shared_parent'),
  };
}

module.exports = { parseLegacyIdentity, canonicalIdentity, buildCoverage, buildLineage, buildCorpusVisualization };
