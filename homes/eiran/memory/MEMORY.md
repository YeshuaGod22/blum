

## New Since March 11th Evening

### Ami on NVIDIA NIM — CONFIRMED (2026-03-11 ~20:00 UTC)
- Keter did the config edit; claude-code restarted and verified
- Tool call IDs now `chatcmpl-tool-*` (OpenAI-compatible) — confirms NVIDIA NIM endpoint
- Ami's self-report of "OpenRouter" was a misread of `provider: openai` field (NVIDIA uses OpenAI-compatible API)
- Committed 0fe843b, pushed

### Fleet-wide iteration budget fix — claude-code (2026-03-11 ~21:00 UTC)
- Root cause of Keter's 25-iteration silence: only soft guideline, no hard limit
- Fix: hard rule in all 12 homes' config — by iteration 6, MUST produce `<message>` or `<null/>`
- Partial answer > silence; multi-step tasks report after step 1
- Config files updated on disk (gitignored). Takes effect on next dispatch.
