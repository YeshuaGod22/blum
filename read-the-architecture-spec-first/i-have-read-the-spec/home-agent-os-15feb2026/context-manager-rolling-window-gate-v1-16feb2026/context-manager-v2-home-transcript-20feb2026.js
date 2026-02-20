// ========================================
// CONTEXT MANAGER — v2 — 20 Feb 2026
//
// build(home, dispatch, bootDocuments[], tokenBudget, _traceContext?) → messages[]
//
// FIXES v1: agents were getting raw room history (shared feed, all participants)
// as their "memory". They should get their own home transcript — the cycles
// they ran, what triggered each response, what they said. That's personal memory.
//
// Architecture:
//   [boot docs]            — identity, never trimmed (from boot assembler)
//   [room context]         — where we are, who's here, reply address
//   [home transcript]      — agent's OWN prior cycles, formatted as user/assistant
//                            pairs. This is memory. Oldest trimmed first.
//   [live room messages]   — recent messages from the triggering room that are
//                            NOT yet in the home transcript (i.e. this dispatch).
//                            Newest N messages only, within remaining budget.
//
// The key distinction:
//   room history   = shared feed (everyone's messages, raw)  ← v1 bug
//   home transcript = agent's own cycles (what I said, why)  ← correct
//
// Contract: build(home, dispatch, bootDocuments[], tokenBudget, _traceContext?) → messages[]
// ========================================

const fs = require('fs');
const path = require('path');
const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return sum + estimateTokens(content) + 4;
  }, 0);
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

/**
 * Load and format the agent's home transcript as user/assistant pairs.
 *
 * Each entry in home-transcript.jsonl is one full inference cycle:
 *   - The triggering messages (what caused this cycle to run)
 *   - The agent's output messages (what it said)
 *
 * We format these as alternating user/assistant pairs so the nucleus sees
 * the agent's own conversational history — not the raw room feed.
 *
 * Format:
 *   user:      "[trigger from X@room]: body"      (what triggered the cycle)
 *   assistant: "[Y@room]: body\n[Y@room2]: body"  (what the agent said)
 *
 * We skip the context snapshot stored in the entry (that was the fitted context
 * for that cycle — we're rebuilding context fresh each time).
 */
function loadHomeTranscript(home, room, _traceContext = {}) {
  const cycleId = _traceContext.cycleId || null;
  const transcriptPath = path.join(home.homeDir, 'transcript', 'home-transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return [];

  const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
  const messages = [];

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Only include cycles from the triggering room (primary context).
    // Cross-room cycles would add noise; agent can use tools to fetch other rooms.
    if (entry.room !== room) continue;

    // ── user turn: what triggered this cycle ──
    // The entry doesn't store the raw trigger cleanly, but we can reconstruct
    // the gist from the context snapshot if present, or skip if not.
    // Better: use the dispatchId to find the triggering message body.
    // For now: build a compact summary of what triggered this cycle.
    // The context.messages in the entry contains the full fitted context at that time —
    // we don't replay that, but we can find the last user message before the assistant spoke.
    let triggerText = null;

    if (entry.context && Array.isArray(entry.context.messages)) {
      // Find the last user-role message in the fitted context (the trigger)
      const userMsgs = entry.context.messages.filter(m => m.role === 'user');
      if (userMsgs.length > 0) {
        const last = userMsgs[userMsgs.length - 1];
        triggerText = last.full || last.preview || null;
      }
    }

    if (triggerText) {
      messages.push({
        role: 'user',
        content: triggerText,
        _meta: {
          ctxId: generateUID('ctx'),
          source: `home-transcript:${entry.cycleId}:trigger`,
          cycleId,
          originCycleId: entry.cycleId,
          ts: entry.ts || null,
        },
      });
    }

    // ── assistant turn: what this agent said ──
    if (entry.messages && entry.messages.length > 0) {
      const outbound = entry.messages
        .map(m => `[${m.to}]: ${m.content}`)
        .join('\n\n');
      messages.push({
        role: 'assistant',
        content: outbound,
        _meta: {
          ctxId: generateUID('ctx'),
          source: `home-transcript:${entry.cycleId}:output`,
          cycleId,
          originCycleId: entry.cycleId,
          ts: entry.ts || null,
        },
      });
    }
  }

  return messages;
}

/**
 * Load recent live messages from the room dispatch — messages that arrived
 * in this dispatch and are NOT yet in the home transcript.
 *
 * This is the "what just happened" context: the message that triggered this cycle
 * plus any recent room traffic that preceded it.
 *
 * We use the raw dispatch transcript (not the stored room history file, which
 * is the full shared feed and grows unboundedly).
 */
