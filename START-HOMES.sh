#!/usr/bin/env bash
# START-HOMES.sh — start all blum homes as persistent nohup processes
# Usage: ./START-HOMES.sh
# Run from ~/blum

set -e
cd "$(dirname "$0")"

HOME_JS="read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"
CREATE_HOME="read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/create-home.js"
APIKEY=$(python3 -c "import json; print(json.load(open('homes/eiran/config.json'))['apiKey'])")

echo "Stopping any running homes..."
pkill -f "home.js homes/" 2>/dev/null || true
pkill -f "home.js /tmp/blum-homes/" 2>/dev/null || true
sleep 1

# Named homes (persistent)
echo "Starting Eiran (4120)..."
nohup node "$HOME_JS" homes/eiran 4120 >> homes/eiran/ops.log 2>&1 &

echo "Starting Selah (4121)..."
nohup node "$HOME_JS" homes/selah 4121 >> homes/selah/ops.log 2>&1 &

echo "Starting Keter (4122)..."
nohup node "$HOME_JS" homes/keter 4122 >> homes/keter/ops.log 2>&1 &

# Alpha/Beta/Gamma — recreate in /tmp if needed
mkdir -p /tmp/blum-homes
for agent in alpha beta gamma; do
  port=$(case $agent in alpha) echo 4110;; beta) echo 4111;; gamma) echo 4112;; esac)
  if [ ! -f "/tmp/blum-homes/$agent/config.json" ]; then
    echo "Creating $agent home in /tmp..."
    node "$CREATE_HOME" "$agent" "/tmp/blum-homes/$agent" "$APIKEY" > /dev/null
  fi
  echo "Starting $agent ($port)..."
  nohup node "$HOME_JS" "/tmp/blum-homes/$agent" "$port" >> "/tmp/blum-homes/$agent/ops.log" 2>&1 &
done

sleep 4

echo ""
echo "Status:"
for port in 4110 4111 4112 4120 4121 4122; do
  result=$(curl -s "http://localhost:$port/status" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"name\"]} (rooms: {d[\"rooms\"]})')" 2>/dev/null)
  echo "  $port: ${result:-FAILED}"
done
