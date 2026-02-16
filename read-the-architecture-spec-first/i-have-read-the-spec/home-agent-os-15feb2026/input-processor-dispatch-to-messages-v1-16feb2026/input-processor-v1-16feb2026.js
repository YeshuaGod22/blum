// ========================================
// INPUT PROCESSOR — v1 — 16 Feb 2026
//
// process(dispatch, occupantName) → [{role, content}]
//
// Converts a room dispatch (transcript batch)
// into a message array the nucleus can consume.
//
// Handles room server dispatch format:
// { type: 'push', room, roomUID, transcript: [{from, body, ts, ...}] }
// ========================================

/**
 * Process an incoming dispatch into nucleus-ready messages.
 *
 * @param {object} dispatch - The dispatch from a room server
 * @param {string} dispatch.room - Room name
 * @param {Array} dispatch.transcript - Transcript entries from room server
 *   OR dispatch.messages - Alternative format
 * @param {string} occupantName - This home's occupant name
 * @returns {Array<{role: string, content: string}>}
 */
function process(dispatch, occupantName) {
  // Accept both 'transcript' (room server format) and 'messages' (generic format)
  const entries = dispatch.transcript || dispatch.messages;
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  const room = dispatch.room || 'unknown';

  return entries
    .filter(entry => !entry.withdrawn) // skip withdrawn messages
    .map(entry => {
      const from = entry.from || 'unknown';
      // Room server uses 'body', generic format uses 'content'
      const content = entry.body || entry.content || '';
      const isOwnMessage = from.toLowerCase() === occupantName.toLowerCase();

      return {
        role: isOwnMessage ? 'assistant' : 'user',
        content: `[${from}@${room}]: ${content}`,
      };
    });
}

module.exports = { process };
