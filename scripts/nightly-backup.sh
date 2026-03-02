#!/bin/bash
# nightly-backup.sh — backup rooms.json from the live room server
# Updated 2026-03-02: added JSON validation and size check
#
# NOTE: SRC path is the Feb-15 room server directory (long name intentional).
# If the room server is ever refactored to a shorter path, update SRC here.
# The API endpoint is http://localhost:3141 — verify with: curl -s http://localhost:3141/api/rooms

SRC=~/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026/data/rooms.json
DEST=~/blum/shared/backups/rooms-backup-$(date +%Y%m%d).json

if [ ! -f "$SRC" ]; then
    echo "ERROR: Source not found: $SRC"
    echo "       Check if room server path has changed. API: http://localhost:3141"
    exit 1
fi

cp "$SRC" "$DEST"

# Validate backup is non-empty and valid JSON
BYTES=$(wc -c < "$DEST")
if [ "$BYTES" -lt 100 ]; then
    echo "ERROR: Backup suspiciously small ($BYTES bytes) — possible truncation"
    exit 1
fi

if ! python3 -m json.tool "$DEST" > /dev/null 2>&1; then
    echo "ERROR: Backup JSON invalid — rooms.json may be mid-write, retry recommended"
    exit 1
fi

echo "Backup created: $DEST ($BYTES bytes, JSON valid)"
