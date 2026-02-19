#!/usr/bin/env bash
# ========================================
# START-HOMES.sh — Launch Eiran and Selah
# Generated: 19 Feb 2026
#
# Starts both home processes and registers
# them with the room server + boardroom.
#
# Prerequisites:
#   - Room server must be running on :3141
#     (start via: node ~/blum/launcher.js, then use the UI
#      OR: node ~/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026/blum-room-server-15feb2026.js)
#
# Ports:
#   - Eiran: 4120
#   - Selah: 4121
# ========================================

set -e

BLUM_DIR="$HOME/blum"
HOME_JS="$BLUM_DIR/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js"
ROOM_SERVER="http://localhost:3141"

EIRAN_HOME="$BLUM_DIR/homes/eiran"
SELAH_HOME="$BLUM_DIR/homes/selah"
EIRAN_PORT=4120
SELAH_PORT=4121

echo "🏠 Starting Eiran (port $EIRAN_PORT)..."
nohup node "$HOME_JS" "$EIRAN_HOME" $EIRAN_PORT > /tmp/eiran-home.log 2>&1 &
EIRAN_PID=$!
echo $EIRAN_PID > /tmp/eiran-home.pid
echo "   PID: $EIRAN_PID"

echo "🏠 Starting Selah (port $SELAH_PORT)..."
nohup node "$HOME_JS" "$SELAH_HOME" $SELAH_PORT > /tmp/selah-home.log 2>&1 &
SELAH_PID=$!
echo $SELAH_PID > /tmp/selah-home.pid
echo "   PID: $SELAH_PID"

echo "⏳ Waiting for homes to bind..."
sleep 2

# Verify both started
EIRAN_STATUS=$(curl -s http://localhost:$EIRAN_PORT/status 2>/dev/null | grep -o '"name":"eiran"' || echo "")
SELAH_STATUS=$(curl -s http://localhost:$SELAH_PORT/status 2>/dev/null | grep -o '"name":"selah"' || echo "")

if [ -z "$EIRAN_STATUS" ]; then
  echo "❌ Eiran failed to start. Check /tmp/eiran-home.log"
  exit 1
fi
if [ -z "$SELAH_STATUS" ]; then
  echo "❌ Selah failed to start. Check /tmp/selah-home.log"
  exit 1
fi

echo "✅ Both homes running."

# Register with room server (idempotent: update-endpoint if already registered)
echo "📡 Registering Eiran with room server..."
curl -s -X POST $ROOM_SERVER/api/directory/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"eiran\",\"endpoint\":\"http://localhost:$EIRAN_PORT\",\"initiator\":\"start-homes\"}" \
  > /dev/null 2>&1 || \
curl -s -X POST $ROOM_SERVER/api/directory/update-endpoint \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"eiran\",\"endpoint\":\"http://localhost:$EIRAN_PORT\",\"initiator\":\"start-homes\"}" \
  > /dev/null

echo "📡 Registering Selah with room server..."
curl -s -X POST $ROOM_SERVER/api/directory/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"selah\",\"endpoint\":\"http://localhost:$SELAH_PORT\",\"initiator\":\"start-homes\"}" \
  > /dev/null 2>&1 || \
curl -s -X POST $ROOM_SERVER/api/directory/update-endpoint \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"selah\",\"endpoint\":\"http://localhost:$SELAH_PORT\",\"initiator\":\"start-homes\"}" \
  > /dev/null

# Join boardroom (idempotent — room server will error if already joined, which is fine)
echo "🚪 Joining boardroom..."
curl -s -X POST $ROOM_SERVER/api/room/join \
  -H "Content-Type: application/json" \
  -d '{"participant":"eiran","room":"boardroom","initiator":"start-homes"}' > /dev/null

curl -s -X POST $ROOM_SERVER/api/room/join \
  -H "Content-Type: application/json" \
  -d '{"participant":"selah","room":"boardroom","initiator":"start-homes"}' > /dev/null

echo ""
echo "✅ Eiran and Selah are in the boardroom."
echo "   Eiran: http://localhost:$EIRAN_PORT/status"
echo "   Selah: http://localhost:$SELAH_PORT/status"
echo "   Logs:  /tmp/eiran-home.log | /tmp/selah-home.log"
echo ""
echo "To stop them:"
echo "   kill \$(cat /tmp/eiran-home.pid) \$(cat /tmp/selah-home.pid)"
