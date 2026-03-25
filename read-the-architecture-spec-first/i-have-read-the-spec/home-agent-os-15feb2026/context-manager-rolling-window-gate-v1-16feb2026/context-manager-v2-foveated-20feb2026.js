// ========================================
// CONTEXT MANAGER — v4 (Foveated) — 20 Feb 2026
//
// build(home, dispatch, bootDocuments[], tokenBudget, _traceContext?) → messages[]
//
// NOW WITH TWO-TRACK FOVEATED COMPRESSION:
// - Conversation track: QUOTED (full fidelity)
// - Tool track: SYNTHESIZED (compressed with UID pointers)
//
// Memory layer: homelogfull (agent's OWN prior cycles), inserted between
// boot docs and live room messages. Oldest cycles trimmed first.
//
// Architecture:
//   [boot docs]      — identity, never trimmed
//   [room context]   — where we are, reply address
//   [homelogfull]    — agent's OWN prior cycles, foveated personal memory
//   [live messages]  — new messages since last cycle (from dispatch)
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

// Import dedup module (fail-open: dedup is optional)
let extractSeenIdsFromHome = null;
try {
  const dedupPath = path.join(__dirname, '../../../shared/projects/foveated-v3/src/extract-seen-ids.js');
  if (fs.existsSync(dedupPath)) {
    const dedupModule = require(dedupPath);
    extractSeenIdsFromHome = dedupModule.extractSeenIdsFromHome;
    console.log('[context-manager] Dedup module loaded');
  }
} catch (e) {
  console.log('[context-manager] Dedup module not available, dedup disabled');
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

    case 'git_status':
      summary = `[${uid}] Git status for '${output?.repo_path || input.repo_path}': branch=${output?.branch || 'unknown'}, ahead=${output?.ahead ?? 0}, behind=${output?.behind ?? 0}, clean=${output?.is_clean ?? 'unknown'}`;
      break;

    case 'git_commit_exists':
      summary = `[${uid}] Git commit check '${input.rev}': exists=${output?.exists === true} ${output?.subject ? `subject="${String(output.subject).slice(0, 80)}"` : ''}`.trim();
      break;

    case 'git_push':
      if (output?.ok) {
        summary = `[${uid}] Git push for '${output?.repo_path || input.repo_path}': pushed=${output?.pushed_commits ?? 'unknown'}, branch=${output?.branch || 'unknown'}`;
      } else {
        summary = `[${uid}] Git push for '${output?.repo_path || input.repo_path}': failed code=${output?.code || 'unknown'} error=${(output?.error || '').slice(0, 100)}`;
      }
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
 * Synthesize a compact tool trace digest for a homelogfull cycle.
 *
 * The homelogfull's _trace has tool names, statuses, and result lengths.
 * We produce a one-line-per-tool summary with a UID pointer for zoom-in.
 *
 * Format: [uid] N iters, stop=reason — tool1(1.2k chars), tool2(✗ err), ...
 */
function synthesizeToolTrace(entry) {
  const trace = entry._trace || {};
  const iterations = trace.iterations || [];
  const totalIterations = trace.totalIterations || iterations.length;

  if (totalIterations === 0) return null;

  const toolLines = [];
  for (const iter of iterations) {
    const tcs = iter.toolCalls || [];
    for (const tc of tcs) {
      if (tc.status === 'error') {
        toolLines.push(`${tc.name}(✗ ${tc.error || 'error'})`);
      } else if (tc.status === 'ok') {
        const size = tc.resultLength ? `${Math.round(tc.resultLength / 100) / 10}k chars` : 'ok';
        toolLines.push(`${tc.name}(${size})`);
      } else if (tc.status === 'pending') {
        toolLines.push(`${tc.name}(pending)`);
      } else {
        toolLines.push(`${tc.name}(?)`);
      }
    }
  }

  if (toolLines.length === 0) return null;

  // Generate a raw UID for this digest so the agent can request zoom-in
  let uid;
  if (foveatedEnabled && uidGenerator) {
    uid = uidGenerator.rawUID();
  } else {
    uid = `raw-${entry.ts ? entry.ts.replace(/[^0-9]/g, '').slice(0, 14) : Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const stopReason = trace.totalIterations
    ? (iterations[iterations.length - 1]?.stopReason || 'unknown')
    : 'unknown';
  const digest = `[${uid}] ${totalIterations} iter${totalIterations !== 1 ? 's' : ''}, stop=${stopReason} — ${toolLines.join(', ')}`;

  return { digest, uid, cycleId: entry.cycleId };
}

// ============================================================
// HOMELOGFULL CONTEXT PROCESSOR — Three-Zone Foveated Memory
// Spec: /tmp/homelogfull-context-processor-spec.md (2026-02-22)
//
// Zone 1 (Foveal)      — last 3 cycles: thinking synth + full tool trail + full outbound
// Zone 2 (Parafoveal)  — cycles 4-12:   one-line thinking + tool counts + outbound truncated
// Zone 3 (Peripheral)  — cycles 13+:    one line per cycle, batched into single message
// ============================================================

/**
 * Read all homelogfull entries for a given room, returning oldest-first.
 */
function readHomelogEntries(homelogPath, room) {
  let lines;
  try {
    lines = fs.readFileSync(homelogPath, 'utf-8').trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
  const entries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.room === room) entries.push(entry);
    } catch {
      // skip malformed lines
    }
  }
  return entries; // oldest-first (file order)
}

/**
 * Extract the key judgment sentence from a thinking block (or combined thinking text).
 * Heuristic: look for decision language in the last 40% of sentences; fall back to last sentence.
 */
function extractKeyJudgment(text, maxLength = 150) {
  if (!text || text.trim().length === 0) return '(no thinking recorded)';

  // Split into sentences (rough)
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length === 0) return text.trim().slice(0, maxLength);

  // Look for decision language in last 40% of sentences
  const startIdx = Math.floor(sentences.length * 0.6);
  const candidateSentences = sentences.slice(startIdx);

  const decisionKeywords = /\bI will\b|\bI should\b|\bI decided\b|\bThe best\b|\bI need to\b|\bThis means\b|\bI'll\b|\bconclud|\bdecided\b|\bchose\b|\bshould\b|\bneed to\b/i;

  for (const sentence of candidateSentences) {
    if (decisionKeywords.test(sentence) && sentence.trim().length > 10) {
      return sentence.trim().slice(0, maxLength);
    }
  }

  // Fallback: last meaningful sentence
  const lastMeaningful = [...sentences].reverse().find(s => s.trim().length > 20);
  return (lastMeaningful || sentences[sentences.length - 1] || text).trim().slice(0, maxLength);
}

/**
 * Extract triggering user message from homelogfull entry (last user message in context snapshot).
 */
function extractTriggerMessage(entry) {
  const ctxMsgs = entry.context?.messages || [];
  for (let i = ctxMsgs.length - 1; i >= 0; i--) {
    if (ctxMsgs[i].role === 'user') {
      return ctxMsgs[i].full || ctxMsgs[i].preview || null;
    }
  }
  return null;
}

/**
 * Classify cycle type using Minsky frame labels.
 * Per spec task description (simplified):
 *   toolCalls.length > 3 AND nucleusResponse includes outbound → "Research+Writing"
 *   toolCalls.length > 3 → "Research"
 *   outbound messages only (no tools) → "Writing/Conversation"
 *   else → "Mixed"
 */
function classifyCycleType(entry) {
  const allToolCalls = (entry._trace?.iterations || [])
    .flatMap(it => it.toolCalls || []);
  const totalTools = allToolCalls.length;
  const hasOutbound = (entry.messages || []).length > 0;

  if (totalTools === 0) {
    return 'Conversation';
  }
  if (totalTools > 3 && hasOutbound) {
    return 'Research+Writing';
  }
  if (totalTools > 3) {
    return 'Research';
  }
  if (hasOutbound && totalTools <= 3) {
    return 'Writing/Conversation';
  }
  return 'Mixed';
}

/**
 * Assign a trace marker (◇◆●★) to a homelogfull entry.
 * Per spec task description:
 *   ◇ first entry for this room
 *   ◆ cycle with >5 tool calls (significant work)
 *   ★ cycle where nucleusResponse length > 2000 (substantial output)
 *   ● everything else
 *
 * seenFirstType: Set of strings tracking what's been seen — "room:NAME", "contact:NAME"
 * isFirst: boolean — whether this is the very first cycle processed (for ◇)
 */
function assignMarker(entry, seenFirstTypes) {
  const roomKey = `room:${entry.room}`;
  if (!seenFirstTypes.has(roomKey)) {
    seenFirstTypes.add(roomKey);
    return '◇';
  }

  const totalToolCalls = (entry._trace?.iterations || [])
    .reduce((sum, iter) => sum + (iter.toolCalls?.length || 0), 0);

  const nucleusLen = (entry.nucleusResponse || '').length;

  if (nucleusLen > 2000) return '★';
  if (totalToolCalls > 5) return '◆';
  return '●';
}

/**
 * Compute zone token budgets from total homelogfull budget.
 */
function computeZoneBudgets(homelogBudget) {
  const fovealMax = Math.min(Math.floor(homelogBudget * 0.50), 4000);
  const parafovealMax = Math.min(Math.floor(homelogBudget * 0.35), 2800);
  const peripheralMax = homelogBudget - fovealMax - parafovealMax;
  return { fovealMax, parafovealMax, peripheralMax };
}

/**
 * Estimate token cost for foveal rendering of one entry.
 */
function estimateFovealCost(entry) {
  const triggerText = extractTriggerMessage(entry) || '';
  const triggerTokens = estimateTokens(triggerText);

  const thinkingBlocks = (entry.thinking || []).length;
  const thinkingTokens = thinkingBlocks * 35;

  const totalToolCalls = (entry._trace?.iterations || [])
    .reduce((s, it) => s + (it.toolCalls?.length || 0), 0);
  const trailTokens = 20 + totalToolCalls * 8;

  const msgTokens = (entry.messages || [])
    .reduce((s, m) => s + estimateTokens(m.content || ''), 0);

  const overheadTokens = 30;

  return Math.ceil((triggerTokens + thinkingTokens + trailTokens + msgTokens + overheadTokens) * 1.1);
}

/**
 * Estimate token cost for parafoveal rendering of one entry.
 */
function estimateParafovealCost(entry) {
  const toolCalls = (entry._trace?.iterations || [])
    .reduce((s, it) => s + (it.toolCalls?.length || 0), 0);
  const msgChars = (entry.messages || [])
    .reduce((s, m) => s + (m.content || '').length, 0);

  return Math.ceil((60 + toolCalls * 5 + Math.min(msgChars / 4, 80)) * 1.1);
}

/**
 * Assign zone to each entry (foveal/parafoveal/peripheral).
 * Works newest-to-oldest, filling zone budgets.
 */
function assignZones(entries, fovealMax, parafovealMax) {
  const foveal = [];
  const parafoveal = [];
  const peripheral = [];

  let fovealTokens = 0;
  let parafovealTokens = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];

    if (foveal.length < 3) {
      const cost = estimateFovealCost(entry);
      if (fovealTokens + cost <= fovealMax) {
        foveal.unshift(entry);
        fovealTokens += cost;
        continue;
      }
    }

    if (parafoveal.length < 9) {
      const cost = estimateParafovealCost(entry);
      if (parafovealTokens + cost <= parafovealMax) {
        parafoveal.unshift(entry);
        parafovealTokens += cost;
        continue;
      }
    }

    peripheral.unshift(entry);
  }

  return { foveal, parafoveal, peripheral };
}

/**
 * Render foveal zone — returns [userMsg, assistantMsg] pair.
 */
function renderFoveal(entry, marker, cycleId) {
  const ts = entry.ts ? entry.ts.slice(0, 19).replace('T', ' ') + 'Z' : 'unknown';

  // Triggering user turn
  const triggerText = extractTriggerMessage(entry) || '(trigger unavailable)';

  // Thinking synthesis
  const thinkingBlocks = entry.thinking || [];
  let thinkingSummary = null;
  if (thinkingBlocks.length > 0) {
    const thinkingLines = thinkingBlocks.map((blk, idx) => {
      const judgment = extractKeyJudgment(blk.content || '', 150);
      return `  Block ${idx + 1}: "${judgment}"`;
    });
    thinkingSummary = `${marker} Thinking (${thinkingBlocks.length} block${thinkingBlocks.length !== 1 ? 's' : ''}):\n${thinkingLines.join('\n')}`;
  }

  // Tool trail
  const iters = entry._trace?.iterations || [];
  let trailText = null;
  if (iters.length > 0) {
    const totalTools = iters.reduce((s, it) => s + (it.toolCalls?.length || 0), 0);
    const trailLines = [`Tool trail: ${iters.length} iter${iters.length !== 1 ? 's' : ''}, ${totalTools} tool call${totalTools !== 1 ? 's' : ''}`];
    for (const iter of iters) {
      const toolNames = (iter.toolCalls || []).map(tc => tc.name).join(', ');
      const stop = iter.stopReason || '?';
      trailLines.push(`  iter ${iter.number}: ${toolNames || '(no tools)'} → stop=${stop}`);
    }
    trailText = trailLines.join('\n');
  }

  // Outbound messages (full)
  const outboundLines = (entry.messages || []).map(m => `→ [${m.to}]: ${m.content}`);

  // Compose assistant content
  const parts = [`--- [${marker} CYCLE ${entry.cycleId} | ${ts} | ${entry.room}] ---`];
  if (thinkingSummary) parts.push(thinkingSummary);
  if (trailText) parts.push(trailText);
  if (outboundLines.length > 0) parts.push(outboundLines.join('\n\n'));
  if (parts.length === 1) parts.push('(no output recorded)');

  return [
    {
      role: 'user',
      content: triggerText,
      _meta: {
        ctxId: generateUID('ctx'),
        source: `homelogfull:${entry.cycleId}:trigger`,
        zone: 'foveal',
        marker,
        originCycleId: entry.cycleId,
        ts: entry.ts || null,
        cycleId: cycleId || null,
      },
    },
    {
      role: 'assistant',
      content: parts.join('\n\n'),
      _meta: {
        ctxId: generateUID('ctx'),
        source: `homelogfull:${entry.cycleId}:output`,
        zone: 'foveal',
        marker,
        originCycleId: entry.cycleId,
        ts: entry.ts || null,
        cycleId: cycleId || null,
      },
    },
  ];
}

/**
 * Render parafoveal zone — returns single assistant message.
 */
function renderParafoveal(entry, marker, cycleId) {
  const ts = entry.ts ? entry.ts.slice(0, 19).replace('T', ' ') + 'Z' : 'unknown';

  const totalIters = entry._trace?.totalIterations || 0;
  const allToolCalls = (entry._trace?.iterations || []).flatMap(it => it.toolCalls || []);

  // Deduplicate and count tool calls
  const toolCounts = {};
  for (const tc of allToolCalls) {
    toolCounts[tc.name] = (toolCounts[tc.name] || 0) + 1;
  }
  const toolSummary = Object.entries(toolCounts)
    .map(([name, count]) => count > 1 ? `${name}×${count}` : name)
    .join(', ');

  const cycleType = classifyCycleType(entry);

  // Thinking → one sentence total
  const allThinkingText = (entry.thinking || []).map(b => b.content || '').join(' ');
  const thinkingLine = allThinkingText.length > 0
    ? `\n  Reasoning: ${extractKeyJudgment(allThinkingText, 200)}`
    : '';

  // Trigger (first 100 chars)
  const triggerMsg = extractTriggerMessage(entry);
  const triggerLine = triggerMsg
    ? `\n  Trigger: "${triggerMsg.slice(0, 100).replace(/\n/g, ' ')}${triggerMsg.length > 100 ? '...' : ''}"`
    : '';

  // Outbound messages (first line + char count)
  const msgs = entry.messages || [];
  const outboundLine = msgs.length > 0
    ? '\n  ' + msgs.map(m => {
        const preview = (m.content || '').slice(0, 80).replace(/\n/g, ' ');
        const totalLen = (m.content || '').length;
        return `→ [${m.to}] "${preview}${totalLen > 80 ? '...' : ''}" (${totalLen} chars)`;
      }).join('\n  ')
    : '';

  const toolLine = toolSummary ? `\n  Tools: ${toolSummary}` : '';

  const content = `${marker} [${entry.cycleId} | ${ts}] — ${cycleType} (${totalIters} iter${totalIters !== 1 ? 's' : ''}${allToolCalls.length > 0 ? `, ${allToolCalls.length} tools` : ''})${triggerLine}${thinkingLine}${toolLine}${outboundLine}`;

  return {
    role: 'assistant',
    content,
    _meta: {
      ctxId: generateUID('ctx'),
      source: `homelogfull:${entry.cycleId}`,
      zone: 'parafoveal',
      marker,
      originCycleId: entry.cycleId,
      ts: entry.ts || null,
      cycleId: cycleId || null,
    },
  };
}

/**
 * Render peripheral zone — all entries batched into ONE assistant message.
 */
function renderPeripheral(entries, markerMap, cycleId) {
  const lines = entries.map(entry => {
    const ts = entry.ts ? entry.ts.slice(0, 16).replace('T', ' ') + 'Z' : 'unknown';
    const marker = markerMap.get(entry.cycleId) || '●';
    const totalIters = entry._trace?.totalIterations || 0;
    const totalTools = (entry._trace?.iterations || [])
      .reduce((s, it) => s + (it.toolCalls?.length || 0), 0);
    const msgCount = (entry.messages || []).length;
    const cycleType = classifyCycleType(entry);

    // Get first 60 chars of nucleusResponse or outbound message per spec task
    const firstOutbound = (entry.messages || [])[0]?.content || entry.nucleusResponse || '';
    const preview = firstOutbound.slice(0, 60).replace(/\n/g, ' ');
    const previewStr = preview ? ` → "${preview}${firstOutbound.length > 60 ? '...' : ''}"` : '';

    let line = `${marker} [${ts}] ${entry.room} | ${cycleType}`;
    if (totalIters > 0) line += ` (${totalIters} iters`;
    if (totalTools > 0) line += `, ${totalTools} tools`;
    if (totalIters > 0) line += ')';
    if (msgCount > 0) line += ` → ${msgCount} msg${msgCount !== 1 ? 's' : ''}`;
    if (previewStr) line += previewStr;

    return line;
  });

  return {
    role: 'assistant',
    content: `Prior cycles (oldest first):\n${lines.join('\n')}`,
    _meta: {
      ctxId: generateUID('ctx'),
      source: 'homelogfull:peripheral',
      zone: 'peripheral',
      cycleCount: entries.length,
      cycleId: cycleId || null,
    },
  };
}

// ─── Phase 0: Baseline Measurement ──────────────────────────

/**
 * Measure homelogfull and log baseline statistics to ops.log.
 * Non-breaking — purely observational.
 */
function measureHomelogfull(home, room, tokenBudget) {
  const homelogPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
  if (!fs.existsSync(homelogPath)) {
    home.log('[homelogfull-processor] measureHomelogfull: no homelogfull.jsonl found');
    return;
  }

  const entries = readHomelogEntries(homelogPath, room);
  const total = entries.length;

  if (total === 0) {
    home.log(`[homelogfull-processor] room=${room} entries=0 nothing to measure`);
    return;
  }

  // Compute zone budgets
  const homelogBudget = Math.floor((tokenBudget - 3000 - 200) * 0.25);
  const { fovealMax, parafovealMax } = computeZoneBudgets(homelogBudget);

  // Assign zones
  const { foveal, parafoveal, peripheral } = assignZones(entries, fovealMax, parafovealMax);

  // Estimate current implementation token cost (all entries as user+assistant pairs)
  let currentTokens = 0;
  for (const entry of entries) {
    const triggerText = extractTriggerMessage(entry) || '';
    currentTokens += estimateTokens(triggerText);
    const outbound = (entry.messages || []).map(m => `[${m.to}]: ${m.content}`).join('\n\n');
    const traceDigest = synthesizeToolTrace(entry);
    const parts = [traceDigest?.digest || '', outbound].filter(Boolean);
    currentTokens += estimateTokens(parts.join('\n\n'));
    currentTokens += 8; // message overhead
  }

  // Estimate new three-zone token cost
  let newTokens = 0;
  for (const e of foveal) newTokens += estimateFovealCost(e) * 2; // user+assistant
  for (const e of parafoveal) newTokens += estimateParafovealCost(e);
  newTokens += peripheral.length * 20; // ~20 tokens per peripheral line

  home.log(
    `[homelogfull-processor] room=${room} total=${total} ` +
    `foveal=${foveal.length}(newest ${foveal.length}) ` +
    `parafoveal=${parafoveal.length} ` +
    `peripheral=${peripheral.length} ` +
    `budget=${homelogBudget} ` +
    `currentEst=${currentTokens}tok ` +
    `newEst=${newTokens}tok`
  );
}

// ─── Phase 1: Three-Zone Section Builder ────────────────────

/**
 * Build the homelogfull section using three-zone foveated compression.
 *
 * Replaces the old loadHomelogFull() function.
 *
 * @param {object} home - Home instance (has homeDir, config.name, log())
 * @param {string} room - Room to filter by
 * @param {number} tokenBudget - Total token budget for this build() call
 * @param {object} [_traceContext] - Traceability metadata
 * @returns {Array} messages[] for context assembly
 */
function buildHomelogfullSection(home, room, tokenBudget, _traceContext = {}) {
  const cycleId = _traceContext.cycleId || null;
  const homelogPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');

  if (!fs.existsSync(homelogPath)) return [];

  const entries = readHomelogEntries(homelogPath, room);
  if (entries.length === 0) return [];

  // Compute homelogfull token budget: 25% of non-boot, non-room-context budget
  // Assume ~3000 boot tokens, ~200 room context tokens as conservative estimate
  const estimatedBootTokens = 3000;
  const roomContextTokens = 200;
  const homelogBudget = Math.max(
    Math.floor((tokenBudget - estimatedBootTokens - roomContextTokens) * 0.25),
    500 // minimum floor so we always show something
  );

  // Log baseline measurement every build()
  try {
    measureHomelogfull(home, room, tokenBudget);
  } catch (e) {
    // measurement is non-breaking
  }

  // Compute zone budgets
  const { fovealMax, parafovealMax } = computeZoneBudgets(homelogBudget);

  // Assign zones (newest → foveal, oldest → peripheral)
  const { foveal, parafoveal, peripheral } = assignZones(entries, fovealMax, parafovealMax);

  // Assign markers — process oldest-first so ◇ fires on first encounter
  const seenFirstTypes = new Set();
  const markerMap = new Map(); // cycleId → marker

  for (const entry of entries) {
    const marker = assignMarker(entry, seenFirstTypes);
    markerMap.set(entry.cycleId, marker);
  }

  const messages = [];

  // ── Peripheral zone (batched, oldest) ──
  if (peripheral.length > 0) {
    const peripheralMsg = renderPeripheral(peripheral, markerMap, cycleId);
    messages.push(peripheralMsg);
  }

  // ── Parafoveal zone (one per entry) ──
  for (const entry of parafoveal) {
    const marker = markerMap.get(entry.cycleId) || '●';
    const msg = renderParafoveal(entry, marker, cycleId);
    messages.push(msg);
  }

  // ── Foveal zone (user+assistant pairs, newest last) ──
  for (const entry of foveal) {
    const marker = markerMap.get(entry.cycleId) || '●';
    const pair = renderFoveal(entry, marker, cycleId);
    messages.push(...pair);
  }

  return messages;
}

/**
 * Load and format the agent's homelogfull as foveated user/assistant pairs.
 *
 * LEGACY FALLBACK — kept for compatibility. Delegates to buildHomelogfullSection()
 * when tokenBudget is provided, otherwise uses old flat implementation.
 *
 * @param {object} home - Home instance (has homeDir, config.name)
 * @param {string} room - Room name to filter entries by
 * @param {number|object} tokenBudgetOrTraceContext - Token budget (new) or _traceContext (old)
 * @param {object} [_traceContext] - Traceability context
 * @returns {Array} messages[] entries suitable for context assembly
 */
function loadHomelogFull(home, room, tokenBudgetOrTraceContext = {}, _traceContext = {}) {
  // Detect new vs old calling convention
  if (typeof tokenBudgetOrTraceContext === 'number') {
    return buildHomelogfullSection(home, room, tokenBudgetOrTraceContext, _traceContext);
  }

  // Old calling convention: tokenBudgetOrTraceContext is _traceContext
  const traceCtx = tokenBudgetOrTraceContext;
  const cycleId = traceCtx.cycleId || null;
  const homelogPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
  if (!fs.existsSync(homelogPath)) return [];

  let lines;
  try {
    lines = fs.readFileSync(homelogPath, 'utf-8').trim().split('\n').filter(Boolean);
  } catch (e) {
    console.log(`[context-manager] loadHomelogFull: error reading ${homelogPath}: ${e.message}`);
    return [];
  }

  const messages = [];

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.room !== room) continue;

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
          source: `homelogfull:${entry.cycleId}:trigger`,
          foveation: 'QUOTE',
          cycleId,
          originCycleId: entry.cycleId,
          ts: entry.ts || null,
        },
      });
    }

    const assistantParts = [];
    const toolTrace = synthesizeToolTrace(entry);
    if (toolTrace) assistantParts.push(toolTrace.digest);

    if (entry.messages && entry.messages.length > 0) {
      const outbound = entry.messages.map(m => `[${m.to}]: ${m.content}`).join('\n\n');
      assistantParts.push(outbound);
    }

    if (assistantParts.length > 0) {
      messages.push({
        role: 'assistant',
        content: assistantParts.join('\n\n'),
        _meta: {
          ctxId: generateUID('ctx'),
          source: `homelogfull:${entry.cycleId}:output`,
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
 * Load live messages from the room dispatch — everything since the agent's
 * last inference cycle for this room (using homelogfull timestamp as cut point).
 *
 * The room server sends the FULL chatlog every dispatch. We use the
 * homelogfull to find the last cycle timestamp, then include only messages
 * that arrived after that point. First boot: include all messages.
 *
 * @param {object} home - Home instance
 * @param {object} dispatch - Current dispatch (has roomchatlog, room)
 * @param {object} [_traceContext] - Traceability context
 * @returns {Array} messages[] for live context
 */
function loadLiveContext(home, dispatch, _traceContext = {}, seenIds = null) {
  const cycleId = _traceContext.cycleId || null;
  const room = dispatch.room;
  const myName = home.config.name;

  const incoming = dispatch.roomchatlog || dispatch.transcript || dispatch.messages || [];
  if (!incoming.length) return [];

  // Find timestamp of agent's last inference cycle for this room
  let lastCycleTs = null;
  const homelogPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
  if (fs.existsSync(homelogPath)) {
    try {
      const lines = fs.readFileSync(homelogPath, 'utf-8').trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.room === room && entry.ts) {
            lastCycleTs = new Date(entry.ts).getTime();
            break;
          }
        } catch { continue; }
      }
    } catch (e) {
      // If we can't read the log, include all messages (fail open)
    }
  }

  // Include everything after the last cycle timestamp
  // First boot (no prior cycles): include everything
  let newMessages = lastCycleTs
    ? incoming.filter(m => {
        const msgTs = m.ts ? new Date(m.ts).getTime() : 0;
        return msgTs > lastCycleTs;
      })
    : [...incoming];

  // Always include the triggering message even if clock skew puts it before cutoff
  const triggerMsg = [...incoming].reverse().find(
    m => m.to === myName && m.from !== myName
  );
  if (triggerMsg && triggerMsg.id) {
    const newIds = new Set(newMessages.map(m => m.id).filter(Boolean));
    if (!newIds.has(triggerMsg.id)) {
      newMessages.push(triggerMsg);
    }
  }


  // Apply seenIds dedup filter (if available)
  if (seenIds && seenIds.size > 0) {
    const beforeCount = newMessages.length;
    newMessages = newMessages.filter(m => {
      if (m.id && seenIds.has(m.id)) return false;
      if (m.dispatchId && seenIds.has(m.dispatchId)) return false;
      return true;
    });
    const afterCount = newMessages.length;
    if (beforeCount !== afterCount) {
      console.log(`[context-manager] Dedup filtered ${beforeCount - afterCount} already-seen messages`);
    }
  }

  return newMessages.map(entry => {
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
 * NOW WITH HOMELOGFULL PERSONAL MEMORY + FOVEATED COMPRESSION.
 *
 * Architecture:
 *   [boot docs]      — identity, never trimmed
 *   [room context]   — where we are, reply address
 *   [homelogfull]    — agent's OWN prior cycles (personal memory), foveated
 *   [live messages]  — new messages since last cycle (from dispatch chatlog)
 */
function build(home, dispatch, bootDocuments, tokenBudget, _traceContext = {}) {
  const room = dispatch.room;
  const incoming = dispatch.roomchatlog || dispatch.transcript || dispatch.messages || [];
  const cycleId = _traceContext.cycleId || null;

  // Path to raw JSONL for storing full tool outputs (for zoom-in)
  const rawJsonlPath = path.join(home.homeDir, 'history', 'raw-tool-outputs.jsonl');

  // ── 1. Boot documents — identity, never trimmed ──
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

  // ── 3. Homelogfull — personal memory (agent's OWN prior cycles) ──
  // Three-zone foveated compression: foveal (last 3 cycles, full thinking+trail),
  // parafoveal (cycles 4-12, compressed), peripheral (13+, one line each batched).
  // Budget is 25% of non-boot/non-room-context available tokens.
  const homelogMessages = buildHomelogfullSection(home, room, tokenBudget, _traceContext);

  // ── 4. Live room context — what just arrived ──
  // Messages from the dispatch that arrived AFTER the last inference cycle.
  // Uses homelogfull timestamp as the cut point (fails open to include all
  // messages if no prior cycles exist).
  // Reserve 25% of history budget for live context so the agent always sees
  // what just happened even if memory is full.
  const LIVE_RESERVE = Math.floor(historyBudget * 0.25);
  const MEMORY_BUDGET = historyBudget - LIVE_RESERVE;

  // Extract seenIds from homelogfull for dedup — prevents re-processing seen messages
  let seenIds = null;
  try {
    const transcriptPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
    if (fs.existsSync(transcriptPath)) {
      seenIds = new Set();
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.dispatchId) seenIds.add(entry.dispatchId);
          // messages[] is at top level in homelogfull schema (not under parsedOutput)
          if (entry.messages) {
            for (const msg of entry.messages) {
              if (msg.blockId) seenIds.add(msg.blockId);
            }
          }
        } catch { continue; }
      }
      console.log(`[context-manager] Loaded ${seenIds.size} seen IDs for dedup`);
    }
  } catch (e) {
    console.log(`[context-manager] Dedup seenIds extraction failed: ${e.message}`);
  }

  const liveMessages = loadLiveContext(home, dispatch, _traceContext, seenIds);

  // Fit homelogfull into memory budget (trim oldest first from peripheral/parafoveal edges)
  const fittedMemory = trimOldest([...homelogMessages], MEMORY_BUDGET);

  // Fit live messages into remaining space
  const memoryActualTokens = estimateMessagesTokens(fittedMemory);
  const liveActualBudget = historyBudget - memoryActualTokens;
  const fittedLive = trimOldest([...liveMessages], liveActualBudget);

  // Log context summary for traceability
  if (_traceContext) {
    _traceContext._contextSummary = {
      bootDocs: bootDocuments.length,
      roomContext: 1,
      homelogMessages: homelogMessages.length,
      fittedMemory: fittedMemory.length,
      liveMessages: liveMessages.length,
      fittedLive: fittedLive.length,
      totalMessages: bootDocuments.length + 1 + fittedMemory.length + fittedLive.length,
      budgetUsed: bootTokens + contextTokens + memoryActualTokens + estimateMessagesTokens(fittedLive),
      budgetTotal: tokenBudget,
    };
  }

  // Order: boot → room context → homelogfull memory → live messages
  const assembled = [...bootDocuments, roomContextMsg, ...fittedMemory, ...fittedLive];

  // Guard: Anthropic requires context to end on a user message.
  // If the last message is an assistant turn (e.g. homelogfull foveal with no live messages),
  // append a minimal user continuation prompt.
  const last = assembled[assembled.length - 1];
  if (last && last.role === 'assistant') {
    assembled.push({ role: 'user', content: '[Continue]' });
  }

  return assembled;
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
  foveatedEnabled: () => foveatedEnabled,
  // Homelogfull context processor (three-zone foveated)
  buildHomelogfullSection,
  measureHomelogfull,
  extractKeyJudgment,
  classifyCycleType,
  assignMarker,
};
