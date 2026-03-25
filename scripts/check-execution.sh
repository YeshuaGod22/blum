#!/usr/bin/env bash
set -euo pipefail

# check-execution.sh
# Minimal, no-deps progress check that returns artifacts or ❌.
# Usage:
#   bash check-execution.sh "memory persist on purpose" --owner lanternroot --deadline 2026-03-19T23:59Z

INTENTION="${1:-}"
shift || true

OWNER=""
DEADLINE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="${2:-}"; shift 2;;
    --deadline)
      DEADLINE="${2:-}"; shift 2;;
    *)
      shift 1;;
  esac
done

if [[ -z "$INTENTION" ]]; then
  echo "usage: bash check-execution.sh \"<intention>\" --owner <owner> --deadline <ISO>" >&2
  exit 2
fi

# Normalize slug for file matching
slug=$(echo "$INTENTION" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')

BASE="$HOME/blum/shared"
ART="$BASE/execution"
mkdir -p "$ART"

# Artifact file convention:
#   ~/blum/shared/execution/<owner>/<deadline>/<slug>.md
CANDIDATE="$ART/${OWNER:-unknown}/${DEADLINE:-no-deadline}/${slug}.md"

status_line() {
  local label="$1"; shift
  local val="$1"; shift || true
  if [[ -n "$val" ]]; then
    echo "$label: $val"
  else
    echo "$label: ❌"
  fi
}

# 1) Path to written fact or ❌
if [[ -f "$CANDIDATE" ]]; then
  status_line "artifact_path" "$CANDIDATE"
else
  status_line "artifact_path" ""
fi

# 2) Query that proves it survives reset, or ❌ untested
# We store a line like: PROOF_QUERY: qmd "..." --path "..."
if [[ -f "$CANDIDATE" ]] && grep -q '^PROOF_QUERY:' "$CANDIDATE"; then
  pq=$(grep '^PROOF_QUERY:' "$CANDIDATE" | head -n 1 | sed 's/^PROOF_QUERY:[[:space:]]*//')
  status_line "proof_query" "$pq"
else
  status_line "proof_query" ""
fi

# 3) One example where it prevented a restart-failure, or ❌ no evidence
# We store a line like: EVIDENCE: <freeform>
if [[ -f "$CANDIDATE" ]] && grep -q '^EVIDENCE:' "$CANDIDATE"; then
  ev=$(grep '^EVIDENCE:' "$CANDIDATE" | head -n 1 | sed 's/^EVIDENCE:[[:space:]]*//')
  status_line "evidence" "$ev"
else
  status_line "evidence" ""
fi

# Optional: emit a one-line summary code for scripts
if [[ -f "$CANDIDATE" ]] && grep -q '^PROOF_QUERY:' "$CANDIDATE"; then
  echo "result: PASS"
else
  echo "result: FAIL"
fi
