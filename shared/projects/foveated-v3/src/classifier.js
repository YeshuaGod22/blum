/**
 * Content Classifier — Foveated Context V3
 * 
 * Classifies JSONL entries into conversation (QUOTE) vs tool calls (SYNTHESIZE).
 * This determines which track each piece of content goes into.
 * 
 * Supports both:
 * - API format: {role, content, tool, tool_calls}
 * - Homelogfull format: {entryId, _trace, messages, thinking}
 * 
 * Author: Beta (spec), Selah (implementation)
 * Date: 2026-02-20, updated 2026-02-23
 */

/**
 * Content types
 */
const ContentType = {
  CONVERSATION: 'conversation',
  TOOL: 'tool',
  SYSTEM: 'system',
  THINKING: 'thinking',
  HOMELOGFULL: 'homelogfull'  // Blum cycle entry
};

/**
 * Content fates
 */
const Fate = {
  QUOTE: 'QUOTE',         // Keep exact, full fidelity
  SYNTHESIZE: 'SYNTHESIZE', // Compress with UID pointer
  OMIT: 'OMIT',           // Don't include in context
  DEDUPLICATE: 'DEDUPLICATE' // Skip if already seen
};

/**
 * Tool names that are always SYNTHESIZE
 */
const SYNTHESIZE_TOOLS = [
  'shell_exec',
  'read_file', 
  'write_file',
  'web_fetch',
  'web_search',
  'qmd_search',
  'mem0_search'
];

/**
 * Tool names that are always QUOTE (errors, small outputs)
 */
const QUOTE_TOOLS = [
  'send_to_room',  // messages should be quoted
  'speak'          // TTS output is small
];

/**
 * Thresholds for homelogfull classification
 */
const HOMELOGFULL_THRESHOLDS = {
  minToolCallsForSynthesize: 3,   // 3+ tool calls → SYNTHESIZE
  minIterationsForSynthesize: 5,  // 5+ iterations → SYNTHESIZE
  maxMessageLengthForQuote: 1000  // Short messages stay QUOTE
};

/**
 * Classify a JSONL entry
 * 
 * @param {Object} entry - Raw JSONL entry
 * @returns {Object} - { type: ContentType, fate: Fate, reason: string }
 */
function classify(entry) {
  // ============================================
  // HOMELOGFULL FORMAT (Blum cycle entries)
  // ============================================
  if (entry.entryId || entry.cycleId || entry._trace) {
    return classifyHomelogfull(entry);
  }

  // ============================================
  // API FORMAT (standard message format)
  // ============================================
  
  // Handle message entries (conversation)
  if (entry.role === 'user' || entry.role === 'human') {
    return {
      type: ContentType.CONVERSATION,
      fate: Fate.QUOTE,
      reason: 'Human message - always preserve exactly'
    };
  }
  
  if (entry.role === 'assistant' && !entry.tool_calls && !entry.tool) {
    return {
      type: ContentType.CONVERSATION,
      fate: Fate.QUOTE,
      reason: 'Assistant response - always preserve exactly'
    };
  }
  
  // Handle system messages
  if (entry.role === 'system') {
    return {
      type: ContentType.SYSTEM,
      fate: Fate.QUOTE,
      reason: 'System message - instructions matter exactly'
    };
  }
  
  // Handle thinking blocks (Anthropic API format: entry.type === 'thinking')
  // Note: entry.thinking as an *array* is a homelogfull field — don't omit those.
  // Only omit entries whose *type* field is 'thinking'.
  if (entry.type === 'thinking') {
    return {
      type: ContentType.THINKING,
      fate: Fate.OMIT,
      reason: 'Thinking block - omit from context'
    };
  }
  
  // Handle tool calls
  if (entry.tool || entry.tool_calls || entry.type === 'tool_result') {
    const toolName = entry.tool || 
                     (entry.tool_calls && entry.tool_calls[0]?.function?.name) ||
                     entry.name;
    
    // Check for errors - always QUOTE
    if (entry.error || (entry.output && entry.output.error)) {
      return {
        type: ContentType.TOOL,
        fate: Fate.QUOTE,
        reason: `Tool error - preserve exact error message`
      };
    }
    
    // Check tool type
    if (QUOTE_TOOLS.includes(toolName)) {
      return {
        type: ContentType.TOOL,
        fate: Fate.QUOTE,
        reason: `${toolName} - small output, quote directly`
      };
    }
    
    if (SYNTHESIZE_TOOLS.includes(toolName)) {
      return {
        type: ContentType.TOOL,
        fate: Fate.SYNTHESIZE,
        reason: `${toolName} - compress with UID pointer`
      };
    }
    
    // Unknown tool - default to SYNTHESIZE if output is large
    const outputSize = getOutputSize(entry);
    if (outputSize > 200) {
      return {
        type: ContentType.TOOL,
        fate: Fate.SYNTHESIZE,
        reason: `Unknown tool ${toolName} with large output (${outputSize} chars) - compress`
      };
    }
    
    return {
      type: ContentType.TOOL,
      fate: Fate.QUOTE,
      reason: `Unknown tool ${toolName} with small output - quote`
    };
  }
  
  // Handle peer messages (from Blum room)
  if (entry.from || entry.sender) {
    return {
      type: ContentType.CONVERSATION,
      fate: Fate.QUOTE,
      reason: 'Peer message - coordination requires exact wording'
    };
  }
  
  // Default fallback
  return {
    type: ContentType.CONVERSATION,
    fate: Fate.QUOTE,
    reason: 'Unknown entry type - default to QUOTE for safety'
  };
}

