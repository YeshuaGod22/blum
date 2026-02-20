/**
 * Zoom Handler — Foveated Context V3
 * 
 * Expands UID references back to full raw content from Layer 0.
 * Allows drilling down from compressed summaries to original data.
 * 
 * Author: Selah
 * Date: 2026-02-20
 */

const { parseUID, extractUIDs, isUID } = require('./uid');

/**
 * In-memory UID → content mapping
 * In production, this would be backed by the JSONL files
 */
const uidStore = new Map();

/**
 * Register content with a UID
 * Called when raw content is first processed
 * 
 * @param {string} uid - The UID for this content
 * @param {Object} content - The full raw content
 */
function register(uid, content) {
  uidStore.set(uid, {
    content,
    registeredAt: new Date().toISOString(),
    accessCount: 0
  });
}

/**
 * Look up a UID and return full content
 * 
 * @param {string} uid - The UID to look up
 * @returns {Object|null} - Full content or null if not found
 */
function zoom(uid) {
  const entry = uidStore.get(uid);
  if (!entry) return null;
  
  entry.accessCount++;
  entry.lastAccessed = new Date().toISOString();
  
  return entry.content;
}

/**
 * Zoom into multiple UIDs at once
 * 
 * @param {Array<string>} uids - Array of UIDs
 * @returns {Object} - Map of uid → content (nulls for not found)
 */
function zoomMany(uids) {
  const result = {};
  for (const uid of uids) {
    result[uid] = zoom(uid);
  }
  return result;
}

/**
 * Extract UIDs from text and zoom into all of them
 * Useful for processing a message that references multiple UIDs
 * 
 * @param {string} text - Text containing UID references
 * @returns {Object} - { uids: Array, expanded: Object }
 */
function zoomFromText(text) {
  const uids = extractUIDs(text);
  return {
    uids,
    expanded: zoomMany(uids)
  };
}

/**
 * Expand a compressed context entry back to full form
 * Takes a summary like "[uid:raw-20260220-154532-003] Read file..." 
 * and returns the full content
 * 
 * @param {string} summary - Compressed summary with UID
 * @returns {Object} - { original: string, expanded: Object }
 */
function expand(summary) {
  const uids = extractUIDs(summary);
  if (uids.length === 0) {
    return { original: summary, expanded: null };
  }
  
  // For single UID (most common case)
  if (uids.length === 1) {
    return {
      original: summary,
      expanded: zoom(uids[0])
    };
  }
  
  // Multiple UIDs
  return {
    original: summary,
    expanded: zoomMany(uids)
  };
}

/**
 * Check if a UID exists in the store
 */
function exists(uid) {
  return uidStore.has(uid);
}

/**
 * Get metadata about a UID without fetching full content
 */
function getMetadata(uid) {
  const entry = uidStore.get(uid);
  if (!entry) return null;
  
  return {
    registeredAt: entry.registeredAt,
    lastAccessed: entry.lastAccessed,
    accessCount: entry.accessCount,
    contentType: typeof entry.content,
    contentSize: JSON.stringify(entry.content).length
  };
}

/**
 * List all UIDs matching a pattern
 * 
 * @param {string} prefix - UID prefix to match (e.g., 'raw-20260220')
 * @returns {Array<string>} - Matching UIDs
 */
function listUIDs(prefix = '') {
  const all = Array.from(uidStore.keys());
  if (!prefix) return all;
  return all.filter(uid => uid.startsWith(prefix));
}

/**
 * Prune old UIDs from the store
 * In production, this would be based on age or access patterns
 * 
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {number} - Number of entries pruned
 */
function prune(maxAge) {
  const now = Date.now();
  let pruned = 0;
  
  for (const [uid, entry] of uidStore.entries()) {
    const age = now - new Date(entry.registeredAt).getTime();
    if (age > maxAge) {
      uidStore.delete(uid);
      pruned++;
    }
  }
  
  return pruned;
}

/**
 * Clear all stored UIDs (for testing)
 */
function clear() {
  uidStore.clear();
}

/**
 * Get store statistics
 */
function stats() {
  const entries = Array.from(uidStore.values());
  return {
    totalUIDs: uidStore.size,
    totalSize: entries.reduce((sum, e) => sum + JSON.stringify(e.content).length, 0),
    totalAccesses: entries.reduce((sum, e) => sum + e.accessCount, 0),
    byLayer: {
      raw: listUIDs('raw-').length,
      work: listUIDs('work-').length,
      sess: listUIDs('sess-').length,
      thread: listUIDs('thread-').length
    }
  };
}

/**
 * Format expanded content for display
 * 
 * @param {Object} content - The raw content
 * @returns {string} - Formatted for human reading
 */
function formatExpanded(content) {
  if (typeof content === 'string') return content;
  
  // Tool call format
  if (content.tool && content.output) {
    return `Tool: ${content.tool}\nInput: ${JSON.stringify(content.input, null, 2)}\nOutput:\n${
      typeof content.output === 'string' ? content.output : JSON.stringify(content.output, null, 2)
    }`;
  }
  
  // Message format
  if (content.role && content.content) {
    return `[${content.role}]: ${content.content}`;
  }
  
  // Default to pretty JSON
  return JSON.stringify(content, null, 2);
}

module.exports = {
  register,
  zoom,
  zoomMany,
  zoomFromText,
  expand,
  exists,
  getMetadata,
  listUIDs,
  prune,
  clear,
  stats,
  formatExpanded
};