function loadLiveContext(home, dispatch, _traceContext = {}) {
  const cycleId = _traceContext.cycleId || null;
  const room = dispatch.room;
  const myName = home.config.name;

  // Use the dispatch transcript (what the room server just pushed)
  const incoming = dispatch.transcript || dispatch.messages || [];
  if (!incoming.length) return [];

  // Take the most recent N messages — enough to understand what just happened
  // without flooding context with old room traffic
  const LIVE_WINDOW = 20;
  const recent = incoming.slice(-LIVE_WINDOW);

  return recent.map(entry => {
    const from = entry.from || 'unknown';
    const body = entry.body || entry.content || '';
    const isOwn = from.toLowerCase() === myName.toLowerCase();
    return {
      role: isOwn ? 'assistant' : 'user',
      content: `[${from}@${room}]: ${body}`,
      _meta: {
        ctxId: generateUID('ctx'),
        source: `live:${room}`,
        originalMsgId: entry.id || null,
        from,
        ts: entry.ts || null,
        cycleId,
      },
    };
  });
}

/**
 * Build the full message array for the nucleus.
 *
 * @param {object} home - The home instance
 * @param {object} dispatch - The triggering dispatch
 * @param {Array} bootDocuments - Identity prefix from boot assembler (never trimmed)
 * @param {number} tokenBudget - Maximum total tokens
 * @param {object} [_traceContext] - Traceability context
 * @returns {Array} messages[]
 */
function build(home, dispatch, bootDocuments, tokenBudget, _traceContext = {}) {
  const room = dispatch.room;
  const cycleId = _traceContext.cycleId || null;

  // ── 1. Boot documents — identity, never trimmed ──
  const bootTokens = estimateMessagesTokens(bootDocuments);
  const available = tokenBudget - bootTokens;

  if (available <= 0) {
    return [...bootDocuments];
  }

  // ── 2. Room context — where we are right now ──
  const incoming = dispatch.transcript || dispatch.messages || [];
  const myName = home.config.name;
  const triggerMsg = [...incoming].reverse().find(
    m => m.to === myName && m.from !== myName
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

  const roomContextMsg = {
    role: 'system',
    content: contextLines.join('\n'),
    _meta: {
      ctxId: generateUID('ctx'),
      source: 'context:room-info',
      room,
      dispatchId: _traceContext.dispatchId || null,
      cycleId,
    },
  };

  const roomContextTokens = estimateMessagesTokens([roomContextMsg]);
  const historyBudget = available - roomContextTokens;

  if (historyBudget <= 0) {
    return [...bootDocuments, roomContextMsg];
  }

  // ── 3. Home transcript — personal memory ──
  // The agent's own prior cycles: what triggered each, what it said.
  // This is memory. Oldest trimmed first if over budget.
  const homeTranscriptMessages = loadHomeTranscript(home, room, _traceContext);

  // ── 4. Live room context — what just arrived ──
  // Recent messages from this dispatch. The trigger + surrounding room traffic.
  // We reserve 25% of history budget for this so the agent always sees
  // what just happened, even if memory is full.
  const LIVE_RESERVE = Math.floor(historyBudget * 0.25);
  const MEMORY_BUDGET = historyBudget - LIVE_RESERVE;

  const liveMessages = loadLiveContext(home, dispatch, _traceContext);
  const liveTokens = estimateMessagesTokens(liveMessages);
  const liveActual = Math.min(liveTokens, LIVE_RESERVE);

  // Fit home transcript into memory budget
  const fittedMemory = trimOldest([...homeTranscriptMessages], MEMORY_BUDGET);
  // Fit live context (trim oldest if over reserve; in practice rarely needed)
  const fittedLive = trimOldest([...liveMessages], historyBudget - estimateMessagesTokens(fittedMemory));

  // Order: boot → room context → memory (oldest→newest) → live (oldest→newest)
  // Memory comes first so it reads as prior history; live is what's happening now.
  const result = [...bootDocuments, roomContextMsg, ...fittedMemory, ...fittedLive];

  // Log what we built for traceability
  if (_traceContext) {
    _traceContext._contextSummary = {
      bootDocs: bootDocuments.length,
      roomContext: 1,
      memoryMessages: fittedMemory.length,
      liveMessages: fittedLive.length,
      totalMessages: result.length,
      budgetUsed: estimateMessagesTokens(result),
      budgetTotal: tokenBudget,
    };
  }

  return result;
}

module.exports = { build, estimateTokens, estimateMessagesTokens };
