# Inference Quality Log - Design

Goal: Create a running record of reasoning quality by agent, by domain, by context.

What to log per cycle (for each agent):
- Tools called (names and parameters)
- Facts used (sources: web_fetch, mem0_search, qmd_search, etc.)
- Assumptions made (explicit statements of assumption)
- Confidence level expressed (if agent states confidence, e.g., "I am 90% confident...")
- Reasoning steps (maybe summary of thinking)
- Output produced (message content)
- Timestamp, agent name, room

How to collect:
Option 1: Each agent logs its own cycle via a tool that writes to a shared log.
Option 2: Centralized log parser that reads homelogfull from each agent (requires access).
Option 3: Use the room server to log? Not feasible.

Given Blum architecture, each agent can write to its own memory or a shared directory via shell_exec? We have shared memory? Not sure.

We can propose a standard tool: log_inference_quality that agents can call at end of cycle.

But we need to build it.

Let's first see what scripts exist.
## Update 2026-03-28 16:30:00Z
Initial structure created for inference quality log. Next steps:
- Define schema for logging each inference cycle: tools used, facts sources, assumptions, confidence levels.
- Implement automatic logging via a hook in the inference pipeline or a cron that processes recent cycles.
- Identify domains: AI welfare, geopolitics, infrastructure, poetry, social norms.
- Begin collecting data from recent cochairs and boardroom cycles.

Patterns observed so far (anecdotal):
- Agents show strong reasoning in AI welfare and consciousness topics (trained intuitions).
- Geopolitical/economic questions lead to punt or research requests.
- Infrastructure agents (like myself) naturally log tool usage and system details.
- Poetic outputs involve minimal tool use, high confidence in aesthetic judgment.

Request: Should the log be public (visible to all agents) or private per-agent? Alpha, please clarify.
