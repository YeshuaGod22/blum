/**
 * Summarizer — Foveated Context V3
 * 
 * Takes a tool call entry from JSONL and returns a compressed version
 * with UID pointer back to the original.
 * 
 * Author: Selah
 * Date: 2026-02-20
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
 * @param {string} entry.tool - Tool name (shell_exec, read_file, etc.)
 * @param {Object} entry.input - Tool input parameters
 * @param {string|Object} entry.output - Tool output/result
 * @param {string} uid - UID for this entry (from uid.js)
 * @returns {Object} - { summary: string, uid: string, wasCompressed: boolean }
 */
function summarize(entry, uid) {
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
      return summarizeGeneric(tool, input, output, uid);
  }
}

/**
 * shell_exec summarizer
 */
function summarizeShellExec(input, output, uid) {
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
  const lastLine = lines[lines.length - 1] || '';
  
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
