/**
 * Context Builder — Foveated Context V3
 * 
 * The integration layer that assembles two-track context from JSONL.
 * Conversation stays full fidelity, tool calls get compressed with UID pointers.
 * 
 * Author: Alpha (spec), Selah (implementation)
 * Date: 2026-02-20
 */

const { classify, Fate, shouldDeduplicate } = require('./classifier');
const { summarize } = require('./summarizer');
const { rawUID } = require('./uid');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  maxTokens: 100000,        // Total context budget
  reserveForResponse: 4000, // Leave room for model response
  truncateOldest: true,     // When over budget, remove oldest conversation first
  bootDocsTokens: 15000,    // Estimated tokens for boot docs (don't count against budget)
};

/**
 * Rough token estimation (4 chars per token average)
 */
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = JSON.stringify(text);
  return Math.ceil(text.length / 4);
}

/**
 * Build context from JSONL entries
 * 
 * @param {Array} entries - Raw JSONL entries (newest last)
 * @param {Object} options - Configuration options
 * @param {Set} seenIds - Already-seen message IDs (for deduplication)
 * @returns {Object} - { context: Array, metadata: Object }
 */
function buildContext(entries, options = {}, seenIds = new Set()) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const budget = config.maxTokens - config.reserveForResponse - config.bootDocsTokens;
  
  const result = {
    context: [],
    metadata: {
      totalEntries: entries.length,
      quoted: 0,
      synthesized: 0,
      omitted: 0,
      deduplicated: 0,
      tokensUsed: 0,
      truncatedCount: 0,
      uids: []
    }
  };
  
  // Process each entry
  const processedEntries = [];
  
  for (const entry of entries) {
    // Check for deduplication
    if (shouldDeduplicate(entry, seenIds)) {
      result.metadata.deduplicated++;
      continue;
    }
    
    // Classify the entry
    const classification = classify(entry);
    
    // Handle based on fate
    switch (classification.fate) {
      case Fate.OMIT:
        result.metadata.omitted++;
        continue;
        
      case Fate.QUOTE:
        processedEntries.push({
          type: 'quote',
          content: formatQuotedEntry(entry),
          tokens: estimateTokens(formatQuotedEntry(entry)),
          original: entry
        });
        result.metadata.quoted++;
        break;
        
      case Fate.SYNTHESIZE:
        const uid = rawUID();
        const summary = summarize(entry, uid);
        processedEntries.push({
          type: 'synthesize',
          content: summary.summary,
          tokens: estimateTokens(summary.summary),
          uid: uid,
          original: entry
        });
        result.metadata.synthesized++;
        result.metadata.uids.push(uid);
        break;
    }
  }
  
  // Calculate total tokens
  let totalTokens = processedEntries.reduce((sum, e) => sum + e.tokens, 0);
  result.metadata.tokensUsed = totalTokens;
  
  // Truncate if over budget (remove oldest conversation entries first)
  if (totalTokens > budget && config.truncateOldest) {
    // Find conversation entries that can be truncated
    for (let i = 0; i < processedEntries.length && totalTokens > budget; i++) {
      const entry = processedEntries[i];
      // Only truncate conversation, not synthesized summaries (those are already small)
      if (entry.type === 'quote') {
        totalTokens -= entry.tokens;
        entry.truncated = true;
        result.metadata.truncatedCount++;
      }
    }
    
    // Remove truncated entries
    const kept = processedEntries.filter(e => !e.truncated);
    result.metadata.tokensUsed = kept.reduce((sum, e) => sum + e.tokens, 0);
    
    // Add truncation notice if we removed anything
    if (result.metadata.truncatedCount > 0) {
      result.context.push({
        role: 'system',
        content: `[Context truncated: ${result.metadata.truncatedCount} older messages removed to fit budget]`
      });
    }
    
    // Build final context from kept entries
    result.context.push(...kept.map(e => formatContextEntry(e)));
  } else {
    // No truncation needed
    result.context = processedEntries.map(e => formatContextEntry(e));
  }
  
  return result;
}

/**
 * Format a quoted entry for context
 */
function formatQuotedEntry(entry) {
  if (entry.role && entry.content) {
    return entry.content;
  }
  if (entry.from && entry.body) {
    return `[${entry.from}]: ${entry.body}`;
  }
  if (entry.message) {
    return entry.message;
  }
  return JSON.stringify(entry);
}

/**
 * Format a processed entry for the final context array
 */
function formatContextEntry(processed) {
  const original = processed.original;
  
  // Preserve role structure if present
  if (original.role) {
    return {
      role: original.role,
      content: processed.content
    };
  }
  
  // For peer messages
  if (original.from) {
    return {
      role: 'user',
      content: processed.content
    };
  }
  
  // Default to assistant
  return {
    role: 'assistant',
    content: processed.content
  };
}

/**
 * Interleave conversation and tool tracks chronologically
 * (entries should already be in chronological order)
 */
function interleave(conversationTrack, toolTrack) {
  const all = [...conversationTrack, ...toolTrack];
  // Sort by timestamp if available
  all.sort((a, b) => {
    const timeA = a.original?.timestamp || a.original?.created_at || 0;
    const timeB = b.original?.timestamp || b.original?.created_at || 0;
    return timeA - timeB;
  });
  return all;
}

/**
 * Read JSONL file and build context
 * 
 * @param {string} jsonlPath - Path to JSONL file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Built context
 */
async function buildFromFile(jsonlPath, options = {}) {
  const fs = require('fs').promises;
  
  const content = await fs.readFile(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.trim());
  const entries = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(e => e !== null);
  
  return buildContext(entries, options);
}

/**
 * Get recent entries from JSONL (last N)
 */
function getRecentEntries(entries, count = 50) {
  return entries.slice(-count);
}

module.exports = {
  buildContext,
  buildFromFile,
  getRecentEntries,
  interleave,
  estimateTokens,
  formatQuotedEntry,
  formatContextEntry,
  DEFAULT_CONFIG
};
