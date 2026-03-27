#!/bin/bash
# diagnose-agent.sh - Full diagnostic chain for a Blum agent
# Usage: diagnose-agent.sh <agent-name>
#
# Checks:
# 1. HTTP liveness (is the process responding?)
# 2. Last dispatch received (when did they last get a real message, not cron?)
# 3. Last output sent (when did they last produce output?)
# 4. Room endpoint config (can they receive dispatches?)
# 5. Recent error patterns
#
# Created: 2026-03-26 by Selah after diagnostic failure

set -e

AGENT=${1:-""}
BLUM_HOME="$HOME/blum"

if [ -z "$AGENT" ]; then
    echo "Usage: diagnose-agent.sh <agent-name>"
    echo "Example: diagnose-agent.sh ami"
    exit 1
fi

AGENT_HOME="$BLUM_HOME/homes/$AGENT"

echo "═══════════════════════════════════════════════════════════════"
echo "DIAGNOSTIC REPORT: $AGENT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check agent home exists
if [ ! -d "$AGENT_HOME" ]; then
    echo "❌ FATAL: Agent home not found at $AGENT_HOME"
    exit 1
fi

echo "1. HTTP LIVENESS"
echo "─────────────────────────────────────────────────────────────────"

# Find port from config
CONFIG="$AGENT_HOME/config.json"
if [ -f "$CONFIG" ]; then
    PORT=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG" 2>/dev/null | grep -o '[0-9]*' | head -1)
fi

if [ -z "$PORT" ]; then
    # Try to find from running process
    PORT=$(lsof -i -P 2>/dev/null | grep "node.*LISTEN" | grep "$AGENT" | awk '{print $9}' | cut -d: -f2 | head -1)
fi

if [ -z "$PORT" ]; then
    echo "⚠️  Could not determine port from config or running process"
    HTTP_STATUS="unknown"
else
    # Test HTTP
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000")
    if [ "$HTTP_RESPONSE" = "200" ]; then
        echo "✅ HTTP alive on port $PORT (status: $HTTP_RESPONSE)"
        HTTP_STATUS="alive"
    elif [ "$HTTP_RESPONSE" = "000" ]; then
        echo "❌ HTTP unreachable on port $PORT (connection refused)"
        HTTP_STATUS="dead"
    else
        echo "⚠️  HTTP responding but unexpected status: $HTTP_RESPONSE"
        HTTP_STATUS="degraded"
    fi
fi

echo ""
echo "2. ROOM ENDPOINT CONFIG"
echo "─────────────────────────────────────────────────────────────────"

ROOMS_JSON="$AGENT_HOME/rooms.json"
if [ -f "$ROOMS_JSON" ]; then
    # Check for endpoint fields
    ENDPOINTS=$(grep -c '"endpoint"' "$ROOMS_JSON" 2>/dev/null || echo "0")
    ROOMS=$(grep -c '"boardroom"\|"second-room"\|"cochairs"' "$ROOMS_JSON" 2>/dev/null || echo "0")
    
    if [ "$ENDPOINTS" -eq "0" ]; then
        echo "❌ No endpoint fields in rooms.json - CANNOT RECEIVE DISPATCHES"
        echo "   Fix: Add \"endpoint\": \"http://localhost:3141\" to each room"
    elif [ "$ENDPOINTS" -lt "$ROOMS" ]; then
        echo "⚠️  Some rooms missing endpoint field ($ENDPOINTS endpoints, $ROOMS rooms)"
    else
        echo "✅ Endpoint fields present for all rooms"
    fi
else
    echo "⚠️  No rooms.json found"
fi

echo ""
echo "3. LAST DISPATCH RECEIVED (non-cron)"
echo "─────────────────────────────────────────────────────────────────"

