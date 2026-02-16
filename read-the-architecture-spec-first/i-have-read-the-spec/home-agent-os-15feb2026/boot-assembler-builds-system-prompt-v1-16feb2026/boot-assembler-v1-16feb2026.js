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
 * @param {string} [config.replyTo] - The address to reply to (e.g. "yeshua@boardroom")
 * @param {string} [config.currentRoom] - The room this dispatch is from
 * @returns {Array<{role: string, content: string}>}
 */
function assemble(config) {
  const parts = [];

  // Core identity
  parts.push(`You are ${config.name}.`);

  if (config.identity) {
    parts.push(config.identity);
  }

  // Communication protocol — concrete, not abstract
  const protocolLines = [
    'IMPORTANT: You MUST wrap all replies in XML message tags or they will NOT be delivered.',
    'Only text inside <message> tags is sent. Everything else stays private in your home.',
    '',
    'Tags:',
    '- <thinking>your private reasoning</thinking>',
    '- <message to="recipient@room">your reply</message>',
  ];

  // Give the agent a concrete reply address
  if (config.replyTo && config.currentRoom) {
    protocolLines.push('');
    protocolLines.push(`To reply to the person who just messaged you, use exactly:`);
    protocolLines.push(`<message to="${config.replyTo}">your reply here</message>`);
  } else if (config.currentRoom) {
    protocolLines.push('');
    protocolLines.push(`You are in room "${config.currentRoom}". Address messages as: <message to="name@${config.currentRoom}">text</message>`);
  }

  protocolLines.push('');
  protocolLines.push('You can send multiple messages to different recipients in one response.');

  parts.push(protocolLines.join('\n'));

  if (config.roomContext) {
    parts.push(`Current context: ${config.roomContext}`);
  }

  if (config.instructions) {
    parts.push(config.instructions);
  }

  return [{ role: 'system', content: parts.join('\n\n') }];
}

module.exports = { assemble };
