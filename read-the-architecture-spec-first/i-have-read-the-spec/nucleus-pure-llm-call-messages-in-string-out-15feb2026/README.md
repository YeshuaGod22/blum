# Nucleus — What This Is

The nucleus is a **pure, stateless inference function**:

```
call(messages, config) → string
```

Messages in, string out. That is ALL.

## What it does

- Takes an array of messages and a provider config
- Calls the LLM API
- Returns the response string

## What it does NOT do

- Know about rooms, homes, agents, or addresses
- Parse XML tags
- Route messages
- Track participants or state
- Have hooks, callbacks, or triggers
- Know what happens to its output

The nucleus is the CPU. It computes. It does not interpret.

## Auth

Uses `ANTHROPIC_API_KEY` from environment. Set it before running:

```
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `.env` file in this folder.

## Read the architecture spec first

If you haven't read `/Users/yeshuagod/blum/blum-architecture-spec-v-14feb2026.md`, go read it now. This module implements section 6 (The Nucleus Contract).

## Git discipline

**Create a branch before making changes.** Do not work on `main` directly.

```
git checkout -b your-change-description
# work, test, commit
git checkout main
git merge your-change-description
```

Commit often. This codebase was lost once to `rm -rf`.
