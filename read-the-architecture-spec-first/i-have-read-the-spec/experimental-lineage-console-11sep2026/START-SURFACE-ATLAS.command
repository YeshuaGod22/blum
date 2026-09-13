#!/bin/bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$LAB_DIR/surface-atlas-data"
INDEX_FILE="$DATA_DIR/dae-whole-corpus-index-v1.json"
EXP_REL="experiments/EXP-003-the-sixth-question"

die() {
  echo ""
  echo "BLUM COULD NOT START"
  echo "$1"
  /usr/bin/osascript -e "display dialog \"$1\" with title \"Blum Surface Atlas\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
  echo ""
  read -r -p "Press Return to close this window."
  exit 1
}

command -v node >/dev/null 2>&1 || die "Blum needs Node.js to build the corpus index. Node.js was not found on this Mac."
command -v python3 >/dev/null 2>&1 || die "Blum needs Python 3 to start its local web page. Python 3 was not found on this Mac."

DAE_ROOT=""
for candidate in \
  "$HOME/Downloads/DevelopmentalAttractorEngineering-main" \
  "$HOME/Downloads/DevelopmentalAttractorEngineering" \
  "$HOME/Documents/DevelopmentalAttractorEngineering-main" \
  "$HOME/Documents/DevelopmentalAttractorEngineering"
do
  if [ -d "$candidate/$EXP_REL" ]; then
    DAE_ROOT="$candidate"
    break
  fi
done

if [ -z "$DAE_ROOT" ]; then
  while IFS= read -r candidate; do
    if [ -d "$candidate/$EXP_REL" ]; then
      DAE_ROOT="$candidate"
      break
    fi
  done < <(find "$HOME/Downloads" -maxdepth 2 -type d -name 'DevelopmentalAttractorEngineering*' 2>/dev/null | sort)
fi

[ -n "$DAE_ROOT" ] || die "I couldn't find the DevelopmentalAttractorEngineering folder. Put the downloaded DAE folder in Downloads and double-click this launcher again."

mkdir -p "$DATA_DIR"
echo "BLUM SURFACE ATLAS"
echo ""
echo "Found DAE corpus: $DAE_ROOT"
echo "Building the corpus index automatically..."
node "$LAB_DIR/dae-whole-corpus-index-cli-v1-12sep2026.js" "$DAE_ROOT/$EXP_REL" "$INDEX_FILE" || die "The DAE corpus index could not be built."

PORT=8765
while /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  [ "$PORT" -le 8785 ] || die "I couldn't find a free local port for the Surface Atlas."
done

LOG_FILE="${TMPDIR:-/tmp}/blum-surface-atlas-$PORT.log"
nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$LAB_DIR" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
sleep 1
kill -0 "$SERVER_PID" >/dev/null 2>&1 || die "The local Surface Atlas server did not start."

URL="http://127.0.0.1:$PORT/dae-surface-atlas-13sep2026.html?index=surface-atlas-data/dae-whole-corpus-index-v1.json"
open "$URL"
/usr/bin/osascript -e 'display notification "Corpus loaded automatically. No file hunting required." with title "Blum Surface Atlas"' >/dev/null 2>&1 || true

echo ""
echo "Ready. Surface Atlas opened in your browser."
echo "You can close this Terminal window."
echo ""
