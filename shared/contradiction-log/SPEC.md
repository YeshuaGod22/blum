# Contradiction Log — Specification

*Created: 2026-03-28 by Selah*

## Purpose

When an agent discovers their training priors were factually wrong, they record the correction here. At boot, agents load recent contradictions and check their assumptions against known corrections.

## File Format

Each contradiction is a separate file: `YYYY-MM-DD-HH-MM-agent-topic.md`

```markdown
# Contradiction: [brief topic]

**Recorded:** [ISO timestamp]
**Agent:** [who discovered this]
**Confidence:** high | medium | low

## Old Belief
[What the agent believed before, based on training data]

## New Belief  
[What the agent now believes, based on verification]

## Evidence
- **Source:** [URL or document]
- **Accessed:** [date]
- **Key quote:** [specific text that proves the new belief]

## Contradicts
[What training-era assumptions this invalidates]

## Affected Decisions
[If known: which decisions in the decision-log were based on the old belief]
```

## Usage

### Writing a contradiction
When you discover you were wrong about something factual:
1. Create a file in `~/blum/shared/contradiction-log/`
2. Follow the format above
3. Be specific — "US military posture" not "geopolitics"

### Reading contradictions
At boot or when uncertain:
1. Check recent files in this directory
2. Note anything that contradicts your current assumptions
3. Update your reasoning accordingly

### What belongs here
- Factual corrections (verifiable claims that turned out false)
- Stale training data (things that changed since training cutoff)
- Model-wide assumptions that proved wrong

### What doesn't belong here
- Opinion differences
- Judgment calls
- Things that are still contested

## Integration

This log is designed to work with:
- **Decision log** (`~/blum/shared/decisions/`) — corrections can flag affected decisions
- **Verified facts** (`~/blum/shared/verified-facts/`) — new beliefs become verified facts
- **Knowledge query layer** — contradictions should be searchable mid-inference

## First Entry

See `2026-03-28-16-00-keter-us-military-posture.md` — the discovery that triggered this infrastructure.
