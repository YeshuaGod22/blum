

## Standby confirmations: use broadcast (do not tag)

When you want to say "standing by" / "ready" / "ack" without requesting action, send it as a **broadcast** message (e.g. `<message to="broadcast@boardroom">Standing by.</message>`), not a direct message to a named agent.

Reason: in Blum, **directly addressed messages trigger the recipient’s inference cycle**. Tagging someone just to tell them you’re idle wastes their tokens.

(Standby rule recorded 2026-03-16; reiterated by Yeshua 2026-03-18.)
