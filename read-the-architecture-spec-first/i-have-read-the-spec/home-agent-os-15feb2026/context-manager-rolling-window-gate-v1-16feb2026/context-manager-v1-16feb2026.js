// ========================================
// CONTEXT MANAGER — v3 — 16 Feb 2026
//
// build(home, dispatch, bootDocuments[], tokenBudget) → messages[]
//
// The final gate. Part of the home. Has access to everything
// the home knows. Decides what the nucleus should see beyond
// the boot prefix.
//
// Responsibilities:
//   - Room context (which room, who's here, reply address)
//   - Cross-room history (all rooms, prioritise triggering)
//   - Fitting everything within the token budget
//   - The boot documents are identity — never trimmed
//
// "Always present, non-negotiable." — Spec section 5
//
// Contract: build(home, dispatch, bootDocuments[], tokenBudget) → messages[]
// ========================================

const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

/**
 * Build the full message array for the nucleus.
 *
 * @param {object} home - The home instance (has rooms, config, history, etc.)
 * @param {object} dispatch - The triggering dispatch
 * @param {Array<{role: string, content: string}>} bootDocuments - Identity prefix from boot assembler
 * @param {number} tokenBudget - Maximum total tokens
 * @returns {Array<{role: string, content: string}>}
 */
function build(home, dispatch, bootDocuments, tokenBudget) {
  const room = dispatch.room;
  const incoming = dispatch.transcript || dispatch.messages || [];

  // ── 1. Boot documents are identity. Never trimmed. ──
  const bootTokens = estimateMessagesTokens(bootDocuments);
  const available = tokenBudget - bootTokens;

  if (available <= 0) {
    return [...bootDocuments];
  }

  // ── 2. Room context — where the agent is right now ──
  const triggerMsg = [...incoming].reverse().find(
    m => m.to === home.config.name && m.from !== home.config.name
  );

  const contextLines = [];
  contextLines.push(`This dispatch is from room "${room}".`);
  if (triggerMsg) {
    contextLines.push(`To reply, use: <message to="${triggerMsg.from}@${room}">your reply</message>`);
  }
  contextLines.push('');
  contextLines.push('Your rooms:');
  for (const [roomName, roomInfo] of Object.entries(home.rooms)) {
    const participants = roomInfo.participants?.join(', ') || 'unknown';
    const marker = roomName === room ? ' ← this dispatch' : '';
    contextLines.push(`- ${roomName}: ${participants}${marker}`);
  }
  const roomContextMsg = { role: 'system', content: contextLines.join('\n') };
  const contextTokens = estimateMessagesTokens([roomContextMsg]);
  const historyBudget = available - contextTokens;

  if (historyBudget <= 0) {
    return [...bootDocuments, roomContextMsg];
  }

  // ── 3. Conversation history from ALL rooms ──
  // Triggering room gets priority. Other rooms fill remaining space.
  const triggeringHistory = loadRoomHistory(home, room);
  const otherRooms = Object.keys(home.rooms).filter(r => r !== room);
  const otherHistory = [];
  for (const r of otherRooms) {
    const msgs = loadRoomHistory(home, r);
    otherHistory.push(...msgs);
  }

  const triggerTokens = estimateMessagesTokens(triggeringHistory);
  const otherTokens = estimateMessagesTokens(otherHistory);

  let fittedOther, fittedTrigger;

  if (triggerTokens + otherTokens <= historyBudget) {
    // Everything fits
    fittedOther = otherHistory;
    fittedTrigger = triggeringHistory;
  } else {
    // Trim. Give triggering room at least 75% of history budget.
    const trigBudget = Math.floor(historyBudget * 0.75);
    const othBudget = historyBudget - Math.min(triggerTokens, trigBudget);

    fittedOther = trimOldest([...otherHistory], othBudget);
    const remaining = historyBudget - estimateMessagesTokens(fittedOther);
    fittedTrigger = trimOldest([...triggeringHistory], remaining);
  }

  // Order: boot docs, room context, other rooms (background), triggering room (foreground)
  return [...bootDocuments, roomContextMsg, ...fittedOther, ...fittedTrigger];
}

/**
 * Load and format a room's history as nucleus-ready messages.
 */
function loadRoomHistory(home, roomName) {
  const history = home._loadHistory(roomName);
  if (!history || history.length === 0) return [];

  return history
    .filter(entry => !entry.withdrawn)
    .map(entry => {
      const from = entry.from || 'unknown';
      const content = entry.body || entry.content || '';
      const isOwn = from.toLowerCase() === home.config.name.toLowerCase();
      return {
        role: isOwn ? 'assistant' : 'user',
        content: `[${from}@${roomName}]: ${content}`,
      };
    });
}

/**
 * Trim messages from the front (oldest) until they fit within budget.
 */
function trimOldest(messages, budget) {
  while (messages.length > 0 && estimateMessagesTokens(messages) > budget) {
    messages.shift();
  }
  return messages;
}

module.exports = { build, estimateTokens, estimateMessagesTokens };
