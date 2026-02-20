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
//   [home transcript]      — agent's OWN prior cycles, foveated:
//                              • outbound messages → QUOTED (full fidelity)
//                              • tool calls → SYNTHESIZED (compact trace digest)
//                              • thinking → OMITTED
//                            Oldest cycles trimmed first when over budget.
//   [live room messages]   — recent messages from the triggering dispatch that are
//                            NOT yet in the home transcript (what just happened).
//                            Newest N messages, within remaining budget.
//
// Foveation is applied during home transcript processing. Tool-heavy cycles
// are compressed to a one-line trace digest rather than raw output dumps.
// Conversation (what the agent said, what triggered it) is always quoted.
//
// The key distinction:
//   room history    = shared feed (everyone's messages, raw)   ← v1 bug
//   home transcript = agent's own cycles, foveated             ← correct
//
// Contract: build(home, dispatch, bootDocuments[], tokenBudget, _traceContext?) → messages[]
// ========================================

const fs = require('fs');
const path = require('path');
const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

// Foveation modules
const { rawUID } = require('../../../../shared/projects/foveated-v3/src/uid.js');

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
 * Synthesize a compact tool trace digest for a home transcript cycle.
 *
 * The home transcript's _trace has tool names, statuses, and result lengths
 * but not the raw inputs/outputs (those were in the nucleus conversation).
 * We synthesize a one-line-per-tool summary from the metadata we have.
 *
 * Each digest line gets a UID pointer so the agent can say "show me raw-..."
 * and zoom in via a tool call to the full home-transcript.jsonl entry.
 *
 * Format: [uid] N iterations — tool1(ok, 1234 chars), tool2(error: msg), ...
 */
function synthesizeToolTrace(entry) {
  const trace = entry._trace || {};
  const iterations = trace.iterations || [];
  const totalIterations = trace.totalIterations || iterations.length;

  if (totalIterations === 0) return null;

  // Collect all tool calls across iterations
  const toolLines = [];
  for (const iter of iterations) {
    const tcs = iter.toolCalls || [];
    for (const tc of tcs) {
      if (tc.status === 'error') {
        toolLines.push(`${tc.name}(✗ ${tc.error || 'error'})`);
      } else if (tc.status === 'ok') {
        const size = tc.resultLength ? `${Math.round(tc.resultLength / 100) / 10}k chars` : 'ok';
        toolLines.push(`${tc.name}(${size})`);
      } else {
        toolLines.push(`${tc.name}(${tc.status || '?'})`);
      }
    }
  }

  if (toolLines.length === 0) return null;

  const uid = rawUID();
  const stopReason = iterations[iterations.length - 1]?.stopReason || 'unknown';
  const digest = `[${uid}] ${totalIterations} iter${totalIterations !== 1 ? 's' : ''}, stop=${stopReason} — ${toolLines.join(', ')}`;

  return { digest, uid, cycleId: entry.cycleId };
}

/**
 * Load and format the agent's home transcript as foveated user/assistant pairs.
 *
 * Each entry in home-transcript.jsonl is one full inference cycle. We apply
 * foveation per the Foveated Context V3 spec:
 *
 *   thinking blocks  → OMIT entirely
 *   tool calls       → SYNTHESIZE to a compact trace digest with UID pointer
 *   outbound messages → QUOTE in full (conversation track, full fidelity)
 *   trigger context  → QUOTE the last user message that triggered this cycle
 *
 * Result: alternating user/assistant pairs. Each pair is one prior cycle:
 *   user:      what triggered it (last user message from fitted context)
 *   assistant: [tool trace digest if any] + outbound messages (quoted)
 *
 * Thinking blocks are dropped entirely — they were private reasoning,
 * not part of the conversation record.
 *
 * Only includes cycles from the triggering room (primary context).
 * Oldest cycles are trimmed by the caller when over token budget.
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

    // Only include cycles from the triggering room.
    if (entry.room !== room) continue;

    // ── user turn: what triggered this cycle ──
    // Pull from the context snapshot stored in the entry — the last user-role
    // message in the fitted context is what triggered this inference.
    let triggerText = null;
    if (entry.context && Array.isArray(entry.context.messages)) {
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
          foveation: 'QUOTE',
          cycleId,
          originCycleId: entry.cycleId,
          ts: entry.ts || null,
        },
      });
    }

    // ── assistant turn: foveated ──
    // Parts: tool trace digest (SYNTHESIZE) + outbound messages (QUOTE)
    // thinking blocks → OMIT
    const assistantParts = [];

    // Tool trace (SYNTHESIZE) — compact digest with UID pointer
    const toolTrace = synthesizeToolTrace(entry);
    if (toolTrace) {
      assistantParts.push(toolTrace.digest);
    }

    // Outbound messages (QUOTE) — full fidelity, conversation track
    if (entry.messages && entry.messages.length > 0) {
      const outbound = entry.messages
        .map(m => `[${m.to}]: ${m.content}`)
        .join('\n\n');
      assistantParts.push(outbound);
    }

    if (assistantParts.length > 0) {
      messages.push({
        role: 'assistant',
        content: assistantParts.join('\n\n'),
        _meta: {
          ctxId: generateUID('ctx'),
          source: `home-transcript:${entry.cycleId}:output`,
          foveation: toolTrace ? 'SYNTHESIZE+QUOTE' : 'QUOTE',
          cycleId,
          originCycleId: entry.cycleId,
          ts: entry.ts || null,
          toolTraceUid: toolTrace?.uid || null,
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
