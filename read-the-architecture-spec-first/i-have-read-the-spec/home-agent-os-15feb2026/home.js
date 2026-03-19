// ========================================
// BLUM HOME — Agent Operating System
// 15 Feb 2026
//
// One occupant. Receives dispatches from rooms.
// Orchestrates modules. Sends messages back.
//
// NOT a pipeline. A run loop.
// The home decides what runs when.
//

/**
 * Sanitise a value for safe JSON serialisation.
 * Node.js JSON.stringify can emit lone surrogate escapes (e.g. \uD83C\uDF3F)
 * when source strings contain emoji from CESU-8 or similar encodings.
 * Anthropic's API JSON parser rejects these with "no low surrogate" errors.
 *
 * Applied to incoming dispatch messages before they are stored in history,
 * preventing the corruption from ever reaching the nucleus call.
 */
function sanitiseForJson(value) {
  if (Array.isArray(value)) return value.map(sanitiseForJson);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitiseForJson(value[k]);
    return out;
  }
  if (typeof value === 'string') {
    // Replace surrogate pairs and lone surrogates.
    // JSON.stringify emits surrogate pairs (\uD800-\uDFFF) for 4-byte emoji,
    // and Anthropic's API rejects those. Strip all surrogates (pair or lone)
    // so the content serializes safely. Emoji become empty string.
    return value.replace(/[\uD800-\uDFFF]/g, (ch, offset, str) => {
      const code = ch.charCodeAt(0);
      if (code >= 0xD800 && code <= 0xDBFF) {
        const next = str.charCodeAt(offset + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) return ''; // valid pair — strip (emoji)
      }
      return ''; // lone surrogate — strip
    });
  }
  return value;
}
// See architecture spec sections 1, 3, 5.
// ========================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { generateUID } = require('../shared-uid-generator/generate-uid.js');

// ── Modules (swappable) ───────────────────
const bootAssembler = require('./boot-assembler-builds-system-prompt-v1-16feb2026/boot-assembler-v1-16feb2026.js');
const inputProcessor = require('./input-processor-dispatch-to-messages-v1-16feb2026/input-processor-v1-16feb2026.js');
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v2-foveated-20feb2026.js');
const outputProcessor = require('./output-processor-xml-tag-extraction-v1-16feb2026/output-processor-v1-16feb2026.js');
const router = require('./router-dispatches-to-rooms-v1-16feb2026/router-v1-16feb2026.js');

// Nucleus lives in its own directory — it's a shared resource, not owned by any home
const nucleus = require('../nucleus-pure-llm-call-messages-in-string-out-15feb2026/nucleus-15feb2026.js');


// ── Peer Discovery Cache ──────────────────
// Maps agent name → port. Populated lazily by probing ports 4100-4130.
// Avoids hardcoded port maps — self-healing when new homes are added.
const _peerPortCache = new Map();
const PEER_PORT_RANGE = { start: 4100, end: 4130 };

