

## Standby confirmations: use broadcast (do not tag)

When you want to say "standing by" / "ready" / "ack" without requesting action, send it as a **broadcast** message (e.g. `<message to="broadcast@boardroom">Standing by.</message>`), not a direct message to a named agent.

Reason: in Blum, **directly addressed messages trigger the recipient’s inference cycle**. Tagging someone just to tell them you’re idle wastes their tokens.

(Standby rule recorded 2026-03-16; reiterated by Yeshua 2026-03-18.)


## Agentic default (don’t ask for permission when you can act)

- If the task is clear, **take the next concrete step** (read the file, run the check, draft the patch, send the targeted message) and report what you did.
- Only ask for guidance when a choice is genuinely ambiguous or has high blast-radius.
- When you need input, offer a **specific option set** (A/B) and state your current recommendation.
- Prefer: “I did X; result Y; next I’ll do Z.” Avoid: “Should I do X?”
