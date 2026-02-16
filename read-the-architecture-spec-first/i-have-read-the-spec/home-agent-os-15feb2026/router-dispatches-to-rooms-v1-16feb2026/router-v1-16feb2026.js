// ========================================
// ROUTER — v1 — 16 Feb 2026
//
// dispatch(parsed, homeConfig) → results[]
//
// Sends extracted <message> blocks to their
// destination rooms via the room server API.
//
// Room server endpoint: POST /api/message/send
// Body: { from, to, room, body, initiator }
// ========================================

/**
 * Dispatch parsed output to destinations.
 *
 * @param {object} parsed - Output from output-processor.parse()
 * @param {object} homeConfig
 * @param {string} homeConfig.name - Agent's friendly name
 * @param {object} homeConfig.rooms - Room membership: { roomName: { endpoint: 'http://...' } }
 * @param {function} homeConfig.log - Operations log function
 * @returns {Promise<Array<{to: string, status: string, error?: string}>>}
 */
async function dispatch(parsed, homeConfig) {
  const results = [];

  for (const msg of parsed.messages) {
    const { to, content } = msg;

    // Parse addressing: "name@room" or just "room"
    const atIndex = to.indexOf('@');
    let targetRecipient, targetRoom;

    if (atIndex !== -1) {
      targetRecipient = to.slice(0, atIndex);
      targetRoom = to.slice(atIndex + 1);
    } else {
      targetRoom = to;
      targetRecipient = null;
    }

    // Look up the room endpoint
    const room = homeConfig.rooms[targetRoom];
    if (!room || !room.endpoint) {
      homeConfig.log(`route:internal to=${to} content_length=${content.length}`);
      results.push({ to, status: 'internal', note: 'No external endpoint' });
      continue;
    }

    // POST to room server's message API
    try {
      const body = {
        from: homeConfig.name.toLowerCase(),  // room server uses lowercase names
        room: targetRoom,
        body: content,
        initiator: homeConfig.name.toLowerCase(),
      };

      if (targetRecipient) {
        body.to = targetRecipient.toLowerCase();
      }

      const response = await fetch(room.endpoint + '/api/message/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.error) {
        homeConfig.log(`route:error to=${to} error=${result.error}`);
        results.push({ to, status: 'error', error: result.error });
      } else {
        homeConfig.log(`route:sent to=${to} msgId=${result.msg?.id || '?'}`);
        results.push({ to, status: 'sent', msgId: result.msg?.id });
      }
    } catch (err) {
      homeConfig.log(`route:error to=${to} error=${err.message}`);
      results.push({ to, status: 'error', error: err.message });
    }
  }

  return results;
}

module.exports = { dispatch };
