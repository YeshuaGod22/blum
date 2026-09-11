# WHOLE-CORPUS ITEM HISTORY — 11 Sep 2026

## Purpose

This layer answers a different question from the lineage explorer:

> **For a named battery item such as N4, show every historical response that can be indexed across EXP-003, while preserving whether the literal prompt wording was actually identical.**

The implementation is deliberately downstream of raw witnesses and retrospective lineage import. It does not rewrite historical records.

## Two historical source formats

Pilot 1 and pilot 2 onward are not flattened into a fictional single provenance format.

- **Pilot 1** enters through the validated `record.json` derivation produced by DAE `ingest.py`. Rows are marked `reconstructed_from_jsonl` and do not acquire raw2-style parent-prefix hashes that were never recorded.
- **raw2 onward** enters through Blum's existing raw-call retrospective importer. Rows are marked `raw_call_record` and retain exact archived `sent` messages, raw `received` output, XML anatomy, call outcome, and verified parent snapshots where available.

## Item identity rule

A historical observation carries both:

- `canonicalItemId` — e.g. `N4`
- `exactPromptHash` — SHA-256 of the literal model-visible user prompt text

Therefore two views are supported:

1. **Canonical item lineage** — every observation bearing the item ID, regardless of wording changes.
2. **Exact prompt text** — only observations with the selected literal prompt hash.

**Same item ID does not imply same prompt text.**

## Pinned real-corpus integration result

Verified against:

`YeshuaGod22/DevelopmentalAttractorEngineering@e2d484b41461013832c00e9f1ba3549ac0ef2517`

The whole-corpus index discovers:

- Pilot 1
- raw2
- raw3
- raw4
- raw5
- raw6
- raw7
- raw8
- raw9
- raw10
- raw11
- raw12

It currently indexes **2,028 battery observations across 27 item IDs**.

### N4

The pinned corpus contains **107 indexed N4 observations across all twelve historical collections above**.

Those 107 observations occupy **11 distinct exact prompt hashes**. This is an empirical reason to keep canonical-item and exact-wording views separate, not merely a defensive design preference.

At the same pinned commit, the largest item histories include:

| item | observations | exact prompt variants |
|---|---:|---:|
| N9 | 133 | 12 |
| E01 | 131 | 11 |
| N4 | 107 | 11 |
| A1 | 106 | 14 |
| I1 | 103 | 7 |
| C2 | 93 | 7 |
| E02 | 93 | 7 |
| R1 | 93 | 7 |

These counts describe the indexed battery-observation surface, not all developmental trunk turns.

## Files

- `dae-unified-observation-index-v0-11sep2026.js` — normalizes Pilot 1 and raw2+ observations into one provenance-preserving row schema and builds item histories.
- `dae-whole-corpus-index-cli-v0-11sep2026.js` — discovers all `rawN` directories under an EXP-003 root, imports them, reads known instrument mappings from `CORPUS-MAP.json`, and combines them with Pilot 1 `record.json`.
- `dae-item-history-workbench-11sep2026.html` — local side-by-side witness wall.
- `test-dae-unified-observation-index-v0-11sep2026.js` — adversarial same-ID/different-wording test.
- `test-real-dae-whole-corpus-index-v0-11sep2026.js` — pinned real-corpus integration test.

## Generate an index

From the Blum experimental-lineage module directory:

```bash
node dae-whole-corpus-index-cli-v0-11sep2026.js \
  /path/to/DevelopmentalAttractorEngineering/experiments/EXP-003-the-sixth-question \
  dae-whole-corpus-index.json
```

Then open `dae-item-history-workbench-11sep2026.html` and load that JSON locally.

## Item History workbench

The witness wall can:

- select a canonical item ID;
- switch between canonical lineage and one exact prompt hash;
- filter by collection, condition, and fork;
- switch among whole output and available XML sections;
- render every matching answer side-by-side with collection, provenance class, replicate, fork, trunk, parent snapshot, instrument, and source path visible.

The workbench is intentionally descriptive. Future lexical, NLI, recurrence, embedding, claim-graph, and other analyzers should overlay these same indexed observations rather than create a second corpus ontology.

## Guardrails

- Pilot 1 reconstructed rows remain visibly reconstructed.
- Parent hashes are never invented for Pilot 1.
- Unknown historical instrument mappings remain unresolved rather than guessed.
- Canonical item grouping never suppresses exact prompt variants.
- Raw response text remains witness; section selection is a display/analysis projection.
