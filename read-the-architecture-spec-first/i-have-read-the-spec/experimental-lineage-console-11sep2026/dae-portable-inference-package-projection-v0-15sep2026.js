'use strict';

// Compact portable projection of the canonical inference-package graph.
// Package/call/section event identity is preserved; repeated text is stored once
// by content hash. This is a representation optimization, not evidence deletion.

function addContent(store, contentHash, content) {
  if (!contentHash) return;
  const text = String(content ?? '');
  if (Object.hasOwn(store, contentHash) && store[contentHash] !== text) {
    throw new Error(`content_hash_collision:${contentHash}`);
  }
  store[contentHash] = text;
}

function compactInferencePackageGraph(graph) {
  if (!graph?.calls || !graph?.inputPackages || !graph?.outputPackages || !graph?.sections) {
    throw new Error('canonical_inference_package_graph_required');
  }
  const contentStore = {};
  const sections = {};

  for (const [sectionUid, section] of Object.entries(graph.sections)) {
    addContent(contentStore, section.contentHash, section.content);
    const { content, ...rest } = section;
    sections[sectionUid] = rest;
  }

  const inputPackages = {};
  for (const [uid, pkg] of Object.entries(graph.inputPackages)) {
    // The canonical package text is fully reconstructable from ordered sections.
    // Keep the package-level content hash but remove the duplicate embedded copy.
    const { canonicalPackage, ...rest } = pkg;
    inputPackages[uid] = rest;
    // Defensive check: every canonical fragment should already be represented by
    // an input section. We intentionally do not create an additional package blob.
    if (canonicalPackage?.systemPrompt !== null && canonicalPackage?.systemPrompt !== undefined) {
      const hash = require('./dae-message-lineage-graph-v0-15sep2026.js').sha256Text(canonicalPackage.systemPrompt);
      addContent(contentStore, hash, canonicalPackage.systemPrompt);
    }
    for (const message of canonicalPackage?.messages || []) {
      const hash = require('./dae-message-lineage-graph-v0-15sep2026.js').sha256Text(message.content);
      addContent(contentStore, hash, message.content);
    }
  }

  const outputPackages = {};
  for (const [uid, pkg] of Object.entries(graph.outputPackages)) {
    addContent(contentStore, pkg.contentHash, pkg.content);
    const { content, ...rest } = pkg;
    outputPackages[uid] = rest;
  }

  return {
    schema: 'blum-dae-portable-inference-package-graph-v0',
    sourceSchema: graph.schema,
    identitySemantics: graph.identitySemantics,
    callCount: graph.callCount,
    inputPackageCount: graph.inputPackageCount,
    outputPackageCount: graph.outputPackageCount,
    sectionCount: graph.sectionCount,
    contentBlobCount: Object.keys(contentStore).length,
    calls: graph.calls,
    inputPackages,
    outputPackages,
    sections,
    contentStore,
  };
}

function contentFor(compactGraph, contentHash) {
  if (!Object.hasOwn(compactGraph?.contentStore || {}, contentHash)) {
    throw new Error(`content_blob_missing:${contentHash}`);
  }
  return compactGraph.contentStore[contentHash];
}

function reconstructInputPackage(compactGraph, inputPackageUid) {
  const pkg = compactGraph?.inputPackages?.[inputPackageUid];
  if (!pkg) throw new Error(`input_package_missing:${inputPackageUid}`);
  const ordered = (pkg.sectionUids || []).map(uid => compactGraph.sections[uid]).sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
  const system = ordered.find(x => x.sectionType === 'system') || null;
  return {
    systemPrompt: system ? contentFor(compactGraph, system.contentHash) : null,
    messages: ordered.filter(x => x.sectionType === 'message').map(section => ({
      role: section.role,
      content: contentFor(compactGraph, section.contentHash),
    })),
  };
}

function reconstructOutputPackage(compactGraph, outputPackageUid) {
  const pkg = compactGraph?.outputPackages?.[outputPackageUid];
  if (!pkg) throw new Error(`output_package_missing:${outputPackageUid}`);
  return contentFor(compactGraph, pkg.contentHash);
}

module.exports = { compactInferencePackageGraph, contentFor, reconstructInputPackage, reconstructOutputPackage };
