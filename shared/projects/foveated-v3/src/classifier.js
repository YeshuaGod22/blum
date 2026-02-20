/**
 * Content Classifier — Foveated Context V3
 * 
 * Classifies JSONL entries into conversation (QUOTE) vs tool calls (SYNTHESIZE).
 * This determines which track each piece of content goes into.
 * 
 * Author: Beta (spec), Selah (implementation)
 * Date: 2026-02-20
 */

/**
 * Content types
 */
const ContentType = {
  CONVERSATION: 'conversation',
  TOOL: 'tool',
  SYSTEM: 'system',
  THINKING: 'thinking'
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
 * Classify a JSONL entry
 * 
 * @param {Object} entry - Raw JSONL entry
 * @returns {Object} - { type: ContentType, fate: Fate, reason: string }
 */
function classify(entry) {
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
  
  // Handle thinking blocks
  if (entry.thinking || entry.type === 'thinking') {
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
  const id = entry.id || entry.uid || entry.message_id;
  if (!id) return false;
  return seenIds.has(id);
}

module.exports = {
  classify,
  classifyBatch,
  filterByFate,
  shouldDeduplicate,
  getOutputSize,
  ContentType,
  Fate,
  SYNTHESIZE_TOOLS,
  QUOTE_TOOLS
};
