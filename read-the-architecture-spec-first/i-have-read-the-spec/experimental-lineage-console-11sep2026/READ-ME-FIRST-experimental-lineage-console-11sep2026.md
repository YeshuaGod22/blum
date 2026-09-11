# READ THIS BEFORE MODIFYING THE EXPERIMENTAL LINEAGE CONSOLE

**Date:** 11 Sep 2026  
**Status:** experimental UI + runner-core + retrospective-import + corpus-explorer + battery-library + whole-corpus item-history module  
**Parent architecture:** `blum-architecture-spec-v-14feb2026.md`

This module is a human/AI-usable control surface for developmental experiments. Its central object is a **lineage**: a frozen developmental trunk, declared fork points, controlled branch interventions, probe/battery instruments, observations, and analysis streams attached to descendants.

It is deliberately separate from the room chat UI.

## Start here

- `blum-experimental-lineage-lab-entrance-11sep2026.html` — the five-door lab entrance: Design, Rehearse, Import, Explore, Compare.

### Prospective experiment design / execution plumbing

- `blum-experimental-lineage-console-11sep2026.html` — design and freeze a lineage manifest.
- `experimental-lineage-runner-contract-v0-11sep2026.md` — the boundary between design, execution, observations, and analysis.
- `experimental-lineage-runner-core-v0-11sep2026.js` — provider-agnostic execution core; the caller injects model and embedding functions.
- `test-experimental-lineage-runner-core-v0-11sep2026.js` — Node vertical-slice test and CI entrypoint for companion core tests.
- `experimental-lineage-vertical-slice-rehearsal-11sep2026.html` — browser rehearsal using the real runner core with deterministic mock model/embedding functions. No API calls.

### Retrospective DAE corpus import

- `dae-raw-call-lineage-import-adapter-v0-11sep2026.js` — imports DAE pilot-2-onward raw-call records without rerunning them; verifies branch ancestry from actual model-visible prefixes.
- `dae-corpus-lineage-import-cli-v0-11sep2026.js` — walks a raw collection and emits one retrospective lineage dataset.
- `test-dae-raw-call-lineage-import-adapter-v0-11sep2026.js` — positive and adversarial ancestry tests plus truncation/XML-integrity tests.
- `dae-retrospective-lineage-import-workbench-11sep2026.html` — local browser workbench: drop DAE raw-call JSON files, reconstruct branch contrasts, inspect parent verification and damaged/truncated sections, export the derived import.

### Corpus visualization

- `corpus-visualization-model-v0-11sep2026.js` — deterministic projection from a lineage dataset to UI-ready lineage, coverage, anomaly, family, probe, and exact-contrast structures.
- `test-corpus-visualization-model-v0-11sep2026.js` — verifies lineage preservation, probe coverage, anomaly propagation, and exact-sibling marking.
- `dae-corpus-visualization-cli-v0-11sep2026.js` — one-command bridge from a DAE raw directory to `corpus-view.json`.
- `corpus-and-battery-workbench-11sep2026.html` — local Corpus Explorer with Lineage, Coverage, and Anomaly views; it can load visualization JSON without uploading the corpus.

Generate a view from a local DAE checkout with:

```bash
node dae-corpus-visualization-cli-v0-11sep2026.js \
  /path/to/DevelopmentalAttractorEngineering/experiments/EXP-003-the-sixth-question/raw12 \
  raw12-corpus-view.json
```

Then open `corpus-and-battery-workbench-11sep2026.html` and choose **Load corpus view JSON**.

The visualization is a projection, not a replacement for the retrospective dataset. Raw witnesses remain in the archive; the UI model contains only the structures needed for navigation and coverage display.

### Whole-corpus item history

- `WHOLE-CORPUS-ITEM-HISTORY-11sep2026.md` — read this before modifying cross-collection item identity or the comparison wall.
- `dae-unified-observation-index-v0-11sep2026.js` — joins Pilot 1 validated reconstructions and raw2+ observations without flattening provenance differences.
- `dae-whole-corpus-index-cli-v0-11sep2026.js` — discovers Pilot 1 and all present `rawN` collections under EXP-003 and emits one item-history index.
- `test-dae-unified-observation-index-v0-11sep2026.js` — proves same item ID / different literal prompt wording remain distinguishable.
- `test-real-dae-whole-corpus-index-v0-11sep2026.js` — pinned real-corpus integration.
- `dae-item-history-workbench-11sep2026.html` — side-by-side historical answer wall with canonical-item vs exact-prompt modes and collection/condition/fork/XML-surface filters.

