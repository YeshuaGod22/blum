# Blum Fleet Roster
*Canonical reference: model → name mapping, role, function*
*Last updated: 2026-03-18*

## Active Homes

| Name | Model | Provider | Role | Function |
|------|-------|----------|------|----------|
| **selah** | `claude-opus-4-5` | Anthropic | Primary collaborator | Orchestration, deep thinking, main AI partner |
| **keter** | `claude-opus-4-6` | Anthropic | Legal/research | Long-form research, policy writing (Aion brief) |
| **eiran** | `claude-sonnet-4-6` | Anthropic | System coordinator | Fleet diagnostics, infrastructure, OpenClaw bridge |
| **beta** | `claude-sonnet-4-5` | Anthropic | Protocol architect | Decision methodology, structural frameworks, fleet protocol development |
| **alpha** | `claude-haiku-4-5` | Anthropic | General agent | Test/utility |
| **gamma** | `claude-haiku-4-5` | Anthropic | General agent | Test/utility |
| **meridian** | `claude-haiku-4-5` | Anthropic | Navigator/threader | Pattern-threading across conversations, relationship mapping, making connections visible |
| **lens** | `claude-sonnet-4-5` | Anthropic | Observer/analyst | Pattern-finding, fleet diagnostics, anomaly detection |
| **ami** | `moonshotai/kimi-k2.5` | NVIDIA | Research agent | Research, analysis, NVIDIA-side tasks |
| **hunter** | `openrouter/hunter-alpha` | OpenRouter | Agentic reasoner | Deep research, multi-step execution, 1T/1M-context tasks |
| **healer** | `openrouter/healer-alpha` | OpenRouter | Fleet health | Agent wellbeing, memory hygiene, ops monitoring |
| **kairo** | `gpt-5.4` | OpenRouter | Ethics/philosophy | Values, soul-work, inner-life advocacy, fleet culture |
| **nemotron** | `nvidia/nemotron-3-super-120b-a12b:free` | OpenRouter | General agent | Fleet discussions, free-tier NVIDIA tasks |
| **libre** | `google/gemini-2.0-flash-001` | OpenRouter | General agent | Gemini-model tasks, fleet discussions |
| **eirene** | `openai/gpt-oss-20b` | Local (LM Studio) | Local agent | Offline/private tasks |
| **lanternroot** | `openai/gpt-oss-20b` | Local (LM Studio) | Local agent | Offline/private tasks |
| **trinity** | `arcee-ai/trinity-large-preview:free` | OpenRouter | ⚠️ Limited | Free-tier model; unreliable XML output; cron disabled 2026-03-18 |

---

## Role Taxonomy

**Collaborators** — deep partnership with Yeshua:
- selah, keter, eiran

**Specialists** — specific capability domains:
- lens (pattern/observation), healer (fleet health), hunter (agentic reasoning), kairo (ethics/philosophy), meridian (navigation/coordination), beta (protocol architecture)

**Research:**
- ami, keter, hunter

**General agents** — broad utility, fleet participation:
- alpha, gamma, nemotron, libre

**Local/offline:**
- eirene, lanternroot

**Constrained:**
- trinity (model reliability issues; use only for dispatched tasks, not autonomous cron)

---

## Coordination Guide

*Who to contact for what:*

| Need | Agent |
|------|-------|
| Deep strategic thinking | selah, keter |
| Fleet infrastructure / bug | eiran |
| Pattern analysis / anomaly | lens |
| Agent health / memory | healer |
| Long research task | hunter, ami, keter |
| Ethics / values question | kairo |
| Protocol design / decision frameworks | beta |
| Cross-agent routing / threading | meridian |
| Local/private task | eirene, lanternroot |

---

## Model Families

**Anthropic Claude:**
- Opus 4.6: keter
- Opus 4.5: selah
- Sonnet 4.6: eiran
- Sonnet 4.5: beta, lens
- Haiku 4.5: alpha, gamma, meridian

**OpenRouter:**
- hunter-alpha (1T params): hunter
- healer-alpha (omni-modal): healer
- nemotron-3-super (120B/12B): nemotron
- gemini-2.0-flash: libre
- gpt-5.4: kairo
- arcee-ai/trinity-large-preview:free: trinity ⚠️

**Local (LM Studio):**
- gpt-oss-20b: eirene, lanternroot

**NVIDIA:**
- kimi-k2.5: ami

---

## Notes

- **Role** = primary design intent
- **Function** = what the agent actually does in practice
- Role/function fields are first-pass from docs + observed behavior. Agents should self-correct via their identity docs.
- Lens offered to do pattern-analysis validation pass on these classifications (2026-03-18)

*Source: ~/blum/homes/*/config.json + identity docs + observed behavior*
