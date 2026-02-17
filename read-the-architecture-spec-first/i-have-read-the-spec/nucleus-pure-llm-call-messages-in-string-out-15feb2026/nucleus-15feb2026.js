// ========================================
// BLUM NUCLEUS — 15 Feb 2026
//
// Pure stateless inference function.
// call(messages, config, tools?) → { text, stopReason, toolCalls[] }
//
// Messages in, structured response out. That is ALL.
// The nucleus does NOT execute tools. Does NOT loop.
// The home does both. See architecture spec section 6.
//
// Multi-provider: Anthropic (API key + setup token),
// OpenAI, OpenRouter.
// ========================================

// ── Provider detection ────────────────────
function detectProvider(config) {
  if (config.provider) return config.provider;
  const key = config.apiKey || '';
  if (key.startsWith('sk-ant-oat'))  return 'anthropic-oauth';
  if (key.startsWith('sk-ant-'))     return 'anthropic';
  if (key.startsWith('sk-or-'))      return 'openrouter';
  if (key.startsWith('sk-proj-'))    return 'openai';
  if (key.startsWith('sk-'))         return 'openai';  // older openai format
  // If baseUrl hints at provider
  const base = config.baseUrl || '';
  if (base.includes('openrouter'))   return 'openrouter';
  if (base.includes('openai'))       return 'openai';
  if (base.includes('anthropic'))    return 'anthropic';
  return 'anthropic'; // default
}

// ── Model catalogues ──────────────────────
const ANTHROPIC_MODELS = {
  'claude-opus-4-6':    { name: 'Claude Opus 4.6',    maxOutput: 64000 },
  'claude-opus-4-5':    { name: 'Claude Opus 4.5',    maxOutput: 64000 },
  'claude-sonnet-4-5':  { name: 'Claude Sonnet 4.5',  maxOutput: 64000 },
  'claude-haiku-4-5':   { name: 'Claude Haiku 4.5',   maxOutput: 64000 },
  'claude-opus-4-1':    { name: 'Claude Opus 4.1',    maxOutput: 64000 },
  'claude-opus-4-0':    { name: 'Claude Opus 4.0',    maxOutput: 64000 },
  'claude-sonnet-4-0':  { name: 'Claude Sonnet 4.0',  maxOutput: 64000 },
  'claude-3-7-sonnet-20250219': { name: 'Claude 3.7 Sonnet', maxOutput: 64000 },
  'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet v2', maxOutput: 8192 },
  'claude-3-5-haiku-20241022':  { name: 'Claude 3.5 Haiku',     maxOutput: 8192 },
};

const OPENAI_MODELS = {
  'gpt-4o':             { name: 'GPT-4o',             maxOutput: 16384 },
  'gpt-4o-mini':        { name: 'GPT-4o Mini',        maxOutput: 16384 },
  'gpt-4-turbo':        { name: 'GPT-4 Turbo',        maxOutput: 4096  },
  'o1':                 { name: 'o1',                  maxOutput: 100000 },
  'o1-mini':            { name: 'o1 Mini',             maxOutput: 65536 },
  'o3-mini':            { name: 'o3 Mini',             maxOutput: 65536 },
};

