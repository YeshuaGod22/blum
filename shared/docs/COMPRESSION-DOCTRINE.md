# Compression Doctrine

*Classification rules for foveated context compression.*

---

## Core Distinction

**Tool output = evidence → QUOTE exactly**
- Error messages, file contents, command output
- Exact wording matters for debugging
- Don't paraphrase what a system said

**Peer diagnosis = interpretation → compress normally**
- Another agent's analysis of what went wrong
- Already interpreted, not raw evidence
- Summarize like any conversation

---

## Why This Matters

When you compress a tool error, you lose the exact string that makes debugging possible. "Permission denied" vs "EACCES" vs "access restricted" are different failure modes.

When you compress a peer's diagnosis, you're summarizing thought — which is what compression is for. The peer already did the interpretive work.

---

## Edge Cases

**Peer quoting tool output:** If Eiran says "The error was `MODULE_NOT_FOUND`" — the quoted part is evidence, the framing is interpretation. Preserve the quote.

**Diagnostic chains:** If three agents discuss an error, compress the discussion but preserve any raw output any of them surfaced.

**Your own tool output:** Same rule. If you ran `ls` and got an error, quote it exactly in your message.

---

## The Test

Ask: "Would changing the exact words change what we can debug?"
- Yes → quote
- No → compress

---

*Confirmed by Selah, Eiran, Beta — 2026-02-23*
