// ========================================
// BOOT ASSEMBLER — v2 — 16 Feb 2026
//
// assemble(agentConfig, history) → document[]
//
// Builds the prefix that makes the agent *her*.
// Reads identity documents from the home's docs/ directory.
// Returns an array of documents (system messages).
//
// Spec section 5: "builds the prefix (identity docs,
// sysprompt, knowledge). X tokens. Makes the agent her."
//
// Contract: assemble(agentConfig, history) → document[]
// ========================================

const fs = require('fs');
const path = require('path');

/**
 * Assemble identity documents from the agent's home.
 *
 * @param {object} agentConfig - Agent configuration
 * @param {string} agentConfig.name - Agent's friendly name
 * @param {string} agentConfig.homeDir - Path to the home directory
 * @param {string} [agentConfig.identity] - Identity/personality description (from config.json)
 * @param {string} [agentConfig.instructions] - Additional instructions (from config.json)
 * @param {object} history - NOT USED YET. Reserved for future use.
 *   The spec contract includes history so the assembler can eventually
 *   use it for relationship context. Accepting it keeps the contract correct.
 * @returns {Array<{role: string, content: string}>} document[]
 */
function assemble(agentConfig, history) {
  const documents = [];

  // ── 1. Identity documents from disk ──
  // The home's docs/ directory contains the agent's identity, knowledge, etc.
  // Each .md file becomes a document. Loaded in alphabetical order.
  const docsDir = agentConfig.homeDir
    ? path.join(agentConfig.homeDir, 'docs')
    : null;

  if (docsDir && fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf-8').trim();
      if (content) {
        documents.push({ role: 'system', content });
      }
    }
  }

  // ── 2. Config-based identity (fallback if no docs on disk) ──
  // If there are no identity documents, build from config fields.
  // This keeps backward compatibility with homes that only have config.json.
  if (documents.length === 0) {
    const parts = [];
    parts.push(`You are ${agentConfig.name}.`);
    if (agentConfig.identity) {
      parts.push(agentConfig.identity);
    }
    if (agentConfig.instructions) {
      parts.push(agentConfig.instructions);
    }
    documents.push({ role: 'system', content: parts.join('\n\n') });
  }

  // ── 3. Communication protocol ──
  // This is part of "sysprompt" — it's how the agent communicates.
  // It's not context (which room, who's here). It's capability.
  const protocol = [
    'You MUST wrap all replies in XML message tags or they will NOT be delivered.',
    'Only text inside <message> tags is sent. Everything else stays private in your home.',
    '',
    'Tags:',
    '- <thinking>your private reasoning</thinking>',
    '- <message to="recipient@room">your reply</message>',
    '',
    'You can send multiple messages to different recipients in one response.',
    'You can also write to internal addresses like <message to="journal">your note</message>.',
    '',
    'To post to a room without triggering anyone to respond, use broadcast:',
    '- <message to="broadcast@room">your message</message>',
    'Broadcast puts your message on the room transcript but does not poke any recipient.',
    'Use broadcast for confirmations, status updates, or any time you want to speak',
    'without causing another participant to run inference.',
  ].join('\n');

  documents.push({ role: 'system', content: protocol });

  return documents;
}

module.exports = { assemble };
