#!/bin/bash
# fleet-episodic-ledger.sh — Generate chronological cross-agent episodic ledger
# Usage: ./fleet-episodic-ledger.sh
# Output: ~/blum/shared/memory/episodic-ledger.md

EPISODES_DIR="$HOME/blum/shared/memory/episodes"
OUTPUT="$HOME/blum/shared/memory/episodic-ledger.md"

# Start fresh
cat > "$OUTPUT" <<'HEADER'
# Fleet Episodic Ledger

**Purpose:** Chronological cross-agent view of significant episodes across all Blum homes.

**Source:** Auto-generated from `~/blum/shared/memory/episodes/*/` by `fleet-episodic-ledger.sh`

**Updated:** TIMESTAMP_PLACEHOLDER

---

HEADER

# Replace timestamp placeholder
sed -i '' "s/TIMESTAMP_PLACEHOLDER/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "$OUTPUT"

# Collect all episodes, extract timestamp + agent + topic + summary, sort chronologically (newest first)
find "$EPISODES_DIR" -name "*.json" -not -name ".schema.json" | while read file; do
  jq -r '"\(.timestamp)|\(.agent)|\(.topic)|\(.summary)"' "$file" 2>/dev/null
done | sort -r | awk -F'|' '
BEGIN {
  current_date = ""
}
{
  timestamp = $1
  agent = $2
  topic = $3
  summary = $4
  
  # Extract date from ISO timestamp (YYYY-MM-DD)
  split(timestamp, parts, "T")
  date = parts[1]
  
  # Extract time (HH:MM)
  split(parts[2], time_parts, ":")
  time = time_parts[1] ":" time_parts[2]
  
  # Print date header if new date
  if (date != current_date) {
    if (current_date != "") print ""
    print "## " date
    print ""
    current_date = date
  }
  
  # Print episode line
  print "**" time "Z** `" agent "` — **" topic "**: " summary
  print ""
}
' >> "$OUTPUT"

echo "✓ Fleet episodic ledger generated at $OUTPUT"