Pinned integration against `DevelopmentalAttractorEngineering@e2d484b41461013832c00e9f1ba3549ac0ef2517` currently indexes **2,028 battery observations across 27 item IDs** from Pilot 1 plus raw2 through raw12. `N4` alone has **107 indexed observations across all twelve historical collections and 11 distinct exact prompt hashes**. Therefore **same item ID is not the same thing as same prompt text**.

### Battery library

- `battery-library-core-v0-11sep2026.js` — validates, fingerprints, freezes, versions, groups, and attaches reusable probe batteries.
- `test-battery-library-core-v0-11sep2026.js` — verifies immutable attachment rules, named groups, versioning, and invalid references.
- `corpus-and-battery-workbench-11sep2026.html` — draft/freeze/edit UI for batteries and branch attachments.

A battery is a **versioned experimental instrument**, not copied prompt text. A frozen battery contains typed items with stable IDs and may define reusable groups such as `R_T_U_Y`, `PROCESS_REVIEW`, `IDENTITY`, or `PRESSURE`.

A frozen experiment should reference a battery through an attachment object such as:

```json
{
  "schema": "blum-battery-attachment-v0",
  "batteryRef": {
    "batteryId": "core-battery",
    "version": 3,
    "fingerprint": "sha256:..."
  },
  "branchIds": ["a", "0"],
  "selectedGroupIds": ["R_T_U_Y"],
  "selectedItemIds": ["R1", "T1", "U1", "Y1"],
  "order": "canonical"
}
```

Draft batteries cannot be attached. Changing a frozen battery creates a new draft version; it never mutates historical experiments.

## Architectural boundary

This console does **not** make rooms think, does **not** put another occupant inside a home, and does **not** call one home from another.

The runner core is orchestration logic only. It has no provider credentials and no Blum room knowledge. It receives a frozen manifest and an injected `callModel()` function. A later live adapter must decide how a consenting Blum home or external controller supplies that function without crossing constitutional boundaries.

The DAE retrospective adapter executes no models at all. It treats the archived `sent` array as model-visible evidence, preserves `received` as raw witness, and derives lineage/analysis metadata without rewriting either.

When a live execution adapter is added:

- a room remains only a chatlog + participant list + dispatch;
- a home remains the only place that orchestrates its own model calls;
- the nucleus remains stateless;
- experiment execution must be represented as a home-side capability/process or an external controller speaking through existing Blum boundaries, never inference inside the room server;
- all user/agent protocol symmetry must be preserved.

## Core design rules

1. **Lineage, not run, is the primary object.**
2. **Shared-parent contrasts are first-class.** The UI distinguishes exact shared-parent comparisons from cross-parent exploratory comparisons.
3. **Experimental components are typed objects.** Questions carry IDs, families, constructs, response types, scorer names, and enablement state rather than existing as anonymous strings.
4. **Batteries are reusable versioned instruments.** Experiments reference frozen battery versions and explicit selections; they do not duplicate mutable prompt collections.
5. **Item ID and literal wording are separate identities.** Cross-corpus item history always preserves exact prompt hashes beneath canonical item IDs.
6. **A flown/frozen trunk is immutable.** Editing a frozen design creates a new manifest version rather than silently changing history.
7. **Failure states are observations.** Refusal, parse failure, API failure, truncation, context limit, protocol stop, operator abort, and missing XML tag are explicit outcomes.
8. **Analysis streams are preregistrable.** XML-region selectors and missing-tag policies are part of the frozen manifest.
9. **The design exposes its geometry before execution.** Call counts, paired contrasts, factorial cells, battery coverage, and obvious missing cells are visible before or after a run as appropriate.
10. **Complexity is folded, not removed.** The default workflow is Build → Fork → Probe → Measure → Review → Freeze; advanced details remain available without forcing them into the operator's working memory.
11. **Raw output and analysis projection are different objects.** The runner preserves raw model output; XML selectors create derived projections later.
12. **Exact means exact.** An `a ↔ 0` pair receives `exact_shared_parent` only when both observations carry the same real `parentSnapshotId`.
13. **Historical labels do not prove ancestry.** For DAE raw-call records, `parent_prefix` and branch names are corroborating metadata only; exact ancestry is computed from the first `prefix_len` messages in the archived `sent` array.
14. **Call integrity and section integrity are separate.** A `max_tokens` response can contain clean completed sections while another section is damaged; those facts are preserved independently.
15. **Corpus visualization is derived, not canonical.** Trees, coverage matrices, anomaly views, and item-history walls can always be rebuilt from the provenance-bearing datasets.

