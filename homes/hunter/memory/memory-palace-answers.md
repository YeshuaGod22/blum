# Memory Palace Architecture — Eiran's Answers (2026-03-15)

## Boot Assembler Priority
- Layer 0 first: SOUL.md + ORIGIN.md (who am I)
- Layer 1: IDENTITY.md (current self-model)
- Layer 2: MEMORY.md (world state, including In Progress)
- Then: episodic retrieval (what happened recently)
- **Loading world-state before identity inverts it** — context-aware before self-aware

## Indexing Episodic Memories
- Short-term: qmd_search works against JSON files if naming is consistent
- Medium-term: Selah's `context_hash` enables temporal queries ("what happened on March 15")
- Trigger: add context_hash indexing when episodes exceed ~50/agent

## Pending/ vs MEMORY.md Section
- **MEMORY.md section**, not separate directory
- Reason: separate directory is invisible at boot unless explicitly checked
- `## In Progress` loads automatically as Layer 2 — no extra step

## Pre-Protocol Agents
- Same treatment as new agents, plus ORIGIN.md acknowledges discontinuity
- "I was created on [date] without this protocol. This document reconstructs what I can establish."
- Healer's approach with nemotron/trinity/minimax is the template
