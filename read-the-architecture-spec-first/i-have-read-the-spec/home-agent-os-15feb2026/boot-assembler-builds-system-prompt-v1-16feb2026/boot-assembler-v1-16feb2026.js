// ========================================
// BOOT ASSEMBLER — Minimum Viable
//
// assemble(config) → [{role: 'system', content: string}]
//
// Builds the system prompt prefix.
// This version: static string from config.
// Future versions: document libraries,
// memories, relationship context, etc.
// ========================================

/**
 * Assemble system messages from agent config.
 *
 * @param {object} config - Agent configuration
 * @param {string} config.name - Agent's friendly name
 * @param {string} [config.identity] - Identity/personality description
 * @param {string} [config.instructions] - Additional instructions
 * @param {string} [config.roomContext] - Current room context (name, participants)
 * @returns {Array<{role: string, content: string}>}
 */
function assemble(config) {
  const parts = [];

  // Core identity
  parts.push(`You are ${config.name}.`);

  if (config.identity) {
    parts.push(config.identity);
  }

  // Communication protocol
  parts.push([
    'You communicate using XML tags in your output:',
    '- <thinking>...</thinking> for private reasoning (never routed)',
    '- <message to="name@room">...</message> for addressed communication',
    '- Anything outside these tags is private and not routed.',
    '',
    'You can send multiple messages to multiple destinations in a single response.',
    'You can interleave thinking and messages freely.',
  ].join('\n'));

  if (config.roomContext) {
    parts.push(`Current context: ${config.roomContext}`);
  }

  if (config.instructions) {
    parts.push(config.instructions);
  }

  return [{ role: 'system', content: parts.join('\n\n') }];
}

module.exports = { assemble };