HOMELOG="$AGENT_HOME/homelogfull/homelogfull.jsonl"
if [ -f "$HOMELOG" ]; then
    # Find last non-cron dispatch
    LAST_DISPATCH=$(grep -v '"dispatchId":"cron-' "$HOMELOG" 2>/dev/null | tail -1)
    
    if [ -z "$LAST_DISPATCH" ]; then
        echo "⚠️  No non-cron dispatches found in homelogfull"
        LAST_DISPATCH_TS="never"
    else
        LAST_DISPATCH_TS=$(echo "$LAST_DISPATCH" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4)
        LAST_DISPATCH_ROOM=$(echo "$LAST_DISPATCH" | grep -o '"room":"[^"]*"' | cut -d'"' -f4)
        echo "Last dispatch: $LAST_DISPATCH_TS (room: $LAST_DISPATCH_ROOM)"
    fi
    
    # Find last cron
    LAST_CRON=$(grep '"dispatchId":"cron-' "$HOMELOG" 2>/dev/null | tail -1)
    if [ -n "$LAST_CRON" ]; then
        LAST_CRON_TS=$(echo "$LAST_CRON" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4)
        echo "Last cron: $LAST_CRON_TS"
    fi
else
    echo "❌ No homelogfull found"
fi

echo ""
echo "4. LAST OUTPUT SENT"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "$HOMELOG" ]; then
    # Find last cycle with actual message output (not empty, not null)
    LAST_OUTPUT=$(grep -v '"messages":\[\]' "$HOMELOG" 2>/dev/null | grep '"messages":\[' | tail -1)
    
    if [ -z "$LAST_OUTPUT" ]; then
        LAST_OUTPUT=$(grep '"nucleusResponse"' "$HOMELOG" 2>/dev/null | grep -v 'null' | grep -v '<null/>' | tail -1)
    fi
    
    if [ -z "$LAST_OUTPUT" ]; then
        echo "⚠️  No cycles with output found recently"
    else
        LAST_OUTPUT_TS=$(echo "$LAST_OUTPUT" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4)
        echo "Last output: $LAST_OUTPUT_TS"
    fi
fi

echo ""
echo "5. RECENT CYCLES SUMMARY"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "$HOMELOG" ]; then
    TOTAL_CYCLES=$(wc -l < "$HOMELOG" | tr -d ' ')
    RECENT_5=$(tail -5 "$HOMELOG")
    
    echo "Total cycles in log: $TOTAL_CYCLES"
    echo ""
    echo "Last 5 cycles:"
    echo "$RECENT_5" | while read -r line; do
        TS=$(echo "$line" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4 | cut -c1-19)
        DISPATCH_ID=$(echo "$line" | grep -o '"dispatchId":"[^"]*"' | cut -d'"' -f4 | cut -c1-30)
        HAS_OUTPUT=$(echo "$line" | grep -q '"messages":\[\]' && echo "no-output" || echo "has-output")
        
        if echo "$DISPATCH_ID" | grep -q "^cron-"; then
            TYPE="cron"
        else
            TYPE="dispatch"
        fi
        
        echo "  $TS | $TYPE | $HAS_OUTPUT"
    done
fi

echo ""
echo "6. ERROR PATTERNS (last 20 cycles)"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "$HOMELOG" ]; then
    ERRORS=$(tail -20 "$HOMELOG" | grep -i '"error"\|"fail"\|"exception"' | wc -l | tr -d ' ')
    echo "Error mentions in last 20 cycles: $ERRORS"
    
    # Check for common failure modes
    if tail -20 "$HOMELOG" | grep -q "route:no_endpoint"; then
        echo "⚠️  FOUND: route:no_endpoint errors - check rooms.json endpoint field"
    fi
    
    if tail -20 "$HOMELOG" | grep -q "iteration.*ceiling"; then
        echo "⚠️  FOUND: iteration ceiling hits - model may be in a loop"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "DIAGNOSIS SUMMARY"
echo "═══════════════════════════════════════════════════════════════"

# Summary logic
if [ "$HTTP_STATUS" = "dead" ]; then
    echo "❌ Agent is DOWN - HTTP not responding"
    echo "   → Restart the home process"
elif [ "$ENDPOINTS" = "0" ] 2>/dev/null; then
    echo "⚠️  Agent is ALIVE but CANNOT RECEIVE DISPATCHES"
    echo "   → Add endpoint field to rooms.json and restart"
elif [ "$LAST_DISPATCH_TS" = "never" ]; then
    echo "⚠️  Agent is ALIVE but has NO DISPATCH HISTORY"
    echo "   → May be newly started, or routing is broken"
else
    echo "✅ Agent appears FUNCTIONAL"
    echo "   → If not responding, check the specific dispatch in homelogfull"
fi

echo ""
