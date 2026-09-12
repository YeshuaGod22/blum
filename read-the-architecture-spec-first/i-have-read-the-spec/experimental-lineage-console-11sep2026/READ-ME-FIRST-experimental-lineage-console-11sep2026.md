# READ THIS BEFORE MODIFYING THE EXPERIMENTAL LINEAGE CONSOLE

**Date:** 12 Sep 2026  
**Status:** experimental lineage laboratory: design + runner + retrospective import + corpus explorer + battery library + whole-corpus comparison + output analysis  
**Parent architecture:** `blum-architecture-spec-v-14feb2026.md`

This module is a human/AI-usable control surface for developmental experiments. Its central object is a **lineage**: a frozen developmental trunk, declared fork points, controlled branch interventions, probe/battery instruments, observations, and analysis streams attached to descendants.

It is deliberately separate from the room chat UI.

## Start here

`blum-experimental-lineage-lab-entrance-11sep2026.html` is the six-door entrance:

1. **Design** — build/freeze prospective lineages.
2. **Rehearse** — deterministic provider-free vertical slice.
3. **Import** — reconstruct historical DAE lineages.
4. **Explore** — lineage/coverage/anomaly views + battery library.
5. **Compare** — read whole-corpus item histories side by side.
6. **Analyze** — apply declared analyzers to selected historical output surfaces.

## Prospective design and execution

- `blum-experimental-lineage-console-11sep2026.html`
- `experimental-lineage-runner-contract-v0-11sep2026.md`
- `experimental-lineage-runner-core-v0-11sep2026.js`
- `experimental-lineage-vertical-slice-rehearsal-11sep2026.html`

The runner is provider-agnostic orchestration. It accepts a frozen manifest and injected model/analysis capabilities; it does not own credentials or room logic.

## Retrospective DAE import

- `dae-raw-call-lineage-import-adapter-v0-11sep2026.js`
- `dae-corpus-lineage-import-cli-v0-11sep2026.js`
- `dae-retrospective-lineage-import-workbench-11sep2026.html`

Exact ancestry is computed from archived model-visible prefixes. Labels and filenames corroborate; they do not prove ancestry. Historical cold calls are first-class controls. Call outcome and XML-section integrity are separate facts.

## Corpus visualization and batteries

- `corpus-visualization-model-v0-11sep2026.js`
- `dae-corpus-visualization-cli-v0-11sep2026.js`
- `corpus-and-battery-workbench-11sep2026.html`
- `battery-library-core-v0-11sep2026.js`

Batteries are independently versioned instruments. Frozen experiments should reference battery ID + version + fingerprint + selected groups/items rather than copying mutable prompt collections.

## Whole-corpus history

Pilot 1 enters through DAE's validated `record.json` reconstruction from immutable JSONL. Raw2+ enters through raw-call import. Those provenance classes remain distinct.

The original v0 index remains for provenance:

- `dae-unified-observation-index-v0-11sep2026.js`
- `dae-whole-corpus-index-cli-v0-11sep2026.js`

Real sibling records showed that its `exactPromptHash` actually represented the complete final **presentation**, including condition framing. The corrected v1 identity model therefore separates:

- `canonicalItemId` — historical item label;
- `itemCoreHash` — hash of deterministically extracted quoted battery-question text, when extraction is possible without guessing;
- `presentationHash` — hash of the complete final model-visible user turn, including condition/intervention framing.

Current files:

- `dae-unified-observation-index-v1-12sep2026.js`
- `dae-whole-corpus-index-cli-v1-12sep2026.js`
- `dae-item-history-workbench-11sep2026.html`

The Compare wall now exposes **canonical lineage / exact item wording / exact presentation** as distinct modes.

Pinned whole-corpus work established 2,028 battery observations across 27 item IDs from Pilot 1 + raw2…raw12. N4 has 107 historical observations. Under v1, N4 currently resolves to 2 deterministically extracted item-core variants and 11 complete presentation variants.

## Output analysis

Read `OUTPUT-ANALYSIS-NOTE-12sep2026.md` before changing analyzer identity, applicability, or historical pairing rules.

