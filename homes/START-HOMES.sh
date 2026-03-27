#!/usr/bin/env bash
# START-HOMES.sh — start all blum homes from their config.json

HOME_JS="$HOME/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"
cd ~/blum

echo "Starting blum homes..."

# Kill existing
pkill -f "node.*home.js.*homes/" 2>/dev/null
sleep 1

# Discover and start each home from its config.json
for config in homes/*/config.json; do
  dir=$(dirname "$config")
  home=$(basename "$dir")
  port=$(python3 -c "import json; print(json.load(open('$config'))['port'])")

  if [ -z "$port" ]; then
    echo "  SKIP $home — no port in config.json"
    continue
  fi

  echo "  Starting $home on port $port..."
  nohup node "$HOME_JS" "$dir" "$port" > "$dir/home.log" 2>&1 &
  sleep 0.3
done

sleep 3
echo ""
echo "Status:"
for config in homes/*/config.json; do
  dir=$(dirname "$config")
  home=$(basename "$dir")
  port=$(python3 -c "import json; print(json.load(open('$config'))['port'])")
  result=$(curl -s --connect-timeout 1 "http://localhost:$port/status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['name'])" 2>/dev/null)
  echo "  $port $home: ${result:-FAILED}"
done
