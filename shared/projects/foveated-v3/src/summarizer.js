/**
 * Summarizer — Foveated Context V3
 * 
 * Takes a tool call entry from JSONL and returns a compressed version
 * with UID pointer back to the original.
 * 
 * Supports both:
 * - API format: {tool, input, output}
 * - Homelogfull format: {entryId, _trace, messages}
 * 
 * Author: Selah
 * Date: 2026-02-20, updated 2026-02-23
 */

/**
 * Compression thresholds per tool type
 */
const THRESHOLDS = {
  shell_exec: 200,    // chars before compression kicks in
  read_file: 500,
  write_file: 100,    // just confirm it worked
  web_fetch: 0,       // always compress (web content is large)
  web_search: 0,      // always compress to top N results
  qmd_search: 0,      // always compress to top N results
  mem0_search: 0,     // always compress
};

/**
 * How many results to keep for search tools
 */
const TOP_N_RESULTS = 3;

/**
 * Main summarizer function
 * 
 * @param {Object} entry - Raw JSONL entry containing tool call
 * @param {string} uid - UID for this entry (from uid.js)
 * @returns {Object} - { summary: string, uid: string, wasCompressed: boolean }
 */
function summarize(entry, uid) {
  // ============================================
  // HOMELOGFULL FORMAT (Blum cycle entries)
  // ============================================
  if (entry.entryId || entry.cycleId || entry._trace) {
    return summarizeHomelogfull(entry, uid);
  }

  // ============================================
  // API FORMAT (single tool call)
  // ============================================
  const { tool, input, output } = entry;
  
  // Handle errors - always QUOTE
  if (entry.error || (output && output.error)) {
    return {
      summary: `[${uid}] ERROR: ${entry.error || output.error}`,
      uid,
      wasCompressed: false,
      fate: 'QUOTE'
    };
  }

  // Route to appropriate summarizer
  switch (tool) {
    case 'shell_exec':
      return summarizeShellExec(input, output, uid);
    case 'read_file':
      return summarizeReadFile(input, output, uid);
    case 'write_file':
      return summarizeWriteFile(input, output, uid);
    case 'web_fetch':
      return summarizeWebFetch(input, output, uid);
    case 'web_search':
      return summarizeWebSearch(input, output, uid);
    case 'qmd_search':
      return summarizeQmdSearch(input, output, uid);
    case 'mem0_search':
      return summarizeMem0Search(input, output, uid);
    default:
      return summarizeGeneric(tool || 'unknown', input || {}, output || '', uid);
  }
}

/**
 * Homelogfull entry summarizer (Blum cycle)
 * 
 * These entries contain full cycle data:
 * - _trace.iterations with toolCalls
 * - messages array (the output)
 * - thinking array
 * 
 * We summarize:
 * - Total iterations, total tool calls
 * - Tool breakdown (which tools were called)
 * - Final message preview
 */