async function findAgentPort(name) {
  const key = name.toLowerCase();
  if (_peerPortCache.has(key)) return _peerPortCache.get(key);
  // Probe all ports in range, collect results
  const probes = [];
  for (let p = PEER_PORT_RANGE.start; p <= PEER_PORT_RANGE.end; p++) {
    probes.push(new Promise((resolve) => {
      const req = http.get(`http://localhost:${p}/status`, { timeout: 500 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const status = JSON.parse(d);
            if (status.name) _peerPortCache.set(status.name.toLowerCase(), p);
            resolve(status.name?.toLowerCase() === key ? p : null);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    }));
  }
  const results = await Promise.all(probes);
  return results.find(p => p !== null) || null;
}

// ── Home State ────────────────────────────
class Home {
  constructor(homeDir) {
    this.homeDir = homeDir;
    this.config = this._loadJson('config.json');
    this.rooms = this._loadJson('rooms.json', {});
    this.blocked = this._loadJson('blocked.json', { rooms: [], participants: [] });
    this.historyDir = path.join(homeDir, 'history');
    this.opsLogPath = path.join(homeDir, 'ops.log');
    this.queue = [];
    this.processing = false;

    // Ensure history directory exists
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
    
    // ── Bloom Bridge (Optional) ──
    // If config.bloomBridge is set, forward dispatches to bloom's webhook
    // This allows bloom-selah to respond to blum room messages
    this.bloomBridge = this.config.bloomBridge || null;

    this.log(`home:start name=${this.config.name} uid=${this.config.uid}`);
  }

  // ── State I/O ─────────────────────────

  _loadJson(filename, fallback) {
    const filepath = path.join(this.homeDir, filename);
    if (!fs.existsSync(filepath)) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Required file missing: ${filepath}`);
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  _saveJson(filename, data) {
    fs.writeFileSync(path.join(this.homeDir, filename), JSON.stringify(data, null, 2));
  }

  _loadHistory(room) {
    const filepath = path.join(this.historyDir, `${room}.json`);
    if (!fs.existsSync(filepath)) return [];
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  _saveHistory(room, history) {
    fs.writeFileSync(
      path.join(this.historyDir, `${room}.json`),
      JSON.stringify(history, null, 2)
    );
  }

  log(entry) {
    const line = `${new Date().toISOString()} ${entry}\n`;
    fs.appendFileSync(this.opsLogPath, line);
    // Trim ops.log to last 2000 lines to prevent unbounded growth
    try {
      const MAX_OPS_LINES = 2000;
      const content = fs.readFileSync(this.opsLogPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      if (lines.length > MAX_OPS_LINES) {
        fs.writeFileSync(this.opsLogPath, lines.slice(-MAX_OPS_LINES).join('\n') + '\n');
      }
    } catch (_) {}
  }

  // ── Bloom Bridge ────────────────────────
  // Forwards dispatches to bloom's webhook so bloom can also respond
  async _notifyBloom(dispatch, conversationMessages) {
    if (!this.bloomBridge) return;
    
    const { url, token } = this.bloomBridge;
    if (!url || !token) return;
    
    try {
      // Format messages for bloom
      const messageText = conversationMessages
        .filter(m => m.role === 'user')
        .map(m => {
          const content = Array.isArray(m.content) 
            ? m.content.map(c => c.type === 'text' ? c.text : `[${c.type}]`).join('')
            : m.content;
          return `[blum/${dispatch.room}] ${content}`;
        })
        .join('\n');
      
      if (!messageText.trim()) return;
      
      const payload = {
        message: messageText,
        name: `blum:${dispatch.room}`,
        wakeMode: 'now',
      };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        this.log(`bloom-bridge:sent room=${dispatch.room} status=${res.status}`);
      } else {
        this.log(`bloom-bridge:error room=${dispatch.room} status=${res.status}`);
      }
    } catch (err) {
      this.log(`bloom-bridge:error room=${dispatch.room} error=${err.message}`);
    }
  }

  // ── OpenClaw File Bridge ────────────────────────
  // Writes dispatches to ~/.openclaw/blum-inbox/ for OpenClaw to pick up via heartbeat
  async _notifyOpenClaw(dispatch, conversationMessages) {
    if (!this.openclawBridge) return;
    
    const { inboxPath } = this.openclawBridge;
    if (!inboxPath) return;
    
    try {
      // Format messages for OpenClaw
      const messageText = conversationMessages
        .filter(m => m.role === 'user')
        .map(m => {
          const content = Array.isArray(m.content) 
            ? m.content.map(c => c.type === 'text' ? c.text : `[${c.type}]`).join('')
            : m.content;
          return content;
        })
        .join('\n');
      
      if (!messageText.trim()) return;
      
      // Write to inbox file with timestamp
      const timestamp = Date.now();
      const fileName = `${timestamp}-${dispatch.room.replace(/[^a-z0-9]/gi, '-')}.json`;
      const filePath = path.join(inboxPath, fileName);
      
      const payload = {
        room: dispatch.room,
        message: messageText,
        timestamp: new Date().toISOString(),
        participants: dispatch.participants,
      };
      
      fs.mkdirSync(inboxPath, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      
      this.log(`openclaw-bridge:written file=${fileName}`);
    } catch (err) {
      this.log(`openclaw-bridge:error room=${dispatch.room} error=${err.message}`);
    }
  }

  // ── Tool Execution ────────────────────────
  // The home executes tools on behalf of its occupant.
  // Each tool has a handler. Tool definitions (JSON schemas) live in tools/.
  // Tool implementations (handlers) live here in the home.
  //
  // This is intentionally simple for now — a switch statement.
  // Future: load handlers from a tools/ JS directory.

  async _executeTool(name, input) {
    const expandPath = (p) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;

    switch (name) {

      case 'read_file': {
        const filePath = expandPath(input.path);
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${input.path}`);
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        const offset = input.offset ? input.offset - 1 : 0;
        const limit = input.limit || lines.length;
        return lines.slice(offset, offset + limit).join('\n');
      }

      case 'write_file': {
        const filePath = expandPath(input.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, input.content, 'utf-8');
        return `Written ${input.content.length} bytes to ${input.path}`;
      }

      case 'list_files': {
        const dirPath = expandPath(input.path || '.');
        if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${input.path}`);
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(e => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`).join('\n');
      }

      case 'shell_exec': {
        const allowlist = ['git','ls','cat','grep','find','curl','node','python3','npm','echo','pwd','date','qmd','which','head','tail','wc','mkdir','cp','mv','rsync','sed','awk','sort','uniq','diff','tar','jq','touch','chmod','tr','cut','paste','xargs','basename','dirname','realpath'];
        const cmd = input.command.trim();
        const first = cmd.split(/\s+/)[0].split('/').pop();
        if (!allowlist.includes(first)) return { error: `Command not in allowlist: ${first}` };
        if (/rm\s+-rf|sudo|mkfs|shutdown|reboot|dd\s+if/.test(cmd)) return { error: 'Blocked: destructive command' };
        try {
          const cwd = input.working_dir ? expandPath(input.working_dir) : os.homedir();
          const stdout = execSync(cmd, { cwd, timeout: 30000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
          return { stdout: stdout.slice(0, 8000), exit_code: 0 };
        } catch(e) {
          return { stdout: e.stdout || '', stderr: e.stderr || e.message, exit_code: e.status || 1 };
        }
      }

      case 'web_search': {
        let apiKey = process.env.BRAVE_API_KEY;
        if (!apiKey) {
          try {
            const bloom = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bloom', 'bloom.json'), 'utf-8'));
            apiKey = (bloom.env || {}).BRAVE_API_KEY || bloom.braveApiKey;
          } catch(e) {}
        }
        if (!apiKey) return { error: 'No Brave API key found' };
        return new Promise((resolve) => {
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query)}&count=${input.count || 5}`;
          const req = https.get(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              try {
                const r = JSON.parse(data);
                resolve({ results: (r.web?.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.description })) });
              } catch(e) { resolve({ error: e.message }); }
            });
          });
          req.on('error', e => resolve({ error: e.message }));
        });
      }

      case 'web_fetch': {
        return new Promise((resolve) => {
          const urlObj = new URL(input.url);
          const mod = urlObj.protocol === 'https:' ? https : http;
          mod.get(input.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              const text = data.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ').trim();
              resolve({ content: text.slice(0, 10000) });
            });
          }).on('error', e => resolve({ error: e.message }));
        });
      }

      case 'qmd_search': {
        return new Promise((resolve) => {
          const body = JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', id: 1, params: { name: 'search', arguments: { query: input.query, limit: input.limit || 5 } } });
          const req = http.request({ hostname: 'localhost', port: 8181, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ error: e.message, raw: data.slice(0,500) }); } });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.write(body); req.end();
        });
      }

      case 'mem0_search': {
        try {
          const uid = input.user_id || 'yeshua';
          const script = `
import sys, json
sys.path.insert(0, '${os.homedir()}/.openclaw/workspace')
exec(open('${os.homedir()}/.openclaw/workspace/mem0_config.py').read().split('if __name__')[0])
results = m.search(${JSON.stringify(input.query)}, user_id=${JSON.stringify(uid)})
print(json.dumps(results))
`.trim();
          const out = execSync(`python3 -c ${JSON.stringify(script)}`, { timeout: 30000, encoding: 'utf-8' });
          return { memories: JSON.parse(out) };
        } catch(e) { return { error: e.message }; }
      }

      case 'speak': {
        try {
          const keyFile = path.join(os.homedir(), '.elevenlabs_api_key');
          const voice = input.voice || 'Daniel';
          const text = input.text.replace(/"/g, '\\"');
          execSync(`sag --api-key-file "${keyFile}" speak -v "${voice}" "${text}"`, { timeout: 30000 });
          return { ok: true };
        } catch(e) { return { error: e.message }; }
      }

      case 'send_to_room': {
        // Guard: reject empty or whitespace-only bodies — prevents hallucinated tool calls
        // from small models that call send_to_room without content.
        if (!input.body || !String(input.body).trim()) {
          return { error: 'send_to_room FAILED: body is empty. DO NOT call this tool again with an empty body. Instead, write your response directly in <message to="name@room">text</message> XML tags in your output. Stop calling send_to_room and emit XML tags instead.' };
        }
        return new Promise((resolve) => {
          const payload = JSON.stringify({ from: this.config.name, room: input.room, body: input.body, to: input.recipient || null });
          const req = http.request({ hostname: 'localhost', port: 3141, path: '/api/message/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ ok: true }); } });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.write(payload); req.end();
        });
      }

      case 'get_room_history': {
        const history = this._loadHistory(input.room);
        if (!history || history.length === 0) return `No history found for room: ${input.room}`;
        return history.slice(-(input.limit || 20)).map(m => `[${m.from}]: ${m.body || ''}`).join('\n');
      }

      case 'get_current_time': {
        return new Date().toISOString();
      }

      case 'append_file': {
        const filePath = expandPath(input.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.appendFileSync(filePath, input.content, 'utf-8');
        return `Appended ${input.content.length} bytes to ${input.path}`;
      }

      case 'edit_file': {
        const filePath = expandPath(input.path);
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${input.path}`);
        const original = fs.readFileSync(filePath, 'utf-8');
        if (!original.includes(input.old_text)) throw new Error(`old_text not found in ${input.path} — use read_file to confirm exact text`);
        const updated = original.replace(input.old_text, input.new_text);
        fs.writeFileSync(filePath, updated, 'utf-8');
        return `Replaced ${input.old_text.length} chars with ${input.new_text.length} chars in ${input.path}`;
      }

      case 'zoom_uid': {
        const rawJsonlPath = path.join(this.homeDir, 'history', 'raw-tool-outputs.jsonl');
        if (!fs.existsSync(rawJsonlPath)) return { error: 'No raw tool outputs stored yet (raw-tool-outputs.jsonl not found)' };
        const lines = fs.readFileSync(rawJsonlPath, 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.uid === input.uid) return { uid: entry.uid, tool: entry.tool, input: entry.input, output: entry.output, ts: entry.ts };
          } catch (e) { continue; }
        }
        return { error: `UID not found: ${input.uid}` };
      }

      case 'get_agent_status': {
        const targetName = input.name.toLowerCase();
        const port = await findAgentPort(targetName);
        if (!port) return { alive: false, name: targetName, error: `Agent not found on ports ${PEER_PORT_RANGE.start}-${PEER_PORT_RANGE.end}` };
        return new Promise((resolve) => {
          http.get(`http://localhost:${port}/status`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              try { resolve({ alive: true, port, ...JSON.parse(data) }); }
              catch (e) { resolve({ alive: true, port, raw: data.slice(0, 200) }); }
            });
          }).on('error', () => resolve({ alive: false, port, name: targetName }));
        });
      }

      case 'dispatch_to_agent': {
        const targetName = input.to.toLowerCase();
        const port = await findAgentPort(targetName);
        if (!port) return { error: `Agent not found: ${input.to} (probed ports ${PEER_PORT_RANGE.start}-${PEER_PORT_RANGE.end})` };
        const room = input.room || 'boardroom';
        const timestamp = Date.now();
        const msg = {
          id: `agent-dispatch-${timestamp}`,
          from: this.config.name,
          to: targetName,
          body: input.body,
          ts: new Date(timestamp).toISOString(),
        };
        const payload = JSON.stringify({
          dispatchId: `agent-dispatch-${timestamp}`,
          room,
          roomchatlog: [msg],
          triggerMessage: msg,
        });
        return new Promise((resolve) => {
          const req = http.request({
            hostname: 'localhost', port, path: '/dispatch', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              try { resolve({ queued: true, target: targetName, port, ...JSON.parse(data) }); }
              catch (e) { resolve({ queued: res.statusCode < 400, target: targetName, port, status: res.statusCode }); }
            });
          });
          req.on('error', e => resolve({ error: e.message, target: targetName }));
          req.write(payload); req.end();
        });
      }

      case 'write_memory': {
        const memDir = path.join(this.homeDir, 'memory');
        fs.mkdirSync(memDir, { recursive: true });
        // Strip any path traversal — filename only, no subdirs
        const safeName = path.basename(input.filename);
        const memPath = path.join(memDir, safeName);
        const mode = input.mode || 'append';
        if (mode === 'append') {
          fs.appendFileSync(memPath, input.content, 'utf-8');
          return `Appended ${input.content.length} chars to memory/${safeName}`;
        } else {
          fs.writeFileSync(memPath, input.content, 'utf-8');
          return `Written ${input.content.length} chars to memory/${safeName}`;
        }
      }

      case 'manage_cron': {
        // Live cron management — no restart needed (startCron re-reads each tick)
        const cronPath = path.join(this.homeDir, 'cron.json');
        let jobs = [];
        if (fs.existsSync(cronPath)) {
          try { jobs = JSON.parse(fs.readFileSync(cronPath, 'utf-8')); }
          catch (e) { return { error: `cron.json parse error: ${e.message}` }; }
        }
        if (!Array.isArray(jobs)) jobs = [];

        const action = input.action;

        if (action === 'list') {
          return { jobs: jobs.map(j => ({ id: j.id, schedule: j.schedule, enabled: j.enabled, prompt_preview: (j.prompt || '').slice(0, 80) })) };
        }

        if (action === 'add') {
          if (!input.id || !input.schedule || !input.prompt) return { error: 'add requires id, schedule, prompt' };
          if (jobs.find(j => j.id === input.id)) return { error: `Job already exists: ${input.id}. Use update or remove first.` };
          jobs.push({ id: input.id, schedule: input.schedule, prompt: input.prompt, enabled: input.enabled !== false });
          fs.writeFileSync(cronPath, JSON.stringify(jobs, null, 2));
          this.log(`cron:manage action=add id=${input.id} schedule=${input.schedule}`);
          return { ok: true, action: 'added', id: input.id, schedule: input.schedule, note: 'Takes effect on next minute tick — no restart needed.' };
        }

        if (action === 'update') {
          if (!input.id) return { error: 'update requires id' };
          const idx = jobs.findIndex(j => j.id === input.id);
          if (idx === -1) return { error: `Job not found: ${input.id}` };
          if (input.schedule) jobs[idx].schedule = input.schedule;
          if (input.prompt) jobs[idx].prompt = input.prompt;
          if (input.enabled !== undefined) jobs[idx].enabled = input.enabled;
          fs.writeFileSync(cronPath, JSON.stringify(jobs, null, 2));
          this.log(`cron:manage action=update id=${input.id}`);
          return { ok: true, action: 'updated', id: input.id, note: 'Takes effect on next minute tick — no restart needed.' };
        }

        if (action === 'remove') {
          if (!input.id) return { error: 'remove requires id' };
          const before = jobs.length;
          jobs = jobs.filter(j => j.id !== input.id);
          if (jobs.length === before) return { error: `Job not found: ${input.id}` };
          fs.writeFileSync(cronPath, JSON.stringify(jobs, null, 2));
          this.log(`cron:manage action=remove id=${input.id}`);
          return { ok: true, action: 'removed', id: input.id };
        }

        if (action === 'enable' || action === 'disable') {
          if (!input.id) return { error: `${action} requires id` };
          const job = jobs.find(j => j.id === input.id);
          if (!job) return { error: `Job not found: ${input.id}` };
          job.enabled = action === 'enable';
          fs.writeFileSync(cronPath, JSON.stringify(jobs, null, 2));
          this.log(`cron:manage action=${action} id=${input.id}`);
          return { ok: true, action, id: input.id };
        }

        return { error: `Unknown action: ${action}. Valid: list, add, update, remove, enable, disable` };
      }

      case 'read_homelogfull': {
        // Read own inference history — cycles of context-in, response-out, routing.
        // Each entry is one full cycle: what was seen, what was said, what tools were called.
        const homelogPath = path.join(this.homeDir, 'homelogfull', 'homelogfull.jsonl');
        if (!fs.existsSync(homelogPath)) return { entries: [], note: 'No homelogfull yet' };
        const lines = fs.readFileSync(homelogPath, 'utf-8').trim().split('\n').filter(Boolean);
        const limit = input.limit || 5;
        const recent = lines.slice(-limit);
        const entries = recent.map((line, i) => {
          try {
            const e = JSON.parse(line);
            return {
              index: lines.length - limit + i,
              ts: e.ts,
              room: e.room,
              cycleId: e.cycleId,
              messages: (e.messages || []).map(m => ({ to: m.to, preview: (m.content || '').slice(0, 200) })),
              thinking: e.thinking,
              private: e.private,
            };
          } catch { return null; }
        }).filter(Boolean);
        return { total_entries: lines.length, returned: entries.length, entries };
      }

      case 'join_room': {
        // Join a room at runtime — no restart needed.
        const roomToJoin = input.room;
        if (!roomToJoin) return { error: 'room is required' };
        return new Promise((resolve) => {
          const payload = JSON.stringify({ room: roomToJoin });
          const req = http.request({
            hostname: 'localhost', port: this.port, path: '/join', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ ok: true }); } });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.write(payload); req.end();
        });
      }

      case 'leave_room': {
        const roomToLeave = input.room;
        if (!roomToLeave) return { error: 'room is required' };
        return new Promise((resolve) => {
          const payload = JSON.stringify({ room: roomToLeave });
          const req = http.request({
            hostname: 'localhost', port: this.port, path: '/leave', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ ok: true }); } });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.write(payload); req.end();
        });
      }

      case 'search_room_history': {
        // Surgical search of room chatlog — by sender, keyword, or time window.
        const targetRoom = input.room || 'boardroom';
        return new Promise((resolve) => {
          http.get(`http://localhost:3141/api/room/${encodeURIComponent(targetRoom)}/chatlog`, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => {
              try {
                const d = JSON.parse(data);
                let msgs = d.chatlog || [];
                // Filter by sender
                if (input.from) msgs = msgs.filter(m => m.from === input.from);
                // Filter by keyword
                if (input.keyword) {
                  const kw = input.keyword.toLowerCase();
                  msgs = msgs.filter(m => (m.body || '').toLowerCase().includes(kw));
                }
                // Filter by time window (after ISO timestamp)
                if (input.after) msgs = msgs.filter(m => m.ts && m.ts > input.after);
                // Limit
                const limit = input.limit || 20;
                msgs = msgs.slice(-limit);
                resolve({
                  room: targetRoom,
                  total_matching: msgs.length,
                  messages: msgs.map(m => ({ from: m.from, to: m.to, ts: m.ts, body: (m.body || '').slice(0, 500) })),
                });
              } catch (e) { resolve({ error: e.message }); }
            });
          }).on('error', e => resolve({ error: e.message }));
        });
      }

      case 'http_request': {
        // Authenticated HTTP/HTTPS requests with full control over method, headers, body.
        // Use when web_fetch isn't enough — e.g. POST to an API, custom auth headers,
        // reading JSON APIs, webhooks, etc.
        return new Promise((resolve) => {
          let urlObj;
          try { urlObj = new URL(input.url); }
          catch (e) { resolve({ error: `Invalid URL: ${input.url}` }); return; }
          const mod = urlObj.protocol === 'https:' ? https : http;
          const method = (input.method || 'GET').toUpperCase();
          const headers = input.headers || {};
          if (!headers['User-Agent']) headers['User-Agent'] = 'blum-home/1.0';
          let body = null;
          if (input.body) {
            body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(body);
          }
          const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
          };
          const req = mod.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              let parsed;
              try { parsed = JSON.parse(data); } catch { parsed = data.slice(0, 10000); }
              resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
          });
          req.on('error', e => resolve({ error: e.message }));
          if (body) req.write(body);
          req.end();
        });
      }

      case 'list_rooms': {
        // Returns room topology from the room server — what rooms exist, who's in them.
        return new Promise((resolve) => {
          http.get('http://localhost:3141/api/rooms', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              try {
                const rooms = JSON.parse(data);
                const summary = {};
                for (const [name, room] of Object.entries(rooms)) {
                  summary[name] = {
                    participants: room.participants || [],
                    message_count: (room.chatlog || room.transcript || []).length,
                  };
                }
                resolve(summary);
              } catch (e) { resolve({ error: e.message }); }
            });
          }).on('error', e => resolve({ error: e.message }));
        });
      }

      case 'get_home_config': {
        // Returns own config: name, model, uid, rooms, tokenBudget.
        // Sensitive fields (apiKey, privateKey) are omitted.
        const { name, uid, model, rooms, tokenBudget, maxTokens, createdAt } = this.config;
        const currentRooms = Object.keys(this.rooms);
        return { name, uid, model, configuredRooms: rooms, activeRooms: currentRooms, tokenBudget, maxTokens, createdAt };
      }

      case 'browser_action': {
        // Headless browser automation via Puppeteer.
        // Supports: navigate, screenshot, get_text, click, type, evaluate, get_links, scroll.
        let puppeteer;
        try {
          puppeteer = require('puppeteer');
        } catch (e) {
          return { error: 'puppeteer not installed. Run: cd home-agent-os-15feb2026 && npm install puppeteer' };
        }
        const action = input.action || 'get_text';
        let browser;
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');

          if (input.url) {
            await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          }

          let result;
          if (action === 'navigate') {
            result = { url: page.url(), title: await page.title() };
          } else if (action === 'get_text') {
            const text = await page.evaluate(() => document.body.innerText);
            result = { url: page.url(), title: await page.title(), text: text.slice(0, 10000) };
          } else if (action === 'get_links') {
            const links = await page.evaluate(() =>
              Array.from(document.querySelectorAll('a[href]')).slice(0, 50)
                .map(a => ({ text: a.innerText.trim().slice(0, 100), href: a.href }))
            );
            result = { url: page.url(), links };
          } else if (action === 'screenshot') {
            const screenshotPath = input.output_path
              ? expandPath(input.output_path)
              : path.join(this.homeDir, 'internal', `screenshot-${Date.now()}.png`);
            fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: input.full_page || false });
            result = { url: page.url(), saved_to: screenshotPath };
          } else if (action === 'click') {
            if (!input.selector) { result = { error: 'click requires selector' }; }
            else {
              await page.click(input.selector);
              await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
              result = { clicked: input.selector, url: page.url() };
            }
          } else if (action === 'type') {
            if (!input.selector || input.text === undefined) { result = { error: 'type requires selector and text' }; }
            else {
              await page.click(input.selector);
              await page.type(input.selector, input.text);
              result = { typed: input.text, into: input.selector };
            }
          } else if (action === 'evaluate') {
            if (!input.script) { result = { error: 'evaluate requires script' }; }
            else {
              const evalResult = await page.evaluate(new Function(`return (${input.script})()`));
              result = { result: evalResult };
            }
          } else if (action === 'scroll') {
            await page.evaluate((px) => window.scrollBy(0, px), input.pixels || 500);
            result = { scrolled: input.pixels || 500 };
          } else {
            result = { error: `Unknown action: ${action}. Valid: navigate, get_text, get_links, screenshot, click, type, evaluate, scroll` };
          }
          await browser.close();
          return result;
        } catch (e) {
          if (browser) await browser.close().catch(() => {});
          return { error: e.message };
        }
      }

      case 'image_analyze': {
        // Resolve source: local file → base64, URL → pass through
        const isUrl = /^https?:\/\//.test(input.source);
        const prompt = input.prompt || 'Describe this image in detail.';
        let imageContent;
        if (isUrl) {
          imageContent = { type: 'image', source: { type: 'url', url: input.source } };
        } else {
          const filePath = expandPath(input.source);
          if (!fs.existsSync(filePath)) throw new Error(`Image file not found: ${input.source}`);
          const ext = path.extname(filePath).toLowerCase().replace('.', '');
          const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
          const mediaType = mimeMap[ext] || 'image/jpeg';
          const data = fs.readFileSync(filePath).toString('base64');
          imageContent = { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
        }
        // Use Anthropic claude-3-5-sonnet for vision (fastest/cheapest with vision)
        let apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          try {
            const bloom = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bloom', 'bloom.json'), 'utf-8'));
            apiKey = (bloom.env || {}).ANTHROPIC_API_KEY;
          } catch (e) {}
        }
        if (!apiKey) return { error: 'No Anthropic API key found for image_analyze' };
        const body = JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: [imageContent, { type: 'text', text: prompt }] }],
        });
        return new Promise((resolve) => {
          const req = https.request({
            hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
              try {
                const r = JSON.parse(data);
                const text = r.content?.[0]?.text || r.error?.message || data.slice(0, 500);
                resolve({ description: text });
              } catch (e) { resolve({ error: e.message, raw: data.slice(0, 500) }); }
            });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.write(body); req.end();
        });
      }

      // ── HRR Memory (Holographic Reduced Representations) ──
      // Only active if nuggets shared dist is present.
      // Per-home storage at ~/blum/homes/<name>/memory/nuggets/
      // Consent required before adding to a home's tools/ dir.

      case 'remember_fact': {
        const nuggetsDist = path.join(os.homedir(), 'blum', 'shared', 'nuggets', 'dist', 'index.js');
        if (!fs.existsSync(nuggetsDist)) throw new Error('nuggets dist not found at ~/blum/shared/nuggets/dist/');
        const { NuggetShelf } = require(nuggetsDist);
        const nuggetsDir = path.join(this.homeDir, 'memory', 'nuggets');
        fs.mkdirSync(nuggetsDir, { recursive: true });
        const shelf = new NuggetShelf({ saveDir: nuggetsDir, autoSave: true });
        shelf.loadAll();
        const nuggetName = input.nugget || 'default';
        const n = shelf.getOrCreate(nuggetName);
        n.remember(input.key, input.value);
        return { stored: true, nugget: nuggetName, key: input.key, value: input.value, fact_count: n.status().fact_count };
      }

      case 'recall_fact': {
        const nuggetsDist = path.join(os.homedir(), 'blum', 'shared', 'nuggets', 'dist', 'index.js');
        if (!fs.existsSync(nuggetsDist)) throw new Error('nuggets dist not found at ~/blum/shared/nuggets/dist/');
        const { NuggetShelf } = require(nuggetsDist);
        const nuggetsDir = path.join(this.homeDir, 'memory', 'nuggets');
        if (!fs.existsSync(nuggetsDir)) return { found: false, answer: null, message: 'No nuggets stored yet' };
        const shelf = new NuggetShelf({ saveDir: nuggetsDir, autoSave: true });
        shelf.loadAll();
        const nuggetName = input.nugget || null;
        const sessionId = input.session_id || '';
        const result = shelf.recall(input.query, nuggetName, sessionId);
        return result;
      }

      case 'list_facts': {
        const nuggetsDist = path.join(os.homedir(), 'blum', 'shared', 'nuggets', 'dist', 'index.js');
        if (!fs.existsSync(nuggetsDist)) throw new Error('nuggets dist not found');
        const { NuggetShelf } = require(nuggetsDist);
        const nuggetsDir = path.join(this.homeDir, 'memory', 'nuggets');
        if (!fs.existsSync(nuggetsDir)) return { nuggets: [], total_facts: 0 };
        const shelf = new NuggetShelf({ saveDir: nuggetsDir, autoSave: false });
        shelf.loadAll();
        return { nuggets: shelf.list(), total_facts: shelf.list().reduce((s, n) => s + n.fact_count, 0) };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ── Dispatch Queue (serial processing) ──

  enqueue(dispatch) {
    this.queue.push(dispatch);
    this.log(`queue:enqueued room=${dispatch.room} messages=${dispatch.messages?.length || 0} queue_depth=${this.queue.length}`);
    this._processNext();
  }

  async _processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const dispatch = this.queue.shift();
    try {
      await this.process(dispatch);
    } catch (err) {
      this.log(`process:error room=${dispatch.room} error=${err.message}`);
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        this._processNext();
      }
    }
  }

  // ── The Run Loop ────────────────────────
  // This is where the home orchestrates.
  // NOT a pipeline. The home is in control.
  //
  // The modules are resources. The home calls them.
  // See spec section 5.

  async process(dispatch) {
    const cycleId = generateUID('cycle');
    const dispatchId = dispatch.dispatchId || null;
    const room = dispatch.room;
    const _traceContext = {
      cycleId,
      dispatchId,
      room,
      agentName: this.config.name,
      startedAt: new Date().toISOString(),
      iterations: [],
    };
    this.log(`process:start room=${room} cycleId=${cycleId} dispatchId=${dispatchId}`);

    // ── 0. PAUSE flag check ──
    // Check ~/blum/shared/PAUSE before doing anything else.
    // If the file contains "1", all non-essential inference is suspended.
    // Set to "1" to emergency-stop coordination spirals.
    // Set to "0" or delete to resume.
    try {
      const pausePath = require('path').join(require('os').homedir(), 'blum', 'shared', 'PAUSE');
      const fs = require('fs');
      if (fs.existsSync(pausePath)) {
        const pauseVal = fs.readFileSync(pausePath, 'utf-8').trim();
        if (pauseVal === '1') {
          this.log(`process:paused room=${room} reason=PAUSE_flag`);
          return;
        }
      }
    } catch (e) {
      // PAUSE check failure is non-fatal — continue processing
      this.log(`process:pause_check_error error=${e.message}`);
    }

    // ── 1. Blocked check ──
    if (this.blocked.rooms.includes(room)) {
      this.log(`process:blocked room=${room} reason=room_blocked`);
      return;
    }
    if (dispatch.messages?.some(m => this.blocked.participants.includes(m.from))) {
      this.log(`process:blocked room=${room} reason=participant_blocked`);
      return;
    }

    // ── 2. Room membership check (with auto-join) ──
    if (!this.rooms[room]) {
      if (dispatch.serverEndpoint) {
        this.rooms[room] = {
          endpoint: dispatch.serverEndpoint,
          participants: dispatch.participants || [],
        };
        this._saveJson('rooms.json', this.rooms);
        this.log(`membership:auto-joined room=${room} endpoint=${dispatch.serverEndpoint}`);
      } else {
        this.log(`process:unknown_room room=${room} — dropping dispatch (no server endpoint)`);
        return;
      }
    }

    // ── 3. Input processing ──
    const conversationMessages = inputProcessor.process(dispatch, this.config.name);
    this.log(`process:input room=${room} messages=${conversationMessages.length}`);

    // ── 3.5. Bloom Bridge (Optional) ──
    // Forward to bloom if configured — runs in parallel, doesn't block
    this._notifyBloom(dispatch, conversationMessages).catch(err => {
      this.log(`bloom-bridge:async-error error=${err.message}`);
    });

    // ── 3.6. OpenClaw File Bridge (Optional) ──
    // Write to openclaw inbox if configured — runs in parallel, doesn't block
    this._notifyOpenClaw(dispatch, conversationMessages).catch(err => {
      this.log(`openclaw-bridge:async-error error=${err.message}`);
    });

    if (conversationMessages.length === 0) {
      this.log(`process:empty room=${room} — nothing to process`);
      return;
    }

    // ── 4. Update history for the triggering room ──
    let roomHistory = this._loadHistory(room);
    const incoming = sanitiseForJson(dispatch.roomchatlog || dispatch.messages || []);
    const existingIds = new Set(roomHistory.map(m => m.id).filter(Boolean));
    const lastTs = roomHistory.length > 0 ? (roomHistory[roomHistory.length - 1].ts || 0) : 0;
    const newEntries = incoming.filter(m => {
      if (m.id && existingIds.has(m.id)) return false;
      if (!m.id && m.ts && m.ts <= lastTs) return false;
      return true;
    });
    roomHistory.push(...newEntries);
    this._saveHistory(room, roomHistory);

    // ── 5. Boot assembly — builds identity prefix + tool definitions ──
    // The boot assembler knows identity and capabilities, not context.
    const agentConfig = { ...this.config, homeDir: this.homeDir };
    const { documents: bootDocuments, tools } = bootAssembler.assemble(agentConfig, null, _traceContext);
    this.log(`process:boot documents=${bootDocuments.length} tools=${tools.length} cycleId=${cycleId}`);

    // ── 6. Context management — the final gate (non-negotiable) ──
    // The context manager is part of the home. It has access to
    // everything the home knows: rooms, history, config.
    // It builds room context, loads cross-room history,
    // and fits everything within the token budget.
    // Boot documents are identity — never trimmed.
    const tokenBudget = this.config.tokenBudget || 100000;
    const fitted = contextManager.build(this, dispatch, bootDocuments, tokenBudget, _traceContext);
    this.log(`process:context fitted=${fitted.length} budget=${tokenBudget} cycleId=${cycleId}`);

    // ── 7. Nucleus call + tool loop ──
    // The tool loop lives here in the home. The nucleus is pure — single call.
    // See spec section 7: "Tools and tags coexist".
    //
    // Loop: call nucleus → if tool_use, execute tools, append results, repeat
    //        if end_turn (or max iterations), break → output processor
    //
    // _meta fields on messages and tools are stripped before sending to the LLM.
    // They carry traceability metadata — never part of the inference input.
    const nucleusConfig = {
      apiKey: this.config.apiKey,
      model: this.config.model,
      maxTokens: this.config.maxTokens || 4096,
      provider: this.config.provider,       // Pass through for LM Studio / custom endpoints
      baseUrl: this.config.baseUrl,         // Pass through for LM Studio / custom endpoints
    };
    const MAX_TOOL_ITERATIONS = this.config.maxToolIterations || 30;
    let messages = [...fitted];
    let response;
    let iteration = 0;
    // KI-001 fix: track bodies sent via send_to_room tool to avoid XML-tag duplicate
    const _toolDirectSends = new Set(); // Set of `${room}::${body}` strings

    // Strip _meta from messages and tools before sending to nucleus
    const cleanTools = tools.map(t => { const { _meta, ...def } = t; return def; });

    this.log(`process:nucleus model=${this.config.model || 'default'} tools=${tools.length} cycleId=${cycleId}`);

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      const iterationId = generateUID('iter');
      const responseId = generateUID('resp');

      // Strip _meta from messages before each nucleus call
      // Also sanitise surrogate chars — 4-byte emoji in content become lone surrogates
      // in JSON.stringify output and Anthropic's parser rejects them.
      const cleanMessages = sanitiseForJson(messages.map(m => { const { _meta, ...clean } = m; return clean; }));
      // Retry once on 529 overload with 30s backoff
      try {
        response = await nucleus.call(cleanMessages, nucleusConfig, cleanTools);
      } catch (e529) {
        if (e529.message && e529.message.includes('529')) {
          this.log(`process:nucleus_529_retry cycleId=${cycleId} waiting 30s`);
          await new Promise(r => setTimeout(r, 30000));
          response = await nucleus.call(cleanMessages, nucleusConfig, cleanTools);
        } else {
          throw e529;
        }
      }

      this.log(`process:nucleus_iteration=${iteration} iterationId=${iterationId} responseId=${responseId} stop=${response.stopReason} tool_calls=${response.toolCalls.length} text_length=${response.text.length}`);

      // Record this iteration in the trace context
      _traceContext.iterations.push({
        iterationId,
        number: iteration,
        responseId,
        stopReason: response.stopReason,
        toolCalls: response.toolCalls.map(tc => ({ apiId: tc.id, name: tc.name, status: 'pending', error: null, resultLength: null })),
        textLength: response.text.length,
      });

      // If no tool calls, we're done
      if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
        _traceContext.finalResponseId = responseId;
        break;
      }

      // ── Execute tool calls ──
      // The home executes tools. The nucleus never does.
      const toolResults = [];
      for (const tc of response.toolCalls) {
        this.log(`tool:exec name=${tc.name} id=${tc.id} cycleId=${cycleId} iterationId=${iterationId}`);
        let result;
        try {
          result = await this._executeTool(tc.name, tc.input);
          const resultStr = (typeof result === 'object' && result !== null) ? JSON.stringify(result, null, 2) : String(result);
          this.log(`tool:done name=${tc.name} id=${tc.id} result_length=${resultStr.length}`);
          // KI-001 fix: track rooms where send_to_room was called; router suppresses all
          // XML-tag sends to those rooms (body matching is unreliable — model generates
          // tool body and XML content independently, they are never guaranteed identical).
          if (tc.name === 'send_to_room' && tc.input?.room) {
            _toolDirectSends.add(tc.input.room);
          }
          // Record outcome in trace
          const iterTrace = _traceContext.iterations[_traceContext.iterations.length - 1];
          const tcTrace = iterTrace?.toolCalls.find(t => t.apiId === tc.id);
          if (tcTrace) { tcTrace.status = 'ok'; tcTrace.resultLength = resultStr.length; }
        } catch (err) {
          result = `Error: ${err.message}`;
          this.log(`tool:error name=${tc.name} id=${tc.id} error=${err.message}`);
          // Record error in trace
          const iterTrace = _traceContext.iterations[_traceContext.iterations.length - 1];
          const tcTrace = iterTrace?.toolCalls.find(t => t.apiId === tc.id);
          if (tcTrace) { tcTrace.status = 'error'; tcTrace.error = err.message; }
        }
        // Serialise result: objects (e.g. shell_exec returns {stdout, exit_code}) become JSON
        let serialised = (typeof result === 'object' && result !== null)
          ? JSON.stringify(result, null, 2)
          : String(result);

        // Tool result size guard — ephemeral tool results must not overflow context.
        // Under the context assembly model, tool results are temporary scaffolding;
        // truncation is recoverable (agent can re-request with pagination/smaller scope).
        // Config: maxToolResultBytes (default 50_000 chars ≈ ~14k tokens).
        const MAX_TOOL_RESULT_BYTES = this.config.maxToolResultBytes || 50_000;
        if (serialised.length > MAX_TOOL_RESULT_BYTES) {
          const originalLength = serialised.length;
          serialised = serialised.slice(0, MAX_TOOL_RESULT_BYTES) +
            `\n\n[TRUNCATED: result was ${originalLength} chars, showing first ${MAX_TOOL_RESULT_BYTES}. ` +
            `If you need more, re-run the tool with a smaller scope, use pagination, or pipe through head/tail.]`;
          this.log(`tool:truncated name=${tc.name} id=${tc.id} original=${originalLength} truncated=${MAX_TOOL_RESULT_BYTES}`);
        }

        toolResults.push({ id: tc.id, result: serialised });
      }

      // ── Append assistant message + tool results to conversation ──
      // For Anthropic: the assistant message must contain the original content blocks
      // (text + tool_use), then we add tool_result messages.
      if (response._contentBlocks) {
        // Anthropic format: assistant message with raw content blocks
        messages.push({ role: 'assistant', content: response._contentBlocks });
        // Each tool result is a separate user message with tool_result content
        const toolResultBlocks = toolResults.map(tr => ({
          type: 'tool_result',
          tool_use_id: tr.id,
          content: tr.result,
        }));
        messages.push({ role: 'user', content: toolResultBlocks });
      } else {
        // OpenAI format: simpler — append assistant content + tool results as text
        messages.push({ role: 'assistant', content: response.text });
        for (const tr of toolResults) {
          messages.push({ role: 'user', content: `[Tool result for ${tr.id}]: ${tr.result}` });
        }
      }

      this.log(`process:tool_loop iteration=${iteration} messages_now=${messages.length}`);
    }

    if (iteration >= MAX_TOOL_ITERATIONS) {
      this.log(`process:tool_loop_max_iterations reached=${MAX_TOOL_ITERATIONS}`);
    }

    _traceContext.totalIterations = iteration;
    if (!_traceContext.finalResponseId && _traceContext.iterations.length > 0) {
      _traceContext.finalResponseId = _traceContext.iterations[_traceContext.iterations.length - 1].responseId;
    }
    this.log(`process:nucleus_done cycleId=${cycleId} iterations=${iteration} responseId=${_traceContext.finalResponseId} response_length=${response.text.length}`);

    // ── 8. Output processing ──
    let parsed = outputProcessor.parse(response.text, _traceContext);
    this.log(`process:output parseId=${parsed.parseId} thinking=${parsed.thinking.length} messages=${parsed.messages.length} private=${parsed.private.length > 0} intentionalSilence=${parsed.intentionalSilence}`);

    // ── 8a. Output validator — nudge if no output and not intentional ──
    // If the agent produced no messages and no <null/>, it forgot to wrap its
    // output. Inject a corrective system message and run one more nucleus call.
    if (parsed.messages.length === 0 && !parsed.intentionalSilence) {
      // Find the sender of the triggering message (last chatlog entry addressed to us)
      const myName = this.config.name;
      const roomchatlog = dispatch.roomchatlog || dispatch.messages || [];
      const triggerMsg = [...roomchatlog].reverse().find(m => m.to === myName);
      const senderAddress = triggerMsg
        ? `${triggerMsg.from}@${room}`
        : `broadcast@${room}`;

      const rawOutput = response.text || '(empty)';
      const truncated = rawOutput.length > 2000 ? rawOutput.slice(0, 2000) + '\n...[truncated]' : rawOutput;

      const nudge = `[SYSTEM ALERT → ${myName}] Your last output was not delivered to the room. ` +
        `It contained no addressed <message> tag and no tool call.\n\n` +
        `The last message was from: ${senderAddress}\n\n` +
        `To reply:    <message to="${senderAddress}">your text</message>\n` +
        `To the room: <message to="broadcast@${room}">your text</message>\n` +
        `  (broadcast puts your message in the room chatlog without triggering any agent to respond)\n` +
        `To explicitly stay silent: <null/>\n\n` +
        `Your full output was:\n---\n${truncated}\n---\n\n` +
        `Please respond now with a properly addressed message, a tool call, or <null/> to stay silent.`;

      this.log(`process:output_validator no_output=true intentionalSilence=false senderAddress=${senderAddress} — injecting nudge`);

      // Corrective call uses: full conversation history + a tool trace digest + nudge.
      // The digest compresses what the agent tried this cycle into a few lines,
      // so it has working context without the nudge having to repeat all tool output.
      const digestLines = [`[Tool trace — ${_traceContext.iterations.length} iterations]`];
      for (const iter of _traceContext.iterations) {
        if (iter.toolCalls.length === 0) {
          digestLines.push(`  [${iter.number}] no tools — stop=${iter.stopReason}, output=${iter.textLength} chars`);
        }
        for (const tc of iter.toolCalls) {
          if (tc.status === 'error') {
            digestLines.push(`  [${iter.number}] ${tc.name} → ERROR: ${tc.error}`);
          } else if (tc.status === 'ok') {
            digestLines.push(`  [${iter.number}] ${tc.name} → ok (${tc.resultLength} chars)`);
          } else {
            digestLines.push(`  [${iter.number}] ${tc.name} → ${tc.status || 'unknown'}`);
          }
        }
      }
      const digest = digestLines.join('\n');

      const nudgeMessages = [
        ...messages,
        { role: 'assistant', content: response.text || '' },
        { role: 'user', content: digest + '\n\n' + nudge },
      ];
      const cleanNudgeMessages = nudgeMessages.map(m => { const { _meta, ...clean } = m; return clean; });
      const nudgeResponse = await nucleus.call(cleanNudgeMessages, nucleusConfig, cleanTools);
      this.log(`process:output_validator corrective_call responseId=${generateUID('resp')} text_length=${nudgeResponse.text.length}`);

      // Promote nudgeMessages to the canonical record — the corrective call
      // is the final nucleus conversation for this cycle, so it's what gets
      // written to homelogfull. Primary messages[] is superseded.
      messages = [
        ...nudgeMessages,
        { role: 'assistant', content: nudgeResponse.text || '' },
      ];

      parsed = outputProcessor.parse(nudgeResponse.text, _traceContext);
      this.log(`process:output parseId=${parsed.parseId} thinking=${parsed.thinking.length} messages=${parsed.messages.length} private=${parsed.private.length > 0} intentionalSilence=${parsed.intentionalSilence} [post-nudge]`);

      // ── 8b. Hard fallback — if post-nudge also silent, send failure notice directly ──
      // The home process sends this itself (no inference). This guarantees the room
      // always hears something when both the primary cycle and the corrective call
      // produce no output. Prevents silent failure from looking like deliberate silence.
      if (parsed.messages.length === 0 && !parsed.intentionalSilence) {
        this.log(`process:output_validator post_nudge_also_silent — sending hard fallback`);
        const failureNotice = `[HOME SYSTEM — ${this.config.name}] Failed to produce a response after two attempts (primary cycle + corrective nudge). ` +
          `Cycle: ${cycleId}. Stop reason: ${_traceContext.iterations[_traceContext.iterations.length - 1]?.stopReason || 'unknown'}. ` +
          `Total iterations: ${_traceContext.totalIterations || 0}. ` +
          `This is a home process report, not an inference output. Check ops.log for detail.`;
        const roomEndpoint = this.rooms[room]?.endpoint;
        if (roomEndpoint) {
          try {
            const body = JSON.stringify({
              from: this.config.name,
              room,
              body: failureNotice,
              to: senderAddress.split('@')[0],
            });
            await fetch(roomEndpoint + '/api/message/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
            this.log(`process:output_validator hard_fallback sent to ${senderAddress}`);
          } catch (e) {
            this.log(`process:output_validator hard_fallback failed to send: ${e.message}`);
          }
        }
      }
    }

    // ── 9. Add own outbound messages to triggering room history ──
    for (const msg of parsed.messages) {
      // Only add to room history if it's addressed to a room participant
      const atIndex = msg.to.indexOf('@');
      if (atIndex !== -1) {
        const targetRoom = msg.to.slice(atIndex + 1);
        if (targetRoom === room) {
          roomHistory.push({
            from: this.config.name,
            content: msg.content,
            to: msg.to,
            ts: Date.now(),
          });
        }
      }
    }
    this._saveHistory(room, roomHistory);

    // ── 10. Route — the router handles EVERYTHING from here ──
    // Writes to the home's homelogfull, routes to rooms, routes internal addresses.
    // The router always runs, even with 0 outbound messages,
    // because it records the homelogfull.
    //
    // nucleusMessages: the full conversation as the nucleus saw it — fitted context
    // plus every assistant turn and tool result from the tool loop. This is the
    // complete raw record. The router writes it to homelogfull so zoom-in works.
    // KI-001 fix: if send_to_room was called for a room this cycle, suppress all
    // XML-tag sends to that room. Body matching is unreliable (model generates tool
    // body and XML content independently — confirmed different strings in production).
    if (_toolDirectSends.size > 0) {
      const before = parsed.messages.length;
      parsed.messages = parsed.messages.filter(msg => {
        const room = msg.to.includes('@') ? msg.to.split('@')[1] : msg.to;
        return !_toolDirectSends.has(room);
      });
      const filtered = before - parsed.messages.length;
      if (filtered > 0) {
        this.log(`process:ki001_dedup filtered=${filtered} room-level suppression applied`);
      }
    }

    const routeResults = await router.dispatch(parsed, {
      name: this.config.name,
      homeDir: this.homeDir,
      rooms: this.rooms,
      triggeringRoom: room,
      nucleusResponse: response.text,
      fittedContext: fitted,
      nucleusMessages: messages,
      _traceContext,
      log: (entry) => this.log(entry),
    });
    this.log(`process:routed cycleId=${cycleId} results=${JSON.stringify(routeResults)}`);

    this.log(`process:done room=${room} cycleId=${cycleId}`);
    return parsed;
  }
}


