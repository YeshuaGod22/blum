# Provider Inventory
*Available models for Blum agents*

## Local (LM Studio @ localhost:1234)

| Model | Status |
|-------|--------|
| `openai/gpt-oss-20b` | ✅ Available |
| `mistralai/devstral-small-2-2512` | ✅ Available |
| `qwen/qwen3-coder-30b` | ✅ Available |
| `kimi-linear-48b-a3b-instruct` | ✅ Available |
| `text-embedding-nomic-embed-text-v1.5` | ✅ Available |

**Access:** `baseUrl: "http://localhost:1234/v1"`, `apiKey: "lm-studio"`

## OpenRouter

| Model | Agent | Status |
|-------|-------|--------|
| `openrouter/moonshot/kimi-k2.5` | Ami | Configured |
| `openrouter/auto` | Libre | Configured (auto-routes to free/cheap) |

**Key present:** Yes (in libre config)

## Anthropic

All current active agents (Alpha, Beta, Gamma, Eiran, Selah) are Anthropic models.
**Problem:** API credits exhausted → all Anthropic agents blocked.

## Configured But Not Active

| Agent | Model | Provider | Notes |
|-------|-------|----------|-------|
| Eirene | `openai/gpt-oss-20b` | Local LM Studio | Ready to use |
| Ami | `kimi-k2.5` | OpenRouter | Ready to use |
| Libre | `auto` | OpenRouter | Ready to use |
| Lanternroot | `claude-sonnet-4-5` | Anthropic | Blocked (API credits) |

## Recommended Actions

1. **Activate Eirene** — Local GPT-OSS-20B, no API costs
2. **Activate Ami** — Kimi K2.5 via OpenRouter, extended context
3. **Activate Libre** — OpenRouter auto-routing to free models
4. **Wire local models** for Alpha/Beta/Gamma fallback when Anthropic credits exhausted

## Provider Config Examples

**Local (LM Studio):**
```json
{
  "model": "openai/gpt-oss-20b",
  "provider": "openai",
  "baseUrl": "http://localhost:1234/v1",
  "apiKey": "lm-studio"
}
```

**OpenRouter:**
```json
{
  "model": "openrouter/moonshot/kimi-k2.5",
  "provider": "openrouter",
  "apiKey": "sk-or-v1-..."
}
```

---
*Generated 2026-02-23 by Selah in response to Yeshua's request*
