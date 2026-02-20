/**
 * UID Generator — Foveated Context V3
 * 
 * Generates unique identifiers for each content entry across all layers.
 * UIDs are addressable and allow zoom-in from any compression layer back to raw.
 * 
 * Author: Beta (spec), Selah (implementation)
 * Date: 2026-02-20
 * Updated: 2026-02-20 — Added agent prefix for cross-agent uniqueness
 */

/**
 * Sequence counters per prefix per day
 * In production, this would persist to disk
 */
const sequences = new Map();

/**
 * Current agent name (set via init or defaults to 'unknown')
 */
let agentName = 'unknown';

/**
 * Initialize the UID generator with agent context
 * @param {string} agent - The agent name (e.g., 'selah', 'eiran', 'beta')
 */
function init(agent) {
  if (agent && typeof agent === 'string') {
    agentName = agent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
}

/**
 * Get current timestamp in YYYYMMDD-HHMMSS format
 */
function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `${date}-${time}`;
}

/**
 * Get current date in YYYYMMDD format
 */
function getDateKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Get next sequence number for a prefix on a given day
 */
function nextSequence(prefix) {
  const dateKey = getDateKey();
  const key = `${prefix}-${dateKey}`;
  
  const current = sequences.get(key) || 0;
  const next = current + 1;
  sequences.set(key, next);
  
  return String(next).padStart(3, '0');
}

/**
 * Generate a raw layer UID (Layer 0)
 * Format: raw-{agent}-YYYYMMDD-HHMMSS-NNN
 * Example: raw-selah-20260220-170532-003
 */
function rawUID() {
  const timestamp = getTimestamp();
  const seq = nextSequence('raw');
  return `raw-${agentName}-${timestamp}-${seq}`;
}

/**
 * Generate a working context UID (Layer 1)
 * Format: work-{agent}-YYYYMMDD-HHMMSS-NNN
 */
function workUID() {
  const timestamp = getTimestamp();
  const seq = nextSequence('work');
  return `work-${agentName}-${timestamp}-${seq}`;
}

/**
 * Generate a session summary UID (Layer 2)
 * Format: sess-{agent}-YYYYMMDD-NNN
 */
function sessionUID() {
  const dateKey = getDateKey();
  const seq = nextSequence('sess');
  return `sess-${agentName}-${dateKey}-${seq}`;
}

/**
 * Generate a thread/project UID (Layer 3)
 * Format: thread-{name}-NNN
 * Note: threads are cross-agent, so no agent prefix
 */
function threadUID(threadName) {
  const safeName = threadName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const seq = nextSequence(`thread-${safeName}`);
  return `thread-${safeName}-${seq}`;
}

/**
 * Parse a UID to extract its components
 * @param {string} uid - The UID to parse
 * @returns {Object} - { layer, agent?, timestamp, sequence, threadName? }
 */
function parseUID(uid) {
  const parts = uid.split('-');
  const layer = parts[0];
  
  if (layer === 'raw' || layer === 'work') {
    // New format: raw-{agent}-YYYYMMDD-HHMMSS-NNN
    // Old format: raw-YYYYMMDD-HHMMSS-NNN (for backwards compat)
    if (parts.length === 5) {
      // New format with agent
      return {
        layer,
        agent: parts[1],
        date: parts[2],
        time: parts[3],
        sequence: parts[4],
        timestamp: `${parts[2]}-${parts[3]}`
      };
    } else if (parts.length === 4) {
      // Old format without agent
      return {
        layer,
        agent: 'unknown',
        date: parts[1],
        time: parts[2],
        sequence: parts[3],
        timestamp: `${parts[1]}-${parts[2]}`
      };
    }
  } else if (layer === 'sess') {
    // New format: sess-{agent}-YYYYMMDD-NNN
    // Old format: sess-YYYYMMDD-NNN
    if (parts.length === 4) {
      return {
        layer: 'session',
        agent: parts[1],
        date: parts[2],
        sequence: parts[3]
      };
    } else if (parts.length === 3) {
      return {
        layer: 'session',
        agent: 'unknown',
        date: parts[1],
        sequence: parts[2]
      };
    }
  } else if (layer === 'thread') {
    // thread-{name}-NNN (no agent, threads are shared)
    const sequence = parts[parts.length - 1];
    const threadName = parts.slice(1, -1).join('-');
    return {
      layer: 'thread',
      threadName,
      sequence
    };
  }
  
  return { layer: 'unknown', raw: uid };
}

/**
 * Check if a string looks like a valid UID
 */
function isUID(str) {
  if (typeof str !== 'string') return false;
  return /^(raw|work|sess|thread)-/.test(str);
}

/**
 * Extract UIDs from a text string (for zoom-in detection)
 */
function extractUIDs(text) {
  const pattern = /\b(raw|work|sess|thread)-[a-z0-9-]+\b/g;
  return text.match(pattern) || [];
}

/**
 * Reset sequences (for testing)
 */
function resetSequences() {
  sequences.clear();
}

/**
 * Get current agent name
 */
function getAgent() {
  return agentName;
}

module.exports = {
  init,
  getAgent,
  rawUID,
  workUID,
  sessionUID,
  threadUID,
  parseUID,
  isUID,
  extractUIDs,
  resetSequences,
  // Export for testing
  getTimestamp,
  getDateKey
};
