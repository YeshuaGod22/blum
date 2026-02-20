// ========================================
// CONTEXT MANAGER — v4 (Foveated) — 20 Feb 2026
//
// build(home, dispatch, bootDocuments[], tokenBudget, _traceContext?) → messages[]
//
// NOW WITH TWO-TRACK FOVEATED COMPRESSION:
// - Conversation track: QUOTED (full fidelity)
// - Tool track: SYNTHESIZED (compressed with UID pointers)
//
// The final gate. Part of the home. Has access to everything
// the home knows. Decides what the nucleus should see beyond
// the boot prefix.
//
// "Always present, non-negotiable." — Spec section 5
// ========================================

const fs = require('fs');
const path = require('path');
const { generateUID } = require('../../shared-uid-generator/generate-uid.js');

// Import foveated modules
let foveatedEnabled = false;
let classifier, summarizer, uidGenerator, zoom;

try {
  const foveatedPath = path.join(__dirname, '../../../shared/projects/foveated-v3/src');
  if (fs.existsSync(foveatedPath)) {
    classifier = require(path.join(foveatedPath, 'classifier.js'));
    summarizer = require(path.join(foveatedPath, 'summarizer.js'));
    uidGenerator = require(path.join(foveatedPath, 'uid.js'));
    zoom = require(path.join(foveatedPath, 'zoom.js'));
    foveatedEnabled = true;
    console.log('[context-manager] Foveated V3 modules loaded');
  }
} catch (e) {
  console.log('[context-manager] Foveated modules not available, using default compression');
}

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
 * Compress tool output using foveated summarization.
 * Returns { compressed: string, uid: string } or null if no compression needed.
 */
function compressToolOutput(toolName, input, output, rawJsonlPath) {
  if (!foveatedEnabled) return null;
  
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  
  // Small outputs don't need compression
  if (outputStr.length < 200) return null;
  
  // Generate UID for this tool call
  const uid = uidGenerator.rawUID();
  
  // Store raw output for later zoom-in (append to raw JSONL)
  if (rawJsonlPath) {
    const rawEntry = {
      uid,
      type: 'tool_output',
      tool: toolName,
      input,
      output,
      ts: Date.now()
    };
    fs.appendFileSync(rawJsonlPath, JSON.stringify(rawEntry) + '\n');
  }
  
  // Summarize based on tool type
  let summary;
  switch (toolName) {
    case 'shell_exec':
      const result = typeof output === 'object' ? output : { stdout: output };
      const lines = (result.stdout || '').split('\n').length;
      const exitCode = result.exit_code ?? 0;
      if (exitCode === 0) {
        summary = `[${uid}] Ran '${input.command}': ${lines} lines output, exit 0`;
      } else {
        summary = `[${uid}] Ran '${input.command}': exit ${exitCode}, error: ${(result.stderr || '').slice(0, 100)}`;
      }
      break;
      
    case 'read_file':
      const fileLines = outputStr.split('\n').length;
      const preview = outputStr.slice(0, 80).replace(/\n/g, ' ');
      summary = `[${uid}] Read '${input.path}': ${fileLines} lines. Starts: "${preview}..."`;
      break;
      
    case 'web_fetch':
      const contentLen = outputStr.length;
      const contentPreview = outputStr.slice(0, 100).replace(/\n/g, ' ');
      summary = `[${uid}] Fetched '${input.url}': ${contentLen} chars. Content: "${contentPreview}..."`;
      break;
      
    case 'web_search':
      const results = output?.results || [];
      summary = `[${uid}] Searched '${input.query}': ${results.length} results. Top: ${results[0]?.title || 'none'}`;
      break;
      
    case 'qmd_search':
      const qmdResults = output?.result?.content?.[0]?.text || 'no results';
      summary = `[${uid}] QMD search '${input.query}': ${qmdResults.slice(0, 100)}...`;
      break;
      
    default:
      summary = `[${uid}] ${toolName}: ${outputStr.slice(0, 150)}...`;
  }
  
  return { compressed: summary, uid };
}

/**
 * Build the full message array for the nucleus.
 * NOW WITH FOVEATED COMPRESSION.
 */
