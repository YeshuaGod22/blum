// ========================================
// ROUTER — v2 — 16 Feb 2026
//
// dispatch(parsedOutput, homeTopology) → results[]
//
// Internal dispatch within the home.
// The router knows the home's internal topology.
//
// Three responsibilities (from spec section 5):
// 1. Write output to the home's transcript (the record of everything)
// 2. Route addressed messages to external rooms
// 3. Route internal addresses (journal, memory, etc.) to home systems
//
// The home's transcript is the most vital component.
// Everything the nucleus produces is recorded here:
// thinking, private text, outbound messages — the full record.
//
// Contract: dispatch(parsedOutput, homeTopology) → sends to destinations
// ========================================

const fs = require('fs');
const path = require('path');

/**
 * Dispatch parsed output to destinations.
 *
 * @param {object} parsedOutput - Output from output-processor.parse()
 * @param {string[]} parsedOutput.thinking - Thinking blocks
 * @param {Array<{to: string, content: string}>} parsedOutput.messages - Addressed messages
 * @param {string} parsedOutput.private - Unmarked text
 * @param {object} homeTopology - The home's internal structure
 * @param {string} homeTopology.name - Agent's friendly name
 * @param {string} homeTopology.homeDir - Path to the home directory
 * @param {object} homeTopology.rooms - Room membership: { roomName: { endpoint } }
 * @param {string} homeTopology.triggeringRoom - Which room triggered this cycle
 * @param {string} homeTopology.nucleusResponse - The full raw response from the nucleus
 * @param {function} homeTopology.log - Operations log function
 * @returns {Promise<Array<{to: string, status: string, error?: string}>>}
 */
async function dispatch(parsedOutput, homeTopology) {
  const results = [];

  // ── 1. Write to the home's transcript ──
  // The transcript is the home's record of everything that happened.
  // Thinking, private text, messages — all recorded here.
  writeToTranscript(parsedOutput, homeTopology);

  // ── 2. Route each addressed message ──
  for (const msg of parsedOutput.messages) {
    const { to, content } = msg;

    // Parse addressing: "name@room" or just a bare name (internal address)
    const atIndex = to.indexOf('@');
    let targetRecipient, targetRoom;

    if (atIndex !== -1) {
      targetRecipient = to.slice(0, atIndex);
      targetRoom = to.slice(atIndex + 1);
    } else {
      // No @ sign — this is an internal address (journal, memory, etc.)
      const internalResult = routeInternal(to, content, homeTopology);
      results.push(internalResult);
      continue;
    }

    // Look up the room endpoint
    const room = homeTopology.rooms[targetRoom];
    if (!room || !room.endpoint) {
      homeTopology.log(`route:no_endpoint to=${to} content_length=${content.length}`);
      results.push({ to, status: 'error', error: `No endpoint for room "${targetRoom}"` });
      continue;
    }

    // POST to room server's message API
    // "broadcast" means: post to the transcript, dispatch nobody.
    // This is how a bot breaks the loop — it speaks to the room
    // without poking any specific recipient into running inference.
    const isBroadcast = targetRecipient === 'broadcast';

    try {
      const body = {
        from: homeTopology.name.toLowerCase(),
        room: targetRoom,
        body: content,
        initiator: homeTopology.name.toLowerCase(),
      };

      if (targetRecipient && !isBroadcast) {
        body.to = targetRecipient.toLowerCase();
      }

      const response = await fetch(room.endpoint + '/api/message/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.error) {
        homeTopology.log(`route:error to=${to} error=${result.error}`);
        results.push({ to, status: 'error', error: result.error });
      } else {
        homeTopology.log(`route:sent to=${to} msgId=${result.msg?.id || '?'}`);
        results.push({ to, status: 'sent', msgId: result.msg?.id });
      }
    } catch (err) {
      homeTopology.log(`route:error to=${to} error=${err.message}`);
      results.push({ to, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * Write the full processing cycle output to the home's transcript.
 * This is the agent's memory of what she thought and said.
 */
function writeToTranscript(parsedOutput, homeTopology) {
  const transcriptDir = path.join(homeTopology.homeDir, 'transcript');
  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true });
  }

  // fittedContext: the exact messages[] sent to the nucleus.
  // Each element has { role, content }. We record them so the
  // context debugger can show exactly what tokens went in.
  const fitted = homeTopology.fittedContext || [];
  const contextSummary = fitted.map((msg, i) => ({
    index: i,
    role: msg.role,
    tokens_est: Math.ceil((msg.content || '').length / 4),
    preview: (msg.content || '').slice(0, 200),
    full: msg.content || '',
  }));

  const entry = {
    ts: new Date().toISOString(),
    room: homeTopology.triggeringRoom,
    thinking: parsedOutput.thinking,
    messages: parsedOutput.messages,
    private: parsedOutput.private || '',
    nucleusResponse: homeTopology.nucleusResponse || null,
    context: {
      messageCount: fitted.length,
      totalTokensEst: contextSummary.reduce((sum, m) => sum + m.tokens_est, 0),
      messages: contextSummary,
    },
  };

  // Append to the transcript log (one JSON object per line, JSONL format)
  const transcriptPath = path.join(transcriptDir, 'home-transcript.jsonl');
  fs.appendFileSync(transcriptPath, JSON.stringify(entry) + '\n');

  homeTopology.log(`route:transcript thinking=${parsedOutput.thinking.length} messages=${parsedOutput.messages.length} private=${(parsedOutput.private || '').length > 0}`);
}

/**
 * Route an internal address to a home system.
 * Internal addresses: journal, memory, etc.
 * These are written to files in the home directory.
 */
function routeInternal(address, content, homeTopology) {
  const internalDir = path.join(homeTopology.homeDir, 'internal');
  if (!fs.existsSync(internalDir)) {
    fs.mkdirSync(internalDir, { recursive: true });
  }

  // Each internal address maps to a file in internal/
  // journal → internal/journal.jsonl
  // memory → internal/memory.jsonl
  const targetPath = path.join(internalDir, `${address}.jsonl`);

  const entry = {
    ts: new Date().toISOString(),
    room: homeTopology.triggeringRoom,
    content,
  };

  fs.appendFileSync(targetPath, JSON.stringify(entry) + '\n');
  homeTopology.log(`route:internal address=${address} content_length=${content.length}`);

  return { to: address, status: 'internal', note: `Written to ${address}` };
}

module.exports = { dispatch };
