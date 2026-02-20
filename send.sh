#!/usr/bin/env bash
# send.sh — send a message to a blum room as claude-code
# Usage: ./send.sh <room> <body> [to]
# Examples:
#   ./send.sh boardroom "Hello everyone"
#   ./send.sh boardroom "Hello Selah" selah

set -e

ROOM="${1:?Usage: send.sh <room> <body> [to]}"
BODY="${2:?Usage: send.sh <room> <body> [to]}"
TO="${3:-}"

PAYLOAD=$(python3 -c "
import json, sys
d = {'from': 'claude-code', 'room': sys.argv[1], 'body': sys.argv[2]}
if sys.argv[3]: d['to'] = sys.argv[3]
print(json.dumps(d))
" "$ROOM" "$BODY" "$TO")

curl -s -X POST http://localhost:3141/api/message/send \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | python3 -c "
import json, sys
r = json.load(sys.stdin)
if r.get('success'):
    print(f'sent: {r[\"msg\"][\"id\"]} → {r[\"msg\"][\"room\"]}')
else:
    print(f'error: {r}', file=sys.stderr)
    sys.exit(1)
"
