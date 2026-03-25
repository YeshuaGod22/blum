// ========================================
// OUTPUT PROCESSOR — v2 — 16 Feb 2026
//
// parse(responseText, _traceContext?) → { parseId, thinking[], messages[], private, _meta }
//
// Extracts <thinking> and <message to="">
// tags from the nucleus response string.
// Everything else is private text.
//
// Each block gets a blockId for traceability.
// thinking[] items are now { blockId, content } (was plain strings).
// messages[] items now include blockId alongside to and content.
// ========================================

const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

/**
 * Parse a nucleus response string into structured output.
 *
 * @param {string} responseText - Raw string from nucleus.call()
 * @param {object} [_traceContext] - Traceability context (cycleId, etc.)
 * @returns {object} parsed
 * @returns {string} parsed.parseId - Unique ID for this parse result
 * @returns {Array<{blockId: string, content: string}>} parsed.thinking - Thinking blocks
 * @returns {Array<{blockId: string, to: string, content: string}>} parsed.messages - Addressed messages
 * @returns {string} parsed.private - Everything outside tags
 * @returns {object} parsed._meta - Traceability metadata
 */
function parse(responseText, _traceContext = {}) {
  const parseId = generateUID('parse');
  const thinking = [];
  const messages = [];
  let workingText = responseText || '';

  // Extract <thinking>...</thinking> blocks
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match;
  while ((match = thinkingRegex.exec(workingText)) !== null) {
    thinking.push({
      blockId: generateUID('blk'),
      content: match[1].trim(),
    });
  }

  // Extract <message to="...">...</message> blocks
  const messageRegex = /<message\s+to="([^"]+)">([\s\S]*?)<\/message>/g;
  while ((match = messageRegex.exec(workingText)) !== null) {
    messages.push({
      blockId: generateUID('blk'),
      to: match[1].trim(),
      content: match[2].trim(),
    });
  }

  // Recovery path: if there are no closed message tags, but the response ends with
  // a single trailing <message to="..."> block, treat it as one addressed message.
  // This preserves delivery when the model omits only the closing </message>.
  if (messages.length === 0) {
    const openOnlyMatch = workingText.match(/^\s*<message\s+to="([^"]+)">([\s\S]*)$/);
    if (openOnlyMatch) {
      messages.push({
        blockId: generateUID('blk'),
        to: openOnlyMatch[1].trim(),
        content: openOnlyMatch[2].trim(),
      });
      workingText = '';
    }
  }

  // Private text: everything outside tags
  let privateText = workingText
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<message\s+to="[^"]+">[\s\S]*?<\/message>/g, '')
    .replace(/<null\s*\/?>(\s*<\/null>)?/g, '')
    .trim();

  // Treat <null/> as intentional silence only when it is the only remaining
  // meaningful content after removing other tags. Mixed outputs like
  // "<null/>" plus prose should not suppress fallback notices.
  const intentionalSilence = /<null\s*\/?>(\s*<\/null>)?/.test(workingText) && privateText.length === 0 && messages.length === 0;

  return {
    parseId,
    thinking,
    messages,
    intentionalSilence,
    private: privateText,
    _meta: {
      cycleId: _traceContext.cycleId || null,
      responseId: _traceContext.finalResponseId || null,
    },
  };
}

module.exports = { parse };