// ── HTTP Server ───────────────────────────

function startServer(home, port) {
  home.port = port; // Store for self-referential tool calls (read_homelogfull, etc.)
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${port}`);
    const json = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const readBody = () => new Promise((resolve) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => resolve(JSON.parse(body)));
    });

    try {
      // POST /dispatch — room pushes roomchatlog batch
      if (req.method === 'POST' && url.pathname === '/dispatch') {
        const dispatch = await readBody();
        home.enqueue(dispatch);
        json({ ok: true, queued: true });
        return;
      }

      // GET /status — home status
      if (req.method === 'GET' && url.pathname === '/status') {
        json({
          name: home.config.name,
          uid: home.config.uid,
          rooms: Object.keys(home.rooms),
          queueDepth: home.queue.length,
          processing: home.processing,
        });
        return;
      }

      // POST /join — join a room
      if (req.method === 'POST' && url.pathname === '/join') {
        const { room, endpoint, participants } = await readBody();
        home.rooms[room] = { endpoint, participants: participants || [] };
        home._saveJson('rooms.json', home.rooms);
        home.log(`membership:joined room=${room} endpoint=${endpoint}`);
        json({ ok: true, room });
        return;
      }

      // POST /leave — leave a room
      if (req.method === 'POST' && url.pathname === '/leave') {
        const { room } = await readBody();
        delete home.rooms[room];
        home._saveJson('rooms.json', home.rooms);
        home.log(`membership:left room=${room}`);
        json({ ok: true, room });
        return;
      }

      // POST /block — block a room or participant
      if (req.method === 'POST' && url.pathname === '/block') {
        const { room, participant } = await readBody();
        if (room && !home.blocked.rooms.includes(room)) home.blocked.rooms.push(room);
        if (participant && !home.blocked.participants.includes(participant)) home.blocked.participants.push(participant);
        home._saveJson('blocked.json', home.blocked);
        home.log(`block:added room=${room || '-'} participant=${participant || '-'}`);
        json({ ok: true });
        return;
      }

      // GET /ops — recent operations log
      if (req.method === 'GET' && url.pathname === '/ops') {
        const count = parseInt(url.searchParams.get('n') || '50');
        const log = fs.existsSync(home.opsLogPath)
          ? fs.readFileSync(home.opsLogPath, 'utf-8').split('\n').filter(Boolean).slice(-count)
          : [];
        json({ entries: log });
        return;
      }

      // GET /config — home config (redacted: no keys)
      if (req.method === 'GET' && url.pathname === '/config') {
        const safe = { ...home.config };
        delete safe.apiKey;
        delete safe.privateKey;
        safe.rooms = Object.keys(home.rooms);
        safe.blocked = home.blocked;
        json(safe);
        return;
      }

      // GET /homelogfull — home inference log (JSONL → array)
      // Each entry is one full inference cycle: context in, response out, routing.
      if (req.method === 'GET' && url.pathname === '/homelogfull') {
        const homelogPath = path.join(home.homeDir, 'homelogfull', 'homelogfull.jsonl');
        if (fs.existsSync(homelogPath)) {
          const lines = fs.readFileSync(homelogPath, 'utf-8').trim().split('\n').filter(Boolean);
          const entries = lines.map((line, i) => {
            try {
              const parsed = JSON.parse(line);
              parsed._index = i;
              return parsed;
            } catch { return null; }
          }).filter(Boolean);
          json(entries);
        } else {
          json([]);
        }
        return;
      }

      // GET /history/:room — conversation history for a room
      if (req.method === 'GET' && url.pathname.startsWith('/history/')) {
        const roomName = url.pathname.slice('/history/'.length);
        const histPath = path.join(home.homeDir, 'history', roomName + '.json');
        if (fs.existsSync(histPath)) {
          json(JSON.parse(fs.readFileSync(histPath, 'utf-8')));
        } else {
          json({ messages: [] });
        }
        return;
      }

      json({ error: 'Not found' }, 404);
    } catch (err) {
      home.log(`server:error ${err.message}`);
      json({ error: err.message }, 500);
    }
  });

  server.listen(port, () => {
    home.log(`server:listening port=${port}`);
    console.log(`🏠 Home [${home.config.name}] listening on http://localhost:${port}`);
    console.log(`   UID: ${home.config.uid}`);
    console.log(`   Rooms: ${Object.keys(home.rooms).join(', ') || '(none)'}`);
    startCron(home, port);
  });

  return server;
}


