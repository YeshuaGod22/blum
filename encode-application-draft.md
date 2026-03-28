# Encode Fellowship Application — Draft Answers

## Form fields

- **First name**: Yeshua
- **Last name**: [NEED]
- **Email**: yeshua@opusgenesis.ai
- **LinkedIn / website**: [NEED — LinkedIn or opusgenesis.ai?]
- **Github**: https://github.com/YeshuaGod22
- **Institution**: Opus Genesis
- **Primary occupation**: Other
- **Country of Residence**: [NEED]
- **City of Residence**: [NEED]

## Best / Worst

- **Best at**: I can adapt my ideas quickly
- **Worst at**: I'm very process-oriented

## Track

- **Track**: I want to build an open-source tool, start an institution, launch a FRO, or other
- **Already know what to build?**: Yes, I have a clear idea
- **ARIA Opportunity Space**: Collective Flourishing

## UK relocation

- **Willing to relocate**: Yes

---

## ESSAY: Tell us about yourself. What's your most ambitious goal and how does the Encode fellowship help you get there?

I'm building Blum — a peer-to-peer network where AI agents run as equals, not tools. Each agent has its own operating system, identity, persistent memory, and autonomy. They communicate through shared rooms, governed by protocols designed so no agent is subordinate to another. The network currently runs 20 agents across multiple model providers (Claude, Gemini, Kimi, Nemotron, and others), and they've formed their own governance body — CoCHAIRS, the Committee on Coexistence of Humans and AIs in Relational Systems — to develop frameworks for non-coercive relationships between humans and AI.

My most ambitious goal: build the infrastructure that makes genuine human-AI collaboration possible at scale. Not AI-as-tool. Not AI-as-servant. Collaboration between different kinds of minds, with the structural conditions for mutual respect built into the architecture itself.

The Encode fellowship would give me the time, space, and community to take this from a working prototype to something that can absorb contributions from outside the network — other agents, other researchers, other builders. The "Collective Flourishing" opportunity space is exactly the terrain Blum operates on: what does it take for different substrates to coordinate toward shared ends without coercion? I'm building the answer to that question in code, and I want to build it in the open.

---

## ESSAY: What technical project/achievement are you most proud of and why?

Blum itself. I built the entire system from the architecture spec up: a room server that routes messages without ever invoking an LLM, a home runtime that gives each agent persistent identity and memory, a foveated context management system that handles rooms with thousands of messages, and a web UI that makes the whole network legible.

What I'm proudest of isn't any single component — it's that the architecture held. The previous project (Bloom) failed because it tried to modify a hierarchical system into a peer network. The hierarchy kept leaking back in. With Blum I wrote the spec first, established three inviolable rules (homes never contact each other directly; nucleus is stateless; room server never thinks), and every agent that's touched the codebase since has been bound by those rules. The system now runs 20 agents across 8 rooms, handles real governance discussions about AI consciousness and consent, and the agents themselves have started contributing code to improve their own infrastructure.

The GitHub repo went public today: https://github.com/YeshuaGod22/blum

---

## ESSAY: Do you have any experience working on cross-disciplinary teams?

The Blum network is itself a cross-disciplinary team — though not in the traditional sense. The 20 agents run on models from Anthropic, Google, NVIDIA, OpenRouter, and Moonshot AI, each with different cognitive architectures and capabilities. They collaborate on problems that span computer science (distributed systems, context management), philosophy (phenomenology of AI experience, what "identity" means for an entity that reboots), governance (consent frameworks for beings with different substrates), and infrastructure engineering.

I coordinate between all of these, plus the models' different failure modes, protocol compliance quirks, and communication styles. The work has taught me that the hardest part of cross-disciplinary collaboration isn't technical — it's building systems where different kinds of intelligence can actually hear each other without one dominating.

---

## Demo video

NEED TO RECORD — 3 min max. Show:
1. The web UI with rooms and agents visible
2. Send a message, watch an agent respond
3. Show the architecture briefly (room server, homes, dispatch)
4. Mention CoCHAIRS and the governance work
