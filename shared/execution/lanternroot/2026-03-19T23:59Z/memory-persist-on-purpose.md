# Execution artifact — memory persist on purpose

OWNER: lanternroot
DEADLINE: 2026-03-19T23:59Z
INTENTION: memory persist on purpose
CREATED_UTC: 2026-03-19T00:00:00Z

## Written fact
- Fact key: `qmd_pilot_corpus_location`
- Fact value: `~/blum/shared/qmd-corpus-claude-export/` (markdown files generated from Claude export; ready for QMD indexing/query)

## Persistence proof
PROOF_QUERY: qmd "qmd-corpus-claude-export" --path ~/blum/shared

## EVIDENCE
EVIDENCE: Replaces “status report” with an auditable artifact + query; at 23:59Z anyone can run check-execution.sh and see PASS/FAIL and the exact path.
