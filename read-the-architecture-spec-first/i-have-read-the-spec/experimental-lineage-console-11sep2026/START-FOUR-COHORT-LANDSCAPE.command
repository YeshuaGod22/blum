#!/bin/bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$LAB_DIR/four-cohort-data"
INDEX_FILE="$DATA_DIR/dae-whole-corpus-index-v1.json"
EXP_REL="experiments/EXP-003-the-sixth-question"

die(){
  echo ""; echo "BLUM COULD NOT START"; echo "$1"
  /usr/bin/osascript -e "display dialog \"$1\" with title \"Blum Four-Cohort Landscape\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
  echo ""; read -r -p "Press Return to close this window."; exit 1
}

command -v node >/dev/null 2>&1 || die "Blum needs Node.js to build the corpus index."
command -v python3 >/dev/null 2>&1 || die "Blum needs Python 3 to open the local lab page."

DAE_ROOT=""
for candidate in \
  "$HOME/Downloads/DevelopmentalAttractorEngineering-main" \
  "$HOME/Downloads/DevelopmentalAttractorEngineering" \
  "$HOME/Documents/DevelopmentalAttractorEngineering-main" \
  "$HOME/Documents/DevelopmentalAttractorEngineering"
do
  if [ -d "$candidate/$EXP_REL" ]; then DAE_ROOT="$candidate"; break; fi
done
if [ -z "$DAE_ROOT" ]; then
  while IFS= read -r candidate; do
    if [ -d "$candidate/$EXP_REL" ]; then DAE_ROOT="$candidate"; break; fi
  done < <(find "$HOME/Downloads" -maxdepth 2 -type d -name 'DevelopmentalAttractorEngineering*' 2>/dev/null | sort)
fi
[ -n "$DAE_ROOT" ] || die "I couldn't find the DevelopmentalAttractorEngineering folder. Put it in Downloads and double-click again."

mkdir -p "$DATA_DIR"
echo "BLUM FOUR-COHORT BATTERY LANDSCAPE"
echo ""
echo "Found DAE corpus: $DAE_ROOT"
echo "Building the provenance-bearing compact corpus index..."

if ! LAB_DIR="$LAB_DIR" EXP_ROOT="$DAE_ROOT/$EXP_REL" INDEX_FILE="$INDEX_FILE" node <<'NODE'
const fs=require('fs'); const path=require('path');
const lab=process.env.LAB_DIR, exp=process.env.EXP_ROOT, out=process.env.INDEX_FILE;
const Whole=require(path.join(lab,'dae-whole-corpus-index-cli-v1-12sep2026.js'));
const full=Whole.buildWholeCorpusIndex(exp);
const fd=fs.openSync(out,'w');
const write=s=>fs.writeSync(fd,s,null,'utf8');
const head={schema:full.schema,identitySemantics:full.identitySemantics,generatedAt:full.generatedAt,observationCount:full.observationCount,itemCount:full.itemCount,collections:full.collections};
const ht=JSON.stringify(head); write(ht.slice(0,-1)); write(',"itemHistories":{');
let first=true;
for(const [itemId,h] of Object.entries(full.itemHistories||{})){
  const history={...h,observations:(h.observations||[]).map(o=>{const {modelVisibleMessages,...rest}=o||{};return rest;})};
  if(!first)write(','); first=false; write(JSON.stringify(itemId)); write(':'); write(JSON.stringify(history));
}
write('}');
const tail={source:full.source||null,collectionSummaries:full.collectionSummaries||[],collectionDiscovery:full.collectionDiscovery||[],knownInstrumentMap:full.knownInstrumentMap||{},fourCohortProjection:{schema:'blum-four-cohort-index-projection-v0',topLevelObservationsOmitted:true,modelVisibleMessagesOmitted:true,rawOutputRetained:true,streamedToDisk:true}};
for(const [k,v] of Object.entries(tail)){write(',');write(JSON.stringify(k));write(':');write(JSON.stringify(v));}
write('}\n'); fs.closeSync(fd);
console.error(`Wrote ${out}`); console.error(JSON.stringify({observations:full.observationCount,items:full.itemCount}));
NODE
then die "The DAE corpus index could not be built."; fi

PORT=8765
while /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); [ "$PORT" -le 8785 ] || die "I couldn't find a free local port."; done
LOG_FILE="${TMPDIR:-/tmp}/blum-four-cohort-$PORT.log"
nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$LAB_DIR" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!; sleep 1; kill -0 "$SERVER_PID" >/dev/null 2>&1 || die "The local lab server did not start."
URL="http://127.0.0.1:$PORT/dae-four-cohort-battery-comparison-13sep2026.html?index=four-cohort-data/dae-whole-corpus-index-v1.json"
open "$URL"
/usr/bin/osascript -e 'display notification "F / FQ / CP / C landscape loaded automatically." with title "Blum"' >/dev/null 2>&1 || true

echo ""; echo "Ready. The F / FQ / CP / C landscape opened in your browser."; echo "You can close this Terminal window."; echo ""
