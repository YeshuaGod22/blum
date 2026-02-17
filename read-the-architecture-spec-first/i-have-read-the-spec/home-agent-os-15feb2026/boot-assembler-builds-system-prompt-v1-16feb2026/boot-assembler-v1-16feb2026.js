// ========================================
// BOOT ASSEMBLER — v3 — 16 Feb 2026
//
// assemble(agentConfig, history, _traceContext?) → { documents[], tools[] }
//
// Builds the prefix that makes the agent *her*.
// Reads identity documents from the home's docs/ directory.
// Loads tool definitions from the home's tools/ directory.
//
// documents[] is identity — system messages.
// tools[] is capability — tool definitions for the nucleus.
//
// Each document and tool gets a _meta field for traceability.
// _meta is stripped by home.js before sending to the nucleus.
//
// Spec section 5: "builds the prefix (identity docs,
// sysprompt, knowledge). X tokens. Makes the agent her.
// Also loads tool definitions from the home's tools/ directory."
//
// Contract: assemble(agentConfig, history, _traceContext?) → { documents[], tools[] }
// ========================================

const fs = require('fs');
const path = require('path');
const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

/**
 * Assemble identity documents from the agent's home.
 *
 * @param {object} agentConfig - Agent configuration
 * @param {string} agentConfig.name - Agent's friendly name
 * @param {string} agentConfig.homeDir - Path to the home directory
 * @param {string} [agentConfig.identity] - Identity/personality description (from config.json)
 * @param {string} [agentConfig.instructions] - Additional instructions (from config.json)
 * @param {object} history - NOT USED YET. Reserved for future use.
 * @param {object} [_traceContext] - Traceability context (cycleId, etc.)
 * @returns {{ documents: Array<{role: string, content: string, _meta: object}>, tools: Array }} { documents[], tools[] }
 */
function assemble(agentConfig, history, _traceContext = {}) {
  const documents = [];
  const cycleId = _traceContext.cycleId || null;

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
        documents.push({
          role: 'system',
          content,
          _meta: {
            docId: generateUID('doc'),
            source: 'boot:identity',
            file,
            slot: documents.length,
            cycleId,
          },
        });
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
    documents.push({
      role: 'system',
      content: parts.join('\n\n'),
      _meta: {
        docId: generateUID('doc'),
        source: 'boot:config-identity',
        slot: 0,
        cycleId,
      },
    });
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

  documents.push({
    role: 'system',
    content: protocol,
    _meta: {
      docId: generateUID('doc'),
      source: 'boot:protocol',
      slot: documents.length,
      cycleId,
    },
  });

  // ── 4. Tool definitions from disk ──
  // The home's tools/ directory contains tool definitions as JSON files.
  // Each .json file is one tool in Anthropic tool format:
  // { name, description, input_schema }
  // These are capabilities the home grants to the agent.
  const tools = [];
  const toolsDir = agentConfig.homeDir
    ? path.join(agentConfig.homeDir, 'tools')
    : null;

  if (toolsDir && fs.existsSync(toolsDir)) {
    const files = fs.readdirSync(toolsDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      try {
        const toolDef = JSON.parse(
          fs.readFileSync(path.join(toolsDir, file), 'utf-8')
        );
        if (toolDef.name) {
          tools.push({
            ...toolDef,
            _meta: { file, cycleId },
          });
        }
      } catch (e) {
        // Skip malformed tool definitions
      }
    }
  }

  return { documents, tools };
}

module.exports = { assemble };