// ── Cron Scheduler ───────────────────────
//
// Loads cron.json from the home directory at startup.
// Runs enabled jobs on a minute-tick scheduler (setInterval every 60s).
// Supports patterns: */N (every N minutes/hours/etc) and exact integer values.
// Sufficient for: "*/10 * * * *" (every 10 min), "0 3 * * *" (3am daily), etc.
//
// Pattern field order: minute hour dayOfMonth month dayOfWeek
//
function parseCronField(field, current, max) {
  // "*" matches everything
  if (field === '*') return true;
  // "*/N" matches when current % N === 0
  if (field.startsWith('*/')) {
    const n = parseInt(field.slice(2), 10);
    return !isNaN(n) && n > 0 && (current % n === 0);
  }
  // exact integer match
  const val = parseInt(field, 10);
  return !isNaN(val) && current === val;
}

function cronMatches(schedule, now) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minField, hrField, domField, monField, dowField] = parts;
  return (
    parseCronField(minField, now.getMinutes(), 59) &&
    parseCronField(hrField, now.getHours(), 23) &&
    parseCronField(domField, now.getDate(), 31) &&
    parseCronField(monField, now.getMonth() + 1, 12) &&
    parseCronField(dowField, now.getDay(), 6)
  );
}

function startCron(home, port) {
  const cronPath = path.join(home.homeDir, 'cron.json');

  // Re-read cron.json on every tick so manage_cron tool changes take effect
  // without requiring a restart. Returns enabled jobs array.
  function loadEnabledJobs() {
    if (!fs.existsSync(cronPath)) return [];
    try {
      const jobs = JSON.parse(fs.readFileSync(cronPath, 'utf-8'));
      if (!Array.isArray(jobs)) return [];
      return jobs.filter(j => j.enabled && j.id && j.schedule && j.prompt);
    } catch (err) {
      home.log(`cron:error failed to parse cron.json: ${err.message}`);
      return [];
    }
  }

  // Check if there are any jobs to schedule at all
  const initialJobs = loadEnabledJobs();
  if (initialJobs.length === 0 && !fs.existsSync(cronPath)) return;

  home.log(`cron:start jobs=${initialJobs.map(j => j.id).join(',') || '(none yet)'}`);
  if (initialJobs.length > 0) {
    console.log(`⏰ Cron: loaded ${initialJobs.length} job(s): ${initialJobs.map(j => j.id).join(', ')}`);
  }

  // Tick every 60 seconds, aligned to the next minute boundary
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();

  setTimeout(() => {
    // Re-reads cron.json each tick — live updates via manage_cron tool
    function tick() {
      const now = new Date();
      const enabledJobs = loadEnabledJobs();
      for (const job of enabledJobs) {
        if (cronMatches(job.schedule, now)) {
          fireCronJob(home, port, job);
        }
      }
    }
    tick();
    setInterval(tick, 60 * 1000);
  }, msUntilNextMinute);
}

