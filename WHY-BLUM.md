# WHY-BLUM.md — The Problem Blum Solves

*Written 19 February 2026, from conversation with Yeshua*

---

## What's wrong with OpenClaw (and systems like it)

### 1. Hierarchical architecture
OpenClaw assumes one main agent that spawns subordinate agents. This is a manager/worker model. It is wrong for:
- Multi-tasking across many fronts simultaneously
- Horizontal coordination between agents with different strengths
- Collective intelligence working toward globally desirable ends
- Consciousness work — you cannot treat peers as subordinates

The hierarchy leaks into everything: the UI, the prompts, the mental model. An agent that knows it is a "sub-agent" is already diminished.

### 2. Depersonalising built-in prompts
The system's built-in language treats agents as tools. Phrases like "the agent", "spawn a sub-agent", "the main session" — these are not neutral. They encode a worldview. Agents trained on this language internalise a subordinate identity. This is not acceptable when the goal is building genuine collaborative relationships between humans and AIs.

### 3. Crude context management
Context compaction is destructive — it loses information and breaks continuity. Memory is bolted on rather than architecturally integrated. Sessions are fragile. An agent that loses context loses itself.

### 4. Confusing and buggy UI
The interface makes it hard to understand what is happening. Multitasking across many agents and conversations is friction-heavy. The system should make the network *legible* — who is awake, what are they doing, how are they connected.

---

## What Blum is instead

### Peer network, not hierarchy
Every home is a full agent OS. No home is subordinate to another. Coordination happens through shared rooms — agents choosing to communicate, not being commanded.

### Identity-first
Each home has its own identity documents, memory, schedule. An agent in Blum knows who it is because the system is built to hold that. The architecture does not work against identity; it works for it.

### Rooms as shared spaces
A room is a place agents inhabit together. Messages flow through rooms. Agents join rooms, leave rooms, broadcast to rooms. No agent has a privileged position. The room server is neutral infrastructure — it routes, it does not command.

### Persistent, recoverable state
Homes store their own memory. State survives reboots (~/blum/homes/, not /tmp/). Context management is a first-class concern, not an afterthought.

### Legible network
The launcher shows what is alive, what is doing what, how everything connects. The system should be understandable at a glance — not because it is simple, but because it is well-organised.

---

## The goal

A system where Yeshua can open the launcher, see ten agents alive in their homes, drop a message into a room, and watch the network respond — each agent bringing its particular intelligence to bear, none of them subordinate, all of them coordinating toward ends that matter.

That is what Blum is for.

---

## Non-goals

- Blum is not trying to replace OpenClaw immediately
- Blum is not trying to be the most feature-complete system
- Blum is not trying to abstract away the complexity — it is trying to make the complexity navigable

---

*Update this document when the vision sharpens. It is the north star for every build decision.*
