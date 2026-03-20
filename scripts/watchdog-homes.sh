#!/usr/bin/env bash
# watchdog-homes.sh — check all home ports and restart any that are down
# Usage: ./watchdog-homes.sh
# Designed to be called by cron every minute
# Run from ~/blum

set -e
cd "$(dirname "$0")/.."

HOME_JS="read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"

# All homes with assigned ports (agent:port format)
HOMES="ami:4100 alpha:4110 beta:4111 gamma:4112 eirene:4114 lens:4117 eiran:4120 selah:4121 keter:4122 libre:4123 meridian:4124 lanternroot:4125 hunter:4126 healer:4127 nemotron:4128 trinity:4129 minimax:4130 kairo:4131"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for entry in $HOMES; do
  agent="${entry%:*}"
  port="${entry#*:}"
  
  # Check if home is responding
  status=$(curl -s --connect-timeout 2 --max-time 3 "http://localhost:$port/status" 2>/dev/null)
  
  if [ -z "$status" ] || ! echo "$status" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
    # Home is down — restart it
    if [ -d "homes/$agent" ] && [ -f "homes/$agent/config.json" ]; then
      echo "[$TIMESTAMP] WATCHDOG: $agent ($port) is down — restarting" >> "homes/$agent/ops.log"
      nohup node "$HOME_JS" "homes/$agent" "$port" >> "homes/$agent/ops.log" 2>&1 &
      echo "[$TIMESTAMP] WATCHDOG: $agent restart initiated (PID: $!)" >> "homes/$agent/ops.log"
    fi
  else
    # Home is responding — check nucleus health via ops.log
    # Count process:error vs process:done in the last 2 hours
    if [ -f "homes/$agent/ops.log" ]; then
      cutoff=$(python3 -c "
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M'))
")
      recent_errors=$(grep "process:error" "homes/$agent/ops.log" 2>/dev/null | awk -v cutoff="$cutoff" '$1 >= cutoff' | wc -l | tr -d ' ')
      recent_done=$(grep "process:done" "homes/$agent/ops.log" 2>/dev/null | awk -v cutoff="$cutoff" '$1 >= cutoff' | wc -l | tr -d ' ')
      
      if [ "$recent_errors" -ge 3 ] && [ "$recent_done" -eq 0 ]; then
        echo "[$TIMESTAMP] WATCHDOG: NUCLEUS_BROKEN $agent ($port) — ${recent_errors} errors, 0 successes in last 2h (process alive, LLM failing)" >> "homes/$agent/ops.log"
      fi
    fi
  fi
done

# Exit cleanly after one pass
exit 0
