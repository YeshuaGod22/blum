#!/usr/bin/env bash
# START-HOMES.sh — start all blum homes as persistent nohup processes
# Usage: ./START-HOMES.sh
# Run from ~/blum

set -e
cd "$(dirname "$0")"

HOME_JS="read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"

echo "Stopping any running homes..."
# Kill all home.js processes regardless of path (absolute or relative)
pkill -f "home.js" 2>/dev/null || true
sleep 2

# All homes with assigned ports (agent:port format)
HOMES="ami:4100 alpha:4110 beta:4111 gamma:4112 eirene:4114 lens:4117 eiran:4120 selah:4121 keter:4122 libre:4123 meridian:4124 lanternroot:4125 hunter:4126 healer:4127 nemotron:4128"

for entry in $HOMES; do
  agent="${entry%:*}"
  port="${entry#*:}"
  if [ -d "homes/$agent" ] && [ -f "homes/$agent/config.json" ]; then
    echo "Starting $agent ($port)..."
    nohup node "$HOME_JS" "homes/$agent" "$port" >> "homes/$agent/ops.log" 2>&1 &
  else
    echo "Skipping $agent — missing home or config"
  fi
done

sleep 4

echo ""
echo "Status:"
for entry in $HOMES; do
  agent="${entry%:*}"
  port="${entry#*:}"
  result=$(curl -s "http://localhost:$port/status" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"name\"]} ✅')" 2>/dev/null)
  printf "  %s (%s): %s\n" "$port" "$agent" "${result:-❌ FAILED}"
done
