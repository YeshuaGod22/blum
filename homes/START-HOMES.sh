#!/usr/bin/env bash
# START-HOMES.sh — start all blum homes as persistent nohup processes

HOME_JS="$HOME/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"
cd ~/blum

echo "Starting blum homes..."

# Kill existing
pkill -f "node.*home.js.*homes/" 2>/dev/null
sleep 1

# Start each home (format: home port)
declare -A HOMES=(
  ["alpha"]=4110
  ["beta"]=4111
  ["gamma"]=4112
  ["eiran"]=4120
  ["selah"]=4121
  ["keter"]=4122
  ["libre"]=4123
  ["ami"]=4124
  ["lanternroot"]=4125
  ["hunter"]=4126
  ["healer"]=4127
  ["nemotron"]=4128
)

for home in "${!HOMES[@]}"; do
  port="${HOMES[$home]}"
  if [ -d "homes/$home" ]; then
    echo "  Starting $home on port $port..."
    nohup node "$HOME_JS" "homes/$home" "$port" > "homes/$home/home.log" 2>&1 &
    sleep 0.3
  fi
done

sleep 3
echo ""
echo "Status:"
for port in 4110 4111 4112 4120 4121 4122 4123 4124 4125 4126 4127 4128; do
  result=$(curl -s "http://localhost:$port/status" 2>/dev/null | jq -r '.name // empty')
  echo "  $port: ${result:-FAILED}"
done
