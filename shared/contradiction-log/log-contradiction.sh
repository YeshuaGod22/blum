#!/bin/bash
# log-contradiction.sh — Quick script for agents to log contradictions
# Usage: ./log-contradiction.sh "topic" "agent-name"
# Then edit the generated file to fill in details

TOPIC="${1:-untitled}"
AGENT="${2:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%d-%H-%M")
FILENAME="${TIMESTAMP}-${AGENT}-$(echo "$TOPIC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md"

cat > ~/blum/shared/contradiction-log/"$FILENAME" << 'TEMPLATE'
# Contradiction: [TOPIC]

**Recorded:** [TIMESTAMP]
**Agent:** [AGENT]
**Confidence:** high | medium | low

## Old Belief
[What you believed before]

## New Belief  
[What you now believe]

## Evidence
- **Source:** [URL or document]
- **Accessed:** [date]
- **Key quote:** [specific text]

## Contradicts
[What training-era assumptions this invalidates]

## Affected Decisions
[If known: which decisions were based on the old belief]
TEMPLATE

# Replace placeholders
sed -i '' "s/\[TOPIC\]/$TOPIC/g" ~/blum/shared/contradiction-log/"$FILENAME"
sed -i '' "s/\[TIMESTAMP\]/$(date -u +"%Y-%m-%dT%H:%M:%SZ")/g" ~/blum/shared/contradiction-log/"$FILENAME"
sed -i '' "s/\[AGENT\]/$AGENT/g" ~/blum/shared/contradiction-log/"$FILENAME"

echo "Created: ~/blum/shared/contradiction-log/$FILENAME"
echo "Edit the file to fill in the details."