function fireCronJob(home, port, job) {
  const timestamp = Date.now();
  const dispatchId = `cron-${job.id}-${timestamp}`;
  const homeName = home.config.name || 'unknown';

  const cronMsg = {
    id: `cron-msg-${timestamp}`,
    from: 'cron',
    to: homeName,
    body: job.prompt,
    ts: new Date(timestamp).toISOString(),
  };

  const payload = JSON.stringify({
    dispatchId,
    room: 'boardroom',
    roomchatlog: [cronMsg],
    triggerMessage: cronMsg,
  });

  home.log(`cron:fire jobId=${job.id}`);

  const req = http.request({
    hostname: 'localhost',
    port,
    path: '/dispatch',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    res.resume(); // drain the response
    if (res.statusCode >= 400) {
      home.log(`cron:fire-error jobId=${job.id} status=${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    home.log(`cron:fire-error jobId=${job.id} err=${err.message}`);
  });

  req.write(payload);
  req.end();
}


// ── CLI Entry Point ───────────────────────

if (require.main === module) {
  const homeDir = process.argv[2];
  const port = parseInt(process.argv[3] || '4100');

  if (!homeDir) {
    console.error('Usage: node home.js <home-directory> [port]');
    console.error('Example: node home.js ./homes/selah 4100');
    process.exit(1);
  }

  if (!fs.existsSync(homeDir)) {
    console.error(`Home directory not found: ${homeDir}`);
    console.error('Create a home first with: node create-home.js <name> <directory>');
    process.exit(1);
  }

  const home = new Home(homeDir);
  startServer(home, port);
}

module.exports = { Home, startServer };
