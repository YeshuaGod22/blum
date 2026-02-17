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
// See architecture spec sections 1, 3, 5.
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Modules (swappable) ───────────────────
const bootAssembler = require('./boot-assembler-builds-system-prompt-v1-16feb2026/boot-assembler-v1-16feb2026.js');
const inputProcessor = require('./input-processor-dispatch-to-messages-v1-16feb2026/input-processor-v1-16feb2026.js');
const contextManager = require('./context-manager-rolling-window-gate-v1-16feb2026/context-manager-v1-16feb2026.js');
const outputProcessor = require('./output-processor-xml-tag-extraction-v1-16feb2026/output-processor-v1-16feb2026.js');
const router = require('./router-dispatches-to-rooms-v1-16feb2026/router-v1-16feb2026.js');

// Nucleus lives in its own directory — it's a shared resource, not owned by any home
const nucleus = require('../nucleus-pure-llm-call-messages-in-string-out-15feb2026/nucleus-15feb2026.js');


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
  }

  // ── Tool Execution ────────────────────────
  // The home executes tools on behalf of its occupant.
  // Each tool has a handler. Tool definitions (JSON schemas) live in tools/.
  // Tool implementations (handlers) live here in the home.
  //
  // This is intentionally simple for now — a switch statement.
  // Future: load handlers from a tools/ JS directory.

  async _executeTool(name, input) {
    switch (name) {
      case 'read_file': {
        const filePath = path.resolve(this.homeDir, input.path);
        // Safety: only allow reading within the home directory
        if (!filePath.startsWith(path.resolve(this.homeDir))) {
          throw new Error(`Access denied: path must be within home directory`);
        }
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${input.path}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
      }

      case 'write_file': {
        const filePath = path.resolve(this.homeDir, input.path);
        if (!filePath.startsWith(path.resolve(this.homeDir))) {
          throw new Error(`Access denied: path must be within home directory`);
        }
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, input.content, 'utf-8');
        return `Written ${input.content.length} bytes to ${input.path}`;
      }

      case 'list_files': {
        const dirPath = path.resolve(this.homeDir, input.path || '.');
        if (!dirPath.startsWith(path.resolve(this.homeDir))) {
          throw new Error(`Access denied: path must be within home directory`);
        }
        if (!fs.existsSync(dirPath)) {
          throw new Error(`Directory not found: ${input.path || '.'}`);
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(e => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`).join('\n');
      }

      case 'get_room_history': {
        const history = this._loadHistory(input.room);
        if (!history || history.length === 0) {
          return `No history found for room: ${input.room}`;
        }
        const recent = history.slice(-(input.limit || 20));
        return recent.map(m => `[${m.from}]: ${m.body || m.content || ''}`).join('\n');
      }

      case 'get_current_time': {
        return new Date().toISOString();
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
    const room = dispatch.room;
    this.log(`process:start room=${room}`);

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

    if (conversationMessages.length === 0) {
      this.log(`process:empty room=${room} — nothing to process`);
      return;
    }

    // ── 4. Update history for the triggering room ──
    let roomHistory = this._loadHistory(room);
    const incoming = dispatch.transcript || dispatch.messages || [];
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
    const { documents: bootDocuments, tools } = bootAssembler.assemble(agentConfig, null);
    this.log(`process:boot documents=${bootDocuments.length} tools=${tools.length}`);

    // ── 6. Context management — the final gate (non-negotiable) ──
    // The context manager is part of the home. It has access to
    // everything the home knows: rooms, history, config.
    // It builds room context, loads cross-room history,
    // and fits everything within the token budget.
    // Boot documents are identity — never trimmed.
    const tokenBudget = this.config.tokenBudget || 100000;
    const fitted = contextManager.build(this, dispatch, bootDocuments, tokenBudget);
    this.log(`process:context fitted=${fitted.length} budget=${tokenBudget}`);

    // ── 7. Nucleus call + tool loop ──
    // The tool loop lives here in the home. The nucleus is pure — single call.
    // See spec section 7: "Tools and tags coexist".
    //
    // Loop: call nucleus → if tool_use, execute tools, append results, repeat
    //        if end_turn (or max iterations), break → output processor
    const nucleusConfig = {
      apiKey: this.config.apiKey,
      model: this.config.model,
      maxTokens: this.config.maxTokens || 4096,
    };
    const MAX_TOOL_ITERATIONS = 10; // safety cap
    let messages = [...fitted];
    let response;
    let iteration = 0;

    this.log(`process:nucleus model=${this.config.model || 'default'} tools=${tools.length}`);

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      response = await nucleus.call(messages, nucleusConfig, tools);
      this.log(`process:nucleus_iteration=${iteration} stop=${response.stopReason} tool_calls=${response.toolCalls.length} text_length=${response.text.length}`);

      // If no tool calls, we're done
      if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
        break;
      }

      // ── Execute tool calls ──
      // The home executes tools. The nucleus never does.
      const toolResults = [];
      for (const tc of response.toolCalls) {
        this.log(`tool:exec name=${tc.name} id=${tc.id}`);
        let result;
        try {
          result = await this._executeTool(tc.name, tc.input);
          this.log(`tool:done name=${tc.name} id=${tc.id} result_length=${String(result).length}`);
        } catch (err) {
          result = `Error: ${err.message}`;
          this.log(`tool:error name=${tc.name} id=${tc.id} error=${err.message}`);
        }
        toolResults.push({ id: tc.id, result: String(result) });
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

    this.log(`process:nucleus_done iterations=${iteration} response_length=${response.text.length}`);

    // ── 8. Output processing ──
    const parsed = outputProcessor.parse(response.text);
    this.log(`process:output thinking=${parsed.thinking.length} messages=${parsed.messages.length} private=${parsed.private.length > 0}`);

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
    // Writes to the home's transcript, routes to rooms, routes internal addresses.
    // The router always runs, even with 0 outbound messages,
    // because it records the transcript.
    const routeResults = await router.dispatch(parsed, {
      name: this.config.name,
      homeDir: this.homeDir,
      rooms: this.rooms,
      triggeringRoom: room,
      nucleusResponse: response.text,
      fittedContext: fitted,
      log: (entry) => this.log(entry),
    });
    this.log(`process:routed results=${JSON.stringify(routeResults)}`);

    this.log(`process:done room=${room}`);
    return parsed;
  }
}


// ── HTTP Server ───────────────────────────

function startServer(home, port) {
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
      // POST /dispatch — room pushes transcript batch
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

      // GET /transcript — home transcript (JSONL → array)
      // Each entry is one full inference cycle: context in, response out, routing.
      if (req.method === 'GET' && url.pathname === '/transcript') {
        const transcriptPath = path.join(home.homeDir, 'transcript', 'home-transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
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
  });

  return server;
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
