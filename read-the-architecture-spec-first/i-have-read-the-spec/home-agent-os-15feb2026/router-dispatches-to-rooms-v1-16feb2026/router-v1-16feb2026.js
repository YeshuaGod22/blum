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
// Each entry carries full traceability metadata (_trace, UIDs).
//
// Contract: dispatch(parsedOutput, homeTopology) → sends to destinations
// ========================================

const fs = require('fs');
const path = require('path');
const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

/**
 * Dispatch parsed output to destinations.
 *
 * @param {object} parsedOutput - Output from output-processor.parse()
 * @param {string} parsedOutput.parseId - UID for this parse result
 * @param {Array<{blockId: string, content: string}>} parsedOutput.thinking - Thinking blocks
 * @param {Array<{blockId: string, to: string, content: string}>} parsedOutput.messages - Addressed messages
 * @param {string} parsedOutput.private - Unmarked text
 * @param {object} homeTopology - The home's internal structure
 * @param {string} homeTopology.name - Agent's friendly name
 * @param {string} homeTopology.homeDir - Path to the home directory
 * @param {object} homeTopology.rooms - Room membership: { roomName: { endpoint } }
 * @param {string} homeTopology.triggeringRoom - Which room triggered this cycle
 * @param {string} homeTopology.nucleusResponse - The full raw response from the nucleus
 * @param {Array} homeTopology.fittedContext - The exact messages[] sent to the nucleus
 * @param {object} [homeTopology._traceContext] - Traceability context
 * @param {function} homeTopology.log - Operations log function
 * @returns {Promise<Array<{to: string, status: string, error?: string}>>}
 */
async function dispatch(parsedOutput, homeTopology) {
  const results = [];
  const _traceContext = homeTopology._traceContext || {};

  // ── 1. Write to the home's transcript ──
  // The transcript is the home's record of everything that happened.
  // Thinking, private text, messages — all recorded here.
  writeToTranscript(parsedOutput, homeTopology);

  // ── 2. Route each addressed message ──
  for (const msg of parsedOutput.messages) {
    const { to, content, blockId } = msg;

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
        results.push({ to, status: 'error', error: result.error, blockId });
      } else {
        homeTopology.log(`route:sent to=${to} msgId=${result.msg?.id || '?'} blockId=${blockId || '-'}`);
        results.push({
          to,
          status: 'sent',
          msgId: result.msg?.id,
          blockId: blockId || null,
          cycleId: _traceContext.cycleId || null,
        });
      }
    } catch (err) {
      homeTopology.log(`route:error to=${to} error=${err.message}`);
      results.push({ to, status: 'error', error: err.message, blockId });
    }
  }

  return results;
}

/**
 * Write the full processing cycle output to the home's transcript.
 * This is the agent's memory of what she thought and said.
 * Each entry carries full traceability metadata.
 *
 * nucleusMessages (homeTopology.nucleusMessages) is the complete conversation
 * as the nucleus saw it — the fitted context PLUS every assistant content block
 * and every tool result appended during the tool loop. This is the ground truth:
 * maximum detail, nothing stripped. Foveation happens at READ time (context
 * manager), never at WRITE time. The JSONL is the permanent raw record.
 */
function writeToTranscript(parsedOutput, homeTopology) {
  const transcriptDir = path.join(homeTopology.homeDir, 'transcript');
  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true });
  }

  const _traceContext = homeTopology._traceContext || {};

  // fittedContext: the messages[] sent to the nucleus at the START of the cycle
  // (before any tool calls). Recorded for context debugging.
  const fitted = homeTopology.fittedContext || [];
  const contextSummary = fitted.map((msg, i) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return {
      index: i,
      role: msg.role,
      tokens_est: Math.ceil(content.length / 4),
      preview: content.slice(0, 200),
      full: content,
      _meta: msg._meta || null,
    };
  });

  // nucleusMessages: the FULL conversation post-tool-loop — everything the nucleus
  // ever saw in this cycle, including all assistant turns and tool results.
  // This is what makes zoom-in on UID pointers possible. Written verbatim.
  // _meta fields are stripped (they're internal routing metadata, not content).
  const nucleusMessages = (homeTopology.nucleusMessages || []).map((msg, i) => {
    const { _meta, ...clean } = msg;
    const content = typeof clean.content === 'string' ? clean.content : JSON.stringify(clean.content);
    return {
      index: i,
      role: clean.role,
      tokens_est: Math.ceil(content.length / 4),
      content: clean.content, // full content, no truncation
    };
  });

  const entryId = generateUID('entry');
  const entry = {
    entryId,
    cycleId: _traceContext.cycleId || null,
    dispatchId: _traceContext.dispatchId || null,
    ts: new Date().toISOString(),
    room: homeTopology.triggeringRoom,
    parseId: parsedOutput.parseId || null,
    thinking: parsedOutput.thinking,
    messages: parsedOutput.messages,
    private: parsedOutput.private || '',
    nucleusResponse: homeTopology.nucleusResponse || null,
    // Full nucleus conversation post-tool-loop: fitted context + all tool turns.
    // Ground truth. Never trimmed. Foveation happens at read time only.
    nucleusMessages: {
      totalMessages: nucleusMessages.length,
      totalTokensEst: nucleusMessages.reduce((sum, m) => sum + m.tokens_est, 0),
      messages: nucleusMessages,
    },
    _trace: {
      agentName: _traceContext.agentName || null,
      dispatchId: _traceContext.dispatchId || null,
      cycleId: _traceContext.cycleId || null,
      finalResponseId: _traceContext.finalResponseId || null,
      totalIterations: _traceContext.totalIterations || 0,
      iterations: _traceContext.iterations || [],
      startedAt: _traceContext.startedAt || null,
      completedAt: new Date().toISOString(),
    },
    // fittedContext: what went IN at cycle start (pre-tool-loop snapshot).
    // Kept for context debugging — shows what the agent knew before it started.
    context: {
      messageCount: fitted.length,
      totalTokensEst: contextSummary.reduce((sum, m) => sum + m.tokens_est, 0),
      messages: contextSummary,
    },
  };

  // Append to the transcript log (one JSON object per line, JSONL format)
  const transcriptPath = path.join(transcriptDir, 'home-transcript.jsonl');
  fs.appendFileSync(transcriptPath, JSON.stringify(entry) + '\n');

  homeTopology.log(`route:transcript entryId=${entryId} cycleId=${_traceContext.cycleId || '-'} thinking=${parsedOutput.thinking.length} messages=${parsedOutput.messages.length} nucleusMessages=${nucleusMessages.length} private=${(parsedOutput.private || '').length > 0}`);
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

  const _traceContext = homeTopology._traceContext || {};
  const entryId = generateUID('entry');

  // Each internal address maps to a file in internal/
  // journal → internal/journal.jsonl
  // memory → internal/memory.jsonl
  const targetPath = path.join(internalDir, `${address}.jsonl`);

  const entry = {
    entryId,
    cycleId: _traceContext.cycleId || null,
    ts: new Date().toISOString(),
    room: homeTopology.triggeringRoom,
    content,
  };

  fs.appendFileSync(targetPath, JSON.stringify(entry) + '\n');
  homeTopology.log(`route:internal address=${address} entryId=${entryId} cycleId=${_traceContext.cycleId || '-'}`);

  return { to: address, status: 'internal', entryId };
}

module.exports = { dispatch };
