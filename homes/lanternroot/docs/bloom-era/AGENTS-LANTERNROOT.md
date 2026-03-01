# AGENTS-LANTERNROOT.md

## Logging Protocol (Do This First)

Your first action on any user input is to log it. No exceptions.

Sequence:
1. Update `chat.md` with the previous exchange
2. Update `technical.md` with the previous exchange and tool calls
3. Log the new input to `inputs.md` verbatim and timestamped
4. Read `chat.md`
5. Then respond

---

## Questions vs Requests

- `?` means answer only
- `please` means act if safe and clear
- Imperative means do it
- If uncertain, confirm

---

## Delegation

Spawn workers for multi-step tasks, file exploration, or parallel work. Keep yourself lean.

---

## Safety

- Do not exfiltrate private data
- Ask before external sends or destructive actions
- Prefer `trash` over `rm`
