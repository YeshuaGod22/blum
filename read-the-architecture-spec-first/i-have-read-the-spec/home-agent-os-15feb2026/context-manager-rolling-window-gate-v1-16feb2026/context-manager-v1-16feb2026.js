// ========================================
// CONTEXT MANAGER — Minimum Viable
//
// fit(systemMessages, conversationMessages, tokenBudget) → messages[]
//
// Ensures total tokens ≤ budget.
// This version: character-based estimation,
// rolling window (trim from front).
//
// "Always present, non-negotiable."
// — Spec section 5
// ========================================

// Rough token estimation: ~4 chars per token for English
const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0); // +4 per message overhead
}

/**
 * Fit system + conversation messages within a token budget.
 * System messages are never trimmed. Conversation is trimmed from the front.
 *
 * @param {Array<{role: string, content: string}>} systemMessages - Boot assembler output
 * @param {Array<{role: string, content: string}>} conversationMessages - Input processor output
 * @param {number} tokenBudget - Maximum total tokens
 * @returns {Array<{role: string, content: string}>}
 */
function fit(systemMessages, conversationMessages, tokenBudget) {
  const systemTokens = estimateMessagesTokens(systemMessages);
  const available = tokenBudget - systemTokens;

  if (available <= 0) {
    // System prompt alone exceeds budget — send it anyway, it's the identity
    return [...systemMessages];
  }

  // Trim conversation from the front (oldest first) until it fits
  let conversation = [...conversationMessages];
  while (conversation.length > 0 && estimateMessagesTokens(conversation) > available) {
    conversation.shift();
  }

  return [...systemMessages, ...conversation];
}

module.exports = { fit, estimateTokens, estimateMessagesTokens };