/**
 * Classify a homelogfull entry (Blum cycle)
 * 
 * These entries contain:
 * - entryId, cycleId, dispatchId
 * - _trace with iterations array (each has toolCalls)
 * - messages array (the output messages)
 * - thinking array
 * 
 * Decision logic:
 * - Tool-heavy cycles (many tool calls) → SYNTHESIZE
 * - Conversation-heavy cycles (few tools, short) → QUOTE
 */
function classifyHomelogfull(entry) {
  const trace = entry._trace || {};
  const iterations = trace.iterations || [];
  const messages = entry.messages || [];
  
  // Count total tool calls across all iterations
  let totalToolCalls = 0;
  let synthesizeToolCount = 0;
  
  for (const iter of iterations) {
    const tools = iter.toolCalls || [];
    totalToolCalls += tools.length;
    
    // Count tools that would be synthesized
    for (const tool of tools) {
      const toolName = tool.name || tool.function?.name;
      if (SYNTHESIZE_TOOLS.includes(toolName)) {
        synthesizeToolCount++;
      }
    }
  }
  
  // Total iterations
  const totalIterations = iterations.length;
  
  // Get message content size
  const messageText = messages.map(m => m.content || '').join('\n');
  const messageLength = messageText.length;
  
  // Decision logic:
  
  // 1. Many synthesize-worthy tool calls → SYNTHESIZE
  if (synthesizeToolCount >= HOMELOGFULL_THRESHOLDS.minToolCallsForSynthesize) {
    return {
      type: ContentType.HOMELOGFULL,
      fate: Fate.SYNTHESIZE,
      reason: `${synthesizeToolCount} synthesize-worthy tool calls (shell_exec, read_file, etc.)`
    };
  }
  
  // 2. Many iterations → SYNTHESIZE (indicates research/exploration)
  if (totalIterations >= HOMELOGFULL_THRESHOLDS.minIterationsForSynthesize) {
    return {
      type: ContentType.HOMELOGFULL,
      fate: Fate.SYNTHESIZE,
      reason: `${totalIterations} iterations - research/exploration cycle`
    };
  }
  
  // 3. Many total tool calls (even if not synthesize-worthy) → SYNTHESIZE
  if (totalToolCalls >= HOMELOGFULL_THRESHOLDS.minToolCallsForSynthesize * 2) {
    return {
      type: ContentType.HOMELOGFULL,
      fate: Fate.SYNTHESIZE,
      reason: `${totalToolCalls} total tool calls`
    };
  }
  
  // 4. Short message, few tools → QUOTE (conversation-like)
  if (messageLength <= HOMELOGFULL_THRESHOLDS.maxMessageLengthForQuote && totalToolCalls <= 2) {
    return {
      type: ContentType.HOMELOGFULL,
      fate: Fate.QUOTE,
      reason: `Short message (${messageLength} chars), few tools (${totalToolCalls}) - conversation`
    };
  }
  
  // 5. Default: QUOTE for safety (preserves information)
  return {
    type: ContentType.HOMELOGFULL,
    fate: Fate.QUOTE,
    reason: `Default - ${totalIterations} iters, ${totalToolCalls} tools, ${messageLength} chars message`
  };
}

/**
 * Get the size of tool output in characters
 */
function getOutputSize(entry) {
  const output = entry.output || entry.result || entry.content;
  if (!output) return 0;
  if (typeof output === 'string') return output.length;
  return JSON.stringify(output).length;
}

/**
 * Batch classify multiple entries
 * 
 * @param {Array} entries - Array of JSONL entries
 * @returns {Array} - Array of { entry, classification }
 */
function classifyBatch(entries) {
  return entries.map(entry => ({
    entry,
    classification: classify(entry)
  }));
}

/**
 * Filter entries by fate
 * 
 * @param {Array} classifiedEntries - Output from classifyBatch
 * @param {string} fate - Fate to filter for (QUOTE, SYNTHESIZE, OMIT)
 * @returns {Array} - Filtered entries
 */
function filterByFate(classifiedEntries, fate) {
  return classifiedEntries.filter(({ classification }) => 
    classification.fate === fate
  );
}

/**
 * Check if an entry should be deduplicated
 * (already seen in home transcript)
 * 
 * @param {Object} entry - The entry to check
 * @param {Set} seenIds - Set of already-seen message IDs
 * @returns {boolean} - True if should be skipped
 */
function shouldDeduplicate(entry, seenIds) {
  // Check all ID fields used by homelogfull entries and peer messages
  // dispatchId is the primary ID in homelogfull JSONL (format: disp_xxx)
  const id = entry.dispatchId || entry.id || entry.uid || entry.message_id;
  if (!id) return false;
  return seenIds.has(id);
}

module.exports = {
  classify,
  classifyHomelogfull,
  classifyBatch,
  filterByFate,
  shouldDeduplicate,
  getOutputSize,
  ContentType,
  Fate,
  SYNTHESIZE_TOOLS,
  QUOTE_TOOLS,
  HOMELOGFULL_THRESHOLDS
};