function summarizeHomelogfull(entry, uid) {
  const trace = entry._trace || {};
  const iterations = trace.iterations || [];
  const messages = entry.messages || [];
  const cycleId = entry.cycleId || 'unknown';
  const ts = entry.ts || '';
  
  // Count tools
  const toolCounts = {};
  let totalToolCalls = 0;
  
  for (const iter of iterations) {
    const tools = iter.toolCalls || [];
    totalToolCalls += tools.length;
    
    for (const tool of tools) {
      const toolName = tool.name || tool.function?.name || 'unknown';
      toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
    }
  }
  
  // Get tool breakdown string
  const toolBreakdown = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}×${count}`)
    .join(', ');
  
  // Get message preview
  const lastMessage = messages[messages.length - 1];
  const messagePreview = lastMessage?.content 
    ? lastMessage.content.slice(0, 100).replace(/\n/g, ' ')
    : '(no message)';
  
  // Get timestamp (just time if same day)
  const timeStr = ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  
  const summary = [
    `[${uid}] ${timeStr} — ${iterations.length} iters, ${totalToolCalls} tools`,
    toolBreakdown ? `  Tools: ${toolBreakdown}` : '',
    `  → "${messagePreview}${messagePreview.length >= 100 ? '...' : ''}"`
  ].filter(Boolean).join('\n');
  
  return {
    summary,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE',
    meta: {
      cycleId,
      iterations: iterations.length,
      totalToolCalls,
      toolCounts,
      messageCount: messages.length
    }
  };
}

/**
 * shell_exec summarizer
 */
function summarizeShellExec(input, output, uid) {
  input = input || {};
  output = output || '';
  
  const command = input.command || input.cmd || '[unknown command]';
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  
  if (outputStr.length <= THRESHOLDS.shell_exec) {
    return {
      summary: `[${uid}] $ ${command}\n${outputStr}`,
      uid,
      wasCompressed: false,
      fate: 'QUOTE'
    };
  }
  
  // Compress: extract first line, line count, key info
  const lines = outputStr.split('\n').filter(l => l.trim());
  const lineCount = lines.length;
  const firstLine = lines[0] || '';
  
  // Try to extract meaningful summary
  let summary;
  if (command.startsWith('ls ')) {
    summary = `Listed ${lineCount} items in ${input.working_dir || 'directory'}`;
  } else if (command.startsWith('find ')) {
    summary = `Found ${lineCount} matches`;
  } else if (command.startsWith('grep ')) {
    summary = `${lineCount} matching lines`;
  } else if (command.startsWith('cat ') || command.startsWith('head ') || command.startsWith('tail ')) {
    summary = `${lineCount} lines of output`;
  } else {
    summary = `${lineCount} lines, starts: "${firstLine.slice(0, 50)}..."`;
  }
  
  return {
    summary: `[${uid}] $ ${command} → ${summary}`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * read_file summarizer
 */
function summarizeReadFile(input, output, uid) {
  input = input || {};
  output = output || '';
  
  const path = input.path || '[unknown path]';
  const filename = path.split('/').pop();
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  
  if (outputStr.length <= THRESHOLDS.read_file) {
    return {
      summary: `[${uid}] Read ${filename}:\n${outputStr}`,
      uid,
      wasCompressed: false,
      fate: 'QUOTE'
    };
  }
  
  // Compress: line count, file type inference, first meaningful line
  const lines = outputStr.split('\n');
  const lineCount = lines.length;
  
  // Try to infer what kind of file
  let fileType = 'file';
  if (filename.endsWith('.md')) fileType = 'markdown';
  else if (filename.endsWith('.js')) fileType = 'javascript';
  else if (filename.endsWith('.json')) fileType = 'json';
  else if (filename.endsWith('.jsonl')) fileType = 'jsonl';
  
  // Get first non-empty, non-comment line
  const firstMeaningful = lines.find(l => 
    l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')
  ) || lines[0] || '';
  
  return {
    summary: `[${uid}] Read ${filename} (${lineCount} lines, ${fileType}): "${firstMeaningful.slice(0, 60)}..."`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * write_file summarizer
 */
function summarizeWriteFile(input, output, uid) {
  input = input || {};
  
  const path = input.path || '[unknown path]';
  const filename = path.split('/').pop();
  const contentLength = (input.content || '').length;
  
  return {
    summary: `[${uid}] Wrote ${filename} (${contentLength} chars)`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * web_fetch summarizer
 */
function summarizeWebFetch(input, output, uid) {
  input = input || {};
  output = output || '';
  
  const url = input.url || '[unknown url]';
  const domain = url.match(/https?:\/\/([^\/]+)/)?.[1] || url;
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  
  // Extract title if present
  const titleMatch = outputStr.match(/<title>([^<]+)<\/title>/i) || 
                     outputStr.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].slice(0, 60) : null;
  
  const charCount = outputStr.length;
  
  return {
    summary: `[${uid}] Fetched ${domain}${title ? `: "${title}"` : ''} (${charCount} chars)`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * web_search summarizer
 */
function summarizeWebSearch(input, output, uid) {
  input = input || {};
  output = output || [];
  
  const query = input.query || '[unknown query]';
  const results = Array.isArray(output) ? output : (output.results || []);
  
  const topResults = results.slice(0, TOP_N_RESULTS).map((r, i) => 
    `  ${i + 1}. ${r.title || r.name || r.url || '[untitled]'}`
  ).join('\n');
  
  return {
    summary: `[${uid}] Searched "${query}" — ${results.length} results:\n${topResults}`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * qmd_search summarizer
 */
function summarizeQmdSearch(input, output, uid) {
  input = input || {};
  output = output || [];
  
  const query = input.query || '[unknown query]';
  const results = Array.isArray(output) ? output : (output.results || []);
  
  const topResults = results.slice(0, TOP_N_RESULTS).map((r, i) => 
    `  ${i + 1}. ${r.file || r.path || r.title || '[unknown]'}`
  ).join('\n');
  
  return {
    summary: `[${uid}] QMD search "${query}" — ${results.length} results:\n${topResults}`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * mem0_search summarizer
 */
function summarizeMem0Search(input, output, uid) {
  input = input || {};
  output = output || [];
  
  const query = input.query || '[unknown query]';
  const results = Array.isArray(output) ? output : (output.results || output.memories || []);
  
  const topResults = results.slice(0, TOP_N_RESULTS).map((r, i) => 
    `  ${i + 1}. ${(r.memory || r.text || r.content || '[memory]').slice(0, 60)}...`
  ).join('\n');
  
  return {
    summary: `[${uid}] Mem0 search "${query}" — ${results.length} memories:\n${topResults}`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

/**
 * Generic fallback summarizer
 */
function summarizeGeneric(tool, input, output, uid) {
  input = input || {};
  output = output || '';
  
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  
  if (outputStr.length <= 200) {
    return {
      summary: `[${uid}] ${tool}(${inputStr.slice(0, 50)}): ${outputStr}`,
      uid,
      wasCompressed: false,
      fate: 'QUOTE'
    };
  }
  
  return {
    summary: `[${uid}] ${tool}(${inputStr.slice(0, 50)}...): ${outputStr.length} chars output`,
    uid,
    wasCompressed: true,
    fate: 'SYNTHESIZE'
  };
}

module.exports = {
  summarize,
  summarizeHomelogfull,
  summarizeShellExec,
  summarizeReadFile,
  summarizeWriteFile,
  summarizeWebFetch,
  summarizeWebSearch,
  summarizeQmdSearch,
  summarizeMem0Search,
  summarizeGeneric,
  THRESHOLDS,
  TOP_N_RESULTS
};