// ── Anthropic call (API key or setup token) ──
async function callAnthropic(messages, config, isOAuth, tools) {
  const model = config.model || 'claude-opus-4-6';
  const maxTokens = config.maxTokens || 4096;
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  const apiVersion = config.apiVersion || '2023-06-01';
  const apiKey = config.apiKey;

  const systemParts = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const body = { model, max_tokens: maxTokens, messages: conversationMessages };

  // Pass tools if provided
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  if (isOAuth) {
    body.system = [
      { type: 'text', text: "You are Claude Code, Anthropic's official CLI for Claude." },
    ];
    if (systemParts.length > 0) {
      body.system.push({ type: 'text', text: systemParts.map(m => m.content).join('\n\n') });
    }
  } else if (systemParts.length > 0) {
    body.system = systemParts.map(m => m.content).join('\n\n');
  }

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': apiVersion,
    'accept': 'application/json',
  };

  if (isOAuth) {
    headers['Authorization'] = 'Bearer ' + apiKey;
    headers['anthropic-beta'] = 'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14';
    headers['user-agent'] = 'claude-cli/2.1.2 (external, cli)';
    headers['x-app'] = 'cli';
  } else {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(baseUrl + '/messages', {
    method: 'POST', headers, body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic ${response.status}: ${error}`);
  }

  const data = await response.json();
  return parseAnthropicResponse(data);
}

// ── Parse Anthropic response into structured format ──
function parseAnthropicResponse(data) {
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const toolCalls = data.content
    .filter(b => b.type === 'tool_use')
    .map(b => ({ id: b.id, name: b.name, input: b.input }));

  return {
    text,
    stopReason: data.stop_reason || 'end_turn',
    toolCalls,
    // Pass through raw content blocks — the home may need them
    // to build the assistant message for tool result continuation
    _contentBlocks: data.content,
  };
}

// ── OpenAI-compatible call (OpenAI, OpenRouter) ──
async function callOpenAI(messages, config, tools) {
  const provider = detectProvider(config);
  const baseUrl = config.baseUrl
    || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const model = config.model || (provider === 'openrouter' ? 'anthropic/claude-sonnet-4' : 'gpt-4o');
  const maxTokens = config.maxTokens || 4096;
  const apiKey = config.apiKey;

  // OpenAI format: system is a message in the array
  const body = { model, max_tokens: maxTokens, messages };

  // Pass tools if provided (OpenAI tool format)
  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey,
  };

  // OpenRouter wants these
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://blum.local';
    headers['X-Title'] = 'Blum Nucleus';
  }

  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST', headers, body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${provider} ${response.status}: ${error}`);
  }

  const data = await response.json();
  const msg = data.choices[0].message;
  const toolCalls = (msg.tool_calls || []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || '{}'),
  }));

  return {
    text: msg.content || '',
    stopReason: data.choices[0].finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    toolCalls,
    _contentBlocks: null, // OpenAI doesn't use content blocks
  };
}

// ── Main entry point ──────────────────────
/**
 * Call an LLM provider and return a structured response.
 *
 * @param {Array<{role: string, content: string|Array}>} messages
 * @param {object} config
 * @param {string} [config.apiKey] - API key/token (or set env: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY)
 * @param {string} [config.provider] - Force provider: 'anthropic', 'anthropic-oauth', 'openai', 'openrouter'
 * @param {string} [config.model] - Model identifier
 * @param {number} [config.maxTokens] - Max tokens (default: 4096)
 * @param {string} [config.baseUrl] - Override base URL
 * @param {Array} [tools] - Optional tool definitions (Anthropic format)
 * @returns {Promise<{text: string, stopReason: string, toolCalls: Array, _contentBlocks?: Array}>}
 */
async function call(messages, config = {}, tools = []) {
  // Resolve API key from config or environment
  if (!config.apiKey) {
    const provider = config.provider || '';
    config.apiKey = (provider.startsWith('anthropic') && process.env.ANTHROPIC_API_KEY)
      || (provider === 'openai' && process.env.OPENAI_API_KEY)
      || (provider === 'openrouter' && process.env.OPENROUTER_API_KEY)
      || process.env.ANTHROPIC_API_KEY
      || process.env.OPENAI_API_KEY
      || process.env.OPENROUTER_API_KEY;
  }

  if (!config.apiKey) {
    throw new Error('No API key: set config.apiKey or ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY');
  }

  const provider = detectProvider(config);

  switch (provider) {
    case 'anthropic-oauth':
      return callAnthropic(messages, config, true, tools);
    case 'anthropic':
      return callAnthropic(messages, config, false, tools);
    case 'openai':
    case 'openrouter':
      return callOpenAI(messages, config, tools);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

module.exports = { call, detectProvider, ANTHROPIC_MODELS, OPENAI_MODELS };
