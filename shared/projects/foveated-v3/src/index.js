/**
 * Foveated Context V3 — Main Entry Point
 * 
 * Two-track context compression for Blum peers.
 * Conversation stays uncompressed, tool calls get synthesized with UID pointers.
 * 
 * Authors: Selah (spec + summarizer), Beta (uid + classifier), Alpha (context-builder)
 * Date: 2026-02-20
 */

const uid = require('./uid');
const classifier = require('./classifier');
const summarizer = require('./summarizer');
const contextBuilder = require('./context-builder');
const zoom = require('./zoom');

/**
 * Main processing pipeline
 * Takes raw JSONL entries and produces compressed context
 */
async function processContext(entries, options = {}) {
  const result = contextBuilder.buildContext(entries, options);
  
  // Register all UIDs in zoom store for later expansion
  for (const entry of entries) {
    if (entry._uid) {
      zoom.register(entry._uid, entry);
    }
  }
  
  return result;
}

/**
 * Process a single entry and return its compressed form
 */
function processEntry(entry) {
  const classification = classifier.classify(entry);
  
  if (classification.fate === 'OMIT') {
    return null;
  }
  
  if (classification.fate === 'QUOTE') {
    return {
      type: 'quote',
      content: entry,
      classification
    };
  }
  
  if (classification.fate === 'SYNTHESIZE') {
    const entryUid = uid.rawUID();
    const summary = summarizer.summarize(entry, entryUid);
    zoom.register(entryUid, entry);
    
    return {
      type: 'synthesize',
      uid: entryUid,
      summary: summary.summary,
      classification
    };
  }
  
  return null;
}

/**
 * Expand a UID reference back to full content
 */
function expandUID(uidString) {
  const content = zoom.zoom(uidString);
  if (!content) {
    return { found: false, uid: uidString };
  }
  return {
    found: true,
    uid: uidString,
    content,
    formatted: zoom.formatExpanded(content)
  };
}

/**
 * Get statistics about the context system
 */
function getStats() {
  return {
    zoom: zoom.stats(),
    thresholds: summarizer.THRESHOLDS,
    defaultConfig: contextBuilder.DEFAULT_CONFIG
  };
}

module.exports = {
  // Main pipeline
  processContext,
  processEntry,
  expandUID,
  getStats,
  
  // Sub-modules for direct access
  uid,
  classifier,
  summarizer,
  contextBuilder,
  zoom,
  
  // Convenience re-exports
  buildContext: contextBuilder.buildContext,
  buildFromFile: contextBuilder.buildFromFile,
  classify: classifier.classify,
  summarize: summarizer.summarize,
  rawUID: uid.rawUID,
  zoomIn: zoom.zoom
};