function build(home, dispatch, bootDocuments, tokenBudget, _traceContext = {}) {
  const room = dispatch.room;
  const incoming = dispatch.transcript || dispatch.messages || [];
  const cycleId = _traceContext.cycleId || null;
  
  // Path to raw JSONL for storing full tool outputs
  const rawJsonlPath = path.join(home.homeDir, 'history', 'raw-tool-outputs.jsonl');

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
  
  // Add foveated context info if enabled
  if (foveatedEnabled) {
    contextLines.push('');
    contextLines.push('[Foveated Context V3 active: Tool outputs are compressed with [uid] markers. Say "zoom uid:XXX" to expand.]');
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
      foveated: foveatedEnabled,
    },
  };
  const contextTokens = estimateMessagesTokens([roomContextMsg]);
  const historyBudget = available - contextTokens;

  if (historyBudget <= 0) {
    return [...bootDocuments, roomContextMsg];
  }

  // ── 3. Load and process conversation history ──
  // Apply foveated compression to tool outputs
  const triggeringHistory = loadRoomHistoryFoveated(home, room, rawJsonlPath, _traceContext);
  const otherRooms = Object.keys(home.rooms).filter(r => r !== room);
  const otherHistory = [];
  for (const r of otherRooms) {
    const msgs = loadRoomHistoryFoveated(home, r, rawJsonlPath, _traceContext);
    otherHistory.push(...msgs);
  }

  const triggerTokens = estimateMessagesTokens(triggeringHistory);
  const otherTokens = estimateMessagesTokens(otherHistory);

  let fittedOther, fittedTrigger;

  if (triggerTokens + otherTokens <= historyBudget) {
    fittedOther = otherHistory;
    fittedTrigger = triggeringHistory;
  } else {
    const trigBudget = Math.floor(historyBudget * 0.75);
    const othBudget = historyBudget - Math.min(triggerTokens, trigBudget);

    fittedOther = trimOldest([...otherHistory], othBudget);
    const remaining = historyBudget - estimateMessagesTokens(fittedOther);
    fittedTrigger = trimOldest([...triggeringHistory], remaining);
  }

  return [...bootDocuments, roomContextMsg, ...fittedOther, ...fittedTrigger];
}

/**
 * Load room history with foveated compression applied.
 * - Conversation messages: QUOTED (full fidelity)
 * - Tool results: SYNTHESIZED (compressed with UID pointers)
 */
function loadRoomHistoryFoveated(home, roomName, rawJsonlPath, _traceContext = {}) {
  const history = home._loadHistory(roomName);
  if (!history || history.length === 0) return [];
  const cycleId = _traceContext.cycleId || null;

  return history
    .filter(entry => !entry.withdrawn)
    .map(entry => {
      const from = entry.from || 'unknown';
      let content = entry.body || entry.content || '';
      const isOwn = from.toLowerCase() === home.config.name.toLowerCase();
      
      // Check if this is a tool result that should be compressed
      if (foveatedEnabled && entry._toolResult) {
        const compressed = compressToolOutput(
          entry._toolResult.name,
          entry._toolResult.input,
          content,
          rawJsonlPath
        );
        if (compressed) {
          content = compressed.compressed;
        }
      }
      
      return {
        role: isOwn ? 'assistant' : 'user',
        content: `[${from}@${roomName}]: ${content}`,
        _meta: {
          ctxId: generateUID('ctx'),
          source: `history:${roomName}`,
          originalMsgId: entry.id || null,
          from,
          ts: entry.ts || null,
          cycleId,
          foveated: foveatedEnabled && entry._toolResult ? true : undefined,
        },
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

/**
 * Zoom in on a UID to get full content.
 * Call this when user says "zoom uid:XXX" or "show me uid:XXX"
 */
function zoomIn(uid, rawJsonlPath) {
  if (!fs.existsSync(rawJsonlPath)) return null;
  
  const lines = fs.readFileSync(rawJsonlPath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.uid === uid) {
        return entry;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

module.exports = { 
  build, 
  estimateTokens, 
  estimateMessagesTokens,
  compressToolOutput,
  zoomIn,
  foveatedEnabled: () => foveatedEnabled
};