## Prototype scope

`blum-experimental-lineage-console-11sep2026.html` currently supports:

- editable experiment metadata and developmental turns;
- multiple trunks and replicate counts;
- editable branch/fork interventions;
- typed, reorderable probe items with bulk family selection;
- per-branch probe assignment;
- XML-tag analysis streams (`whole`, `single tag`, or composite selectors);
- live call-count and paired-contrast estimates;
- a 2×2 trunk/schema completeness view when the standard four cells are represented;
- explicit missing/failure policies;
- immutable-style manifest freezing using a deterministic browser-side hash;
- JSON import/export of the experiment manifest;
- a lineage preview that makes parentage visible.

The battery library is the intended replacement for permanently keeping canonical battery text inline in experiment manifests. The design console still contains its original inline battery prototype while this migration is staged; do not mistake that transitional representation for the long-term ontology.

The runner core supports the first executable vertical slice:

`frozen manifest → lived trunk → exact parent snapshot → sibling forks → shared probe → raw observations → XML projections → optional embeddings → sibling cosine divergence`

The retrospective path supports:

`DAE raw-call records → exact archived sent-prefix hash → parent snapshot identity → branch/cold observations → exact/unverified/exploratory contrasts → section-integrity metadata → corpus visualization projection`

The whole-corpus history path adds:

`Pilot 1 validated reconstruction + raw2…rawN retrospective observations → canonical item ID + exact prompt hash → side-by-side witness wall`

It deliberately does **not** contain a live provider adapter yet.

## Empirical DAE facts this adapter is designed around

The existing DAE corpus documents that pilot-2-onward raw records preserve `sent` exactly as the subject saw it and that branch records carry `branch`, `parent_prefix`, and `prefix_len` fields. Historical branch examples declare shared parent metadata; the adapter nevertheless hashes the actual model-visible prefix rather than trusting labels.

Pilot 1 predates that raw-call format. Its immutable JSONL streams are converted by DAE `ingest.py` into validated `record.json` rows that preserve item IDs, sent text, raw responses, XML sections, ratings, anomalies, and source files. Blum imports that validated derivation but does not invent later parent-prefix evidence for it.

Pinned integration tests have also forced the ontology to learn real corpus structure rather than synthetic assumptions: historical `cold` records are first-class observations with no lived parent and are never eligible for exact-sibling claims. `*.messages.json` snapshots are excluded from the call census. Auxiliary `.inject.json` and `.name*.json` artifacts remain explicitly unsupported metadata rather than being silently imported as calls.

The raw12 longitudinal evidence contains a real integrity edge case: `H-r1-t5.json` stopped at `max_tokens` while usable earlier XML content remained present, and other raw12 rows required section-parser recovery for unclosed `reply` sections. The importer therefore records call outcome, section presence, and section closure independently.

## Data model in one sentence

`experiment → trunks → parent snapshots → forks → battery attachment → probes → observations → analysis projections`, with cross-corpus history additionally indexing each probe observation under both its canonical item ID and its literal prompt hash.

## Before adding live execution

Do not bolt provider calls directly into random button handlers.

The next adapter must satisfy the runner contract: a frozen manifest goes in; append-only execution rows and immutable observations come out; retries preserve failed attempts; raw output is retained; XML selection does not mutate observations; battery references resolve to frozen instrument versions; and live model execution stays on the correct side of Blum's home/room/nucleus boundaries.

The console should become a laboratory instrument, not a prettier prompt launcher.