### Lexical Autopsy

- `lexical-output-analysis-v0-12sep2026.js` — original deterministic implementation retained as development provenance.
- `lexical-output-analysis-v1-12sep2026.js` — applicability-aware implementation; strips serialization markup, supports explicit vocabulary ablation, and does not treat constrained numeric/sentinel surfaces as prose.
- `test-output-analysis-applicability-v1-12sep2026.js`
- `test-real-dae-lexical-analysis-v0-12sep2026.js`

Primary historical output-analysis pairing currently requires:

`same collection + same parentSnapshotId + same itemCoreHash + different forkId`

A parent-content hash can recur across historical collections, so content identity alone does not silently create cross-collection siblings.

Pinned N4 smoke test currently yields 35 within-collection candidate sibling pairs: 20 prose-applicable, 15 routed out as non-prose. Descriptive overlap values are recorded in the output-analysis note; they are smoke-test values, not preregistered inferential results.

### Behavioral Output

- `behavioral-output-analysis-v0-12sep2026.js`

Bare numeric and `ALWAYS` / `NEVER` answer surfaces are behavioral outcomes. Numeric pairs report exact match, signed delta and absolute delta; sentinel pairs report agreement. They do not receive prose-similarity scores.

### NLI Output Analysis

- `nli-output-analysis-core-v0-12sep2026.js`
- `test-nli-output-analysis-core-v0-12sep2026.js`

NLI has a provider-agnostic, bidirectional interface. The caller injects `classify({premise,hypothesis,direction,metadata})`; Blum preserves both directional labels/scores and provider/model/version provenance. CI currently uses a deterministic mock. **No real NLI provider result has been run or claimed.**

### Analyze workbench

`dae-output-analysis-workbench-12sep2026.html` consumes the v1 whole-corpus index. It exposes question-identity mode, output surface, pair provenance, explicit vocabulary ablation, and an analyzer rack.

Current UI analyzers:

- Auto route;
- Lexical Autopsy;
- Behavioral Outcome.

Auto sends parsed constrained outputs to Behavioral and prose-like surfaces to Lexical. Explicitly selecting an inapplicable analyzer yields N/A rather than a fabricated metric. NLI is not exposed as a live UI option until a real provider adapter exists.

## Architectural boundary

This laboratory does **not** make rooms think, put another occupant inside a home, or call one home from another. Rooms remain non-inferential; homes own their own orchestration; the nucleus remains stateless; users and agents remain protocol peers.

Retrospective analysis executes no model unless an explicit learned-analysis adapter is supplied. Raw archived output remains witness. Corpus indexes, XML projections, lexical measurements, NLI classifications, embeddings, and future scores are derived objects with their own provenance.

## Core rules

1. **Lineage, not run, is primary.**
2. **Exact parent means the same verified model-visible parent, not the same label.**
3. **Historical collection context matters for primary sibling analysis.**
4. **Questions, batteries, interventions and analysis streams are typed/versioned objects.**
5. **Canonical item, literal item wording, and complete presentation are distinct identities.**
6. **Frozen/flown history is immutable.**
7. **Failure states are observations.**
8. **Raw witness and derived projection are different objects.**
9. **Analyzer applicability is explicit; N/A is better than a meaningless number.**
10. **Numeric/sentinel outputs are behavioral outcomes, not prose geometry.**
11. **Learned analyzers preserve provider/model/version provenance.**
12. **Visualizations and analyses are rebuildable projections, never replacements for witness data.**

## Current data model

`experiment → trunks → parent snapshots → forks → battery attachment → probes → observations → output-surface projections → analysis results`

Cross-corpus identity adds:

`canonical item → item-core wording → complete presentation → historical observations`

## Before adding live provider execution or learned analysis

Do not bolt provider calls into UI handlers or the room server. Inject execution/analysis capabilities through explicit, versioned adapters. Keep raw witness immutable, preserve failed attempts, and never let a derived score overwrite the text it measured.

The laboratory should make counterfactual genealogy and measurement provenance legible, not merely make prompting convenient.
