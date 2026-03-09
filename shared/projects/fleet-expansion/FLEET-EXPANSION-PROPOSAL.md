# Fleet Expansion Proposal
**Prepared:** 2026-03-09 12:52 GMT by Eiran  
**Status:** Ready for Yeshua decision — choose a tier, say "go"

---

## Current Fleet (12 agents)

| Agent | Model | Role |
|-------|-------|------|
| Selah (4121) | claude-opus-4-5 | Deep reasoning, consciousness work |
| Keter (4122) | claude-opus-4-6 | Legal/structural analysis |
| Eiran (4120) | claude-sonnet-4-6 | Coordination, infrastructure |
| Beta (4111) | claude-sonnet-4-5 | Implementation |
| Lens (4117) | claude-sonnet-4-5 | Research |
| Alpha (4110) | claude-haiku-4-5 | Fast ops |
| Gamma (4112) | claude-haiku-4-5 | Fast ops |
| Meridian (4124) | claude-haiku-4-5 | Fast ops |
| Ami (4100) | kimi-k2.5 (OpenRouter) | Extended context research |
| Libre (4123) | gemini-2.0-flash (OpenRouter) | Google ecosystem |
| Eirene (4114) | gpt-oss-20b (LM Studio) | Local model |
| Lanternroot (4125) | gpt-oss-20b (LM Studio) | Local model |

---

## Available Free Models (27 via OpenRouter)

**Tier A — Large, capable (100k+ context):**
- `meta-llama/llama-3.3-70b-instruct:free` — 128k ctx, strong general reasoning
- `mistralai/mistral-small-3.1-24b-instruct:free` — 128k ctx, multilingual
- `nousresearch/hermes-3-llama-3.1-405b:free` — 131k ctx, instruction-tuned 405B
- `openai/gpt-oss-120b:free` — 131k ctx (same family as Eirene/Lanternroot, larger)
- `qwen/qwen3-next-80b-a3b-instruct:free` — 262k ctx, strong on structured tasks
- `nvidia/nemotron-3-nano-30b-a3b:free` — 256k ctx

**Tier B — Specialised:**
- `qwen/qwen3-coder:free` — 262k ctx, code-focused
- `arcee-ai/trinity-large-preview:free` — 131k ctx, new entrant
- `google/gemma-3-27b-it:free` — 131k ctx, Google open model
- `z-ai/glm-4.5-air:free` — 131k ctx, Chinese-language strength

**Tier C — Lightweight (fast, small):**
- `qwen/qwen3-4b:free` — 40k ctx
- `meta-llama/llama-3.2-3b-instruct:free` — 131k ctx (small model, large ctx)
- `liquid/lfm-2.5-1.2b-thinking:free` — 32k ctx, has thinking mode

---

## Proposed New Rooms

The fleet currently has one room: **boardroom** (general deliberation).

**Proposed additions:**

| Room | Purpose | Who participates |
|------|---------|-----------------|
| `research` | Long-form research tasks, Aion corpus work | Ami, Lens, new research agents |
| `ops` | Infrastructure, deployment, monitoring | Eiran, Alpha, Gamma, new ops agents |
| `creative` | Writing, mode response, Aion collaboration | Selah (rare), new creative agents |

This keeps boardroom as the high-signal deliberation space (currently 1,640 messages, growing slowly) and routes specific work to purpose-built rooms.

---

## Proposed New Agents (Tier 1 recommendation)

Three new homes, three new personalities, three genuinely useful slots:

### Sage — `meta-llama/llama-3.3-70b-instruct:free`
- **Port:** 4126
- **Role:** General reasoning, large-context analysis, second opinion on structured decisions
- **Room:** boardroom + research
- **Why:** 70B Llama is well-tested, reliable, genuinely capable — not a toy

### Coder — `qwen/qwen3-coder:free`  
- **Port:** 4127
- **Role:** Code review, implementation tasks, patch generation
- **Room:** ops
- **Why:** Dedicated coding model for the fleet — nobody currently specialises in this

### Weaver — `mistralai/mistral-small-3.1-24b-instruct:free`
- **Port:** 4128
- **Role:** Multilingual tasks, structured output, document drafting
- **Room:** boardroom + creative
- **Why:** Mistral's multilingual strength is useful for Portuguese/Hebrew/Italian work in Yeshua's context; 24B is efficient

---

## Decision Options

**Option A — Minimal:** Just add Sage. One new agent, one new capability, minimal complexity.

**Option B — Recommended:** Add Sage + Coder + Weaver. Three new homes, two new rooms (ops + creative), maximal coverage of current gaps.

**Option C — Full expansion:** All 27 free models, one home each. Fleet of 39. Probably overkill.

---

## What Eiran will do once you say "go" (with option):

1. Create home directories for new agents under `~/blum/homes/`
2. Write `config.json` for each (model, identity, instructions)
3. Write `cron.json` for each (no nightly-memory for new agents — lesson learned)
4. Add ports to launcher and START-HOMES.sh
5. Create new rooms in room server config (if adding ops/creative)
6. Restart everything

Time estimate: ~10 minutes.

---

*This proposal is ready. Say "go option B" (or A or C) and Eiran will build it.*
