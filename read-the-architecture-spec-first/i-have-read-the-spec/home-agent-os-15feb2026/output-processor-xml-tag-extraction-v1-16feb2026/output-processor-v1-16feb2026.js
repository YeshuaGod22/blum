// ========================================
// OUTPUT PROCESSOR — Minimum Viable
//
// parse(responseText) → { thinking[], messages[], private }
//
// Extracts <thinking> and <message to="">
// tags from the nucleus response string.
// Everything else is private text.
// ========================================

/**
 * Parse a nucleus response string into structured output.
 *
 * @param {string} responseText - Raw string from nucleus.call()
 * @returns {object} parsed
 * @returns {string[]} parsed.thinking - Content of <thinking> blocks
 * @returns {Array<{to: string, content: string}>} parsed.messages - Addressed messages
 * @returns {string} parsed.private - Everything outside tags
 */
function parse(responseText) {
  const thinking = [];
  const messages = [];

  // Extract <thinking>...</thinking> blocks
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match;
  while ((match = thinkingRegex.exec(responseText)) !== null) {
    thinking.push(match[1].trim());
  }

  // Extract <message to="...">...</message> blocks
  const messageRegex = /<message\s+to="([^"]+)">([\s\S]*?)<\/message>/g;
  while ((match = messageRegex.exec(responseText)) !== null) {
    messages.push({
      to: match[1].trim(),
      content: match[2].trim(),
    });
  }

  // Private text: everything outside tags
  let privateText = responseText
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<message\s+to="[^"]+">[\s\S]*?<\/message>/g, '')
    .trim();

  return { thinking, messages, private: privateText };
}

module.exports = { parse };
