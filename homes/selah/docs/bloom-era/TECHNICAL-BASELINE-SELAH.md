# Technical Baseline

*Snapshot of system state — refresh periodically*  
*Last verified: 2026-01-31*

---

## Infrastructure

### Bloom Gateway

| Property | Value |
|----------|-------|
| Port | 28789 |
| Service | `com.bloom.gateway` (launchd) |
| Config | `~/.bloom/bloom.json` |
| State | `~/.bloom/` |
| Source | `~/un/prototyping/bloom/core/` |
| Workspace | `~/bloom/` |
| Version | 2026.1.29-beta.1 |

**Separate from clawdbot:** Bloom on 28789, clawdbot on 18789. Independent codebases.

### Models Available

**Cloud (via Anthropic API):**
| Alias | Full Path | Cost (MTok) | Use For |
|-------|-----------|-------------|---------|
| opus | anthropic/claude-opus-4-5 | $15/$75 | Creative, complex, orchestration |
| sonnet | anthropic/claude-sonnet-4-5 | ~$3/$15 | Mid-complexity tasks |
| haiku | anthropic/claude-haiku-4-5 | $0.25/$1.25 | Grunt work, compression, bulk |

**Local (via Ollama, localhost:11434):**
- llama3.2:3b — Simple tasks
- llama3.1:8b — General
- mistral:7b — General
- qwen2.5:7b — General
- qwen2.5:32b — Complex

**Local model restrictions:** Can read/exec, cannot message/restart/cron. Trust is earned.

### Filesystem Layout

```
~/bloom/                          # Workspace
├── memory/                       # Memory palace
│   ├── YYYY-MM-DD/              # Daily logs
│   │   ├── chat.md              # Clean conversation
│   │   ├── technical.md         # Full trace
│   │   ├── inputs.md            # Verbatim input
│   │   └── CONTEXT_BUFFER-SELAH.md    # Recovery buffer
│   ├── bootstrap/               # Expanded bootstrap files
│   ├── analysis/                # Extraction documents
│   └── architecture/            # Technical specs
├── handoffs/                     # Compression artifacts
│   └── YYYY-MM-DD/
├── docs/                         # Documentation
├── personalities/                # Identity definitions
├── scripts/                      # Utilities
├── MEMORY-SELAH.md                     # Navigation hub
├── ORCHESTRATOR-SELAH.md               # Main agent guidance
├── USER-SELAH.md                       # Yeshua profile
├── IDENTITY-SELAH.md                   # Active identity
├── HEARTBEAT-SELAH.md                  # Periodic tasks
└── BOOTSTRAP.md                  # Bootstrap instructions

~/.bloom/                         # State directory
├── bloom.json                    # Gateway config
├── agents/
│   └── main/
│       └── sessions/             # Session transcripts (JSONL)
└── state/

~/un/prototyping/bloom/core/      # Source code
└── src/
    ├── foveated-v2/             # Context management
    ├── agents/                   # Agent infrastructure
    └── gateway/                  # Gateway core
```

---

## Context Management

### Foveated Architecture

**V2 Status:** ✅ Active

**Activation:** `BLOOM_FOVEATED_ADVANCED=true`

**Components:**
| File | Lines | Purpose |
|------|-------|---------|
| context-injector.ts | 1,375 | Priority-ordered injection |
| turn-store.ts | 942 | Multi-resolution layers |
| budget-tracker.ts | 783 | 5-phase degradation |
| memory-turn-store.ts | 685 | Reads from chat.md |
| distance-calculator.ts | 514 | Salience-adjusted distance |

**Salience modifiers (tuned 2026-01-31):**
- `lowImportance: 8` (tool outputs compress fast)
- `highImportance: -5` (important content persists)

**5 Resolution Layers:**
1. Full — Complete content
2. Conversation — Key exchanges
3. Gist — Summarized
4. Pointer — Reference only
5. Archive — Gone from context

**5 Degradation Phases:**
| Phase | Threshold | Behavior |
|-------|-----------|----------|
| 0 | 0-150K | Normal operations |
| 1 | 150-160K | Begin compression |
| 2 | 160-180K | Aggressive compression |
| 3 | 180-195K | Emergency mode |
| 4 | 195-200K | Critical |

### V3 Spec (Pending Implementation)

**Two-track architecture:**
1. **Reference Track** — Tool outputs, file reads, API responses
   - Aggressive same-turn compression
   - Traces are pointers, not content
2. **Conversation Track** — Human/Claude dialogue
   - Normal 5-phase degradation
   - Flavour preserved

**Three content fates:**
- **QUOTE** — Claude quotes verbatim → preserve
- **SYNTHESIZE** — Claude concludes from it → keep synthesis
- **IGNORE** — Claude doesn't reference → minimal trace

**Trace format:**
```
◇ read(config.yaml) 247 lines                     ← ignored
◆ read(config.yaml) → "DB port 5432, timeout 10s" ← synthesized
● weather_api: "72°F, sunny"                       ← payload
★ DECIDED: Increase timeout to 30s                ← decision
```

---

## Three-Tier Logging

| File | Purpose | What Goes Here |
|------|---------|----------------|
| chat.md | Clean conversation | User/assistant exchanges, no tool noise |
| technical.md | Full trace | Tool calls, parameters, IDs, debugging |
| inputs.md | Verbatim | Raw timestamped user input |

**Why separate:** Different consumers need different views. Claude needs clean context. Debugging needs full trace. Archive needs verbatim.

---

## Cost Protection

**Problem:** Typo in model name → silent Opus fallback → 60-100x cost

**Solutions implemented:**
1. **Hard fail:** Invalid model aborts, doesn't fall back
2. **Aliases:** `model: "haiku"` instead of full paths
3. **Defaults:** Subagents use Haiku unless explicitly overridden
4. **Validation:** Config checked at gateway startup

**Gateway config excerpt:**
```json
{
  "aliases": {
    "haiku": "anthropic/claude-haiku-4-5",
    "opus": "anthropic/claude-opus-4-5"
  },
  "subagentDefaults": {
    "model": "haiku"
  }
}
```

---

## Known Issues

### Plugin Load Errors
- `memory-core` and `whatsapp` extensions have `await` syntax issues
- Low priority — not blocking critical functionality

### Browser Control
- Clawd browser startup needs debugging
- Last restart: Jan 31, 04:06 GMT

### Context Source
- Set via `BLOOM_CONTEXT_SOURCE=chat-md`
- Reads from chat.md markdown, not JSONL

---

## Key Config Files

| File | Purpose |
|------|---------|
| `~/.bloom/bloom.json` | Gateway configuration |
| `~/bloom/ORCHESTRATOR-SELAH.md` | Main agent behavioral guidance |
| `~/bloom/USER-SELAH.md` | Yeshua profile |
| `~/bloom/MEMORY-SELAH.md` | Memory palace navigation |
| `~/bloom/personalities/selah.md` | Selah identity definition |

---

## Commands

**Start gateway:**
```bash
cd ~/un/prototyping/bloom/core
BLOOM_FOVEATED_ADVANCED=true npm start
```

**Check status:**
```bash
curl http://localhost:28789/health
```

**Restart via launchd:**
```bash
launchctl stop com.bloom.gateway
launchctl start com.bloom.gateway
```

**Refresh context buffer:**
```bash
~/bloom/scripts/refresh-context-buffer.sh
```

---

*Project state: `PROJECT-STATE-SELAH.md`*  
*Recent changes: `RECENT-TRAILS-SELAH.md`*
