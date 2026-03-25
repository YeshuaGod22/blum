
#!/bin/bash

mkdir -p ~/blum/tmp/proof
ts="$(date -u +%Y%m%dT%H%M%SZ)"
log=~/blum/tmp/proof/qmd-proof-$ts.log

# record command traces + all output
set -o pipefail
exec > >(tee -a "$log") 2>&1
PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '
set -x

# Provenance
date -u
qmd --version

# QMD Search Queries
qmd search "let me reframe" -c claude_export_2026_02_19 --limit 20
echo $?

qmd search "reframe" -c claude_export_2026_02_19 --limit 20
echo $?

qmd search "let me reframe" -c claude_export_2026_02_19 --limit 20
echo $?

# Hard-negative control
qmd search "asdfghjkl-zxcvbnm-nomatch" -c claude_export_2026_02_19 --limit 5
echo $?

# Ops log excerpt
if [ -f ~/blum/homes/libre/ops.log ]; then
  tail -n 200 ~/blum/homes/libre/ops.log
else
  ls -la ~/blum/homes/libre
fi

set +x
echo "LOG_SAVED_TO=$log"
