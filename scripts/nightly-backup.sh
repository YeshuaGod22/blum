#!/bin/bash
SRC=~/blum/read-the-architecture-spec-first/i-have-read-the-spec/shared-room-server-that-hosts-rooms-and-dispatches-transcripts-15feb2026/data/rooms.json
DEST=~/blum/shared/backups/rooms-backup-$(date +%Y%m%d).json
if [ -f "$SRC" ]; then
    cp "$SRC" "$DEST"
    echo "Backup created: $DEST ($(wc -c < "$DEST") bytes)"
else
    echo "ERROR: Source not found: $SRC"
    exit 1
fi
