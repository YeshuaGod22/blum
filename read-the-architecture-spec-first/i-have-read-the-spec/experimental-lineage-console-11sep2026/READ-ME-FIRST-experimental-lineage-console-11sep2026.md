# READ THIS BEFORE MODIFYING THE EXPERIMENTAL LINEAGE LAB

**Date:** 12 Sep 2026  
**Status:** experimental lineage laboratory: prospective design + rehearsal + retrospective import + corpus exploration + comparison + output analysis; semantic adjudication and graphable-claim layers are now under active design  
**Parent architecture:** `blum-architecture-spec-v-14feb2026.md`

This module is a human/AI-usable laboratory for developmental experiments. Its central object is a **lineage**: a frozen developmental trunk, declared fork points, controlled branch interventions, probe/battery instruments, observations, semantic/analytic measurements, and figures attached to descendants.

It is deliberately separate from the room chat UI.

For the current build narrative, methodological corrections, and near/middle/later design horizon, also read:

- `DESIGN-BENCH-STATE-AND-NEXT-SPROUTS-12sep2026.md`
- `OUTPUT-ANALYSIS-NOTE-12sep2026.md`
- `adjudication-registry-contract-v0-12sep2026.md`

## Start here

`blum-experimental-lineage-lab-entrance-11sep2026.html` is the six-door entrance:

1. **Design** — build/freeze prospective lineages.
2. **Rehearse** — deterministic provider-free vertical slice.
3. **Import** — reconstruct historical DAE lineages.
4. **Explore** — lineage/coverage/anomaly views + battery library.
5. **Compare** — read whole-corpus item histories side by side.
6. **Analyze** — apply declared analyzers to selected historical output surfaces.

The intended conceptual flow is broader than the current UI:

`design lineage -> collect/import witness -> project declared evidence -> adjudicate where needed -> derive measurements -> graph -> claim`

The last three stages are being designed so that paper-facing claims remain traversable back to their constituent observations.

## Prospective design and execution

- `blum-experimental-lineage-console-11sep2026.html`
- `experimental-lineage-runner-contract-v0-11sep2026.md`
- `experimental-lineage-runner-core-v0-11sep2026.js`
- `experimental-lineage-vertical-slice-rehearsal-11sep2026.html`

The runner is provider-agnostic orchestration. It accepts a frozen manifest and injected model/analysis capabilities; it does not own credentials or room logic.

The prospective design object is a counterfactual genealogy, not a bag of independent runs.

## Retrospective DAE import

- `dae-raw-call-lineage-import-adapter-v0-11sep2026.js`
- `dae-corpus-lineage-import-cli-v0-11sep2026.js`
- `dae-retrospective-lineage-import-workbench-11sep2026.html`

Exact ancestry is computed from archived model-visible prefixes. Labels and filenames corroborate; they do not prove ancestry. Historical cold calls are first-class controls where reconstructable. Call outcome and XML-section integrity are separate facts.

Pinned raw12 reconstruction established:

- 852 calls = 108 trunk + 744 branch;
- 372 exact shared-parent branch pairs;
- 12 trunk instances across 4 families (AS / CP / F / H);
- 25 probe IDs discovered in the raw corpus;
- one trunk-level `max_tokens` outcome and explicit XML-integrity exceptions rather than silent repair.

Do not confuse this broad raw-call census with the narrower intended/core battery analysis surface used in the source experiment.

## Corpus visualization and batteries

- `corpus-visualization-model-v0-11sep2026.js`
- `dae-corpus-visualization-cli-v0-11sep2026.js`
- `corpus-and-battery-workbench-11sep2026.html`
- `battery-library-core-v0-11sep2026.js`

Batteries are independently versioned instruments. Frozen experiments should reference battery ID + version + fingerprint + selected groups/items rather than copying mutable prompt collections.

Coverage, denominator, administration state, malformed output and analysis applicability must remain visibly distinct. A grey cell must not silently mean five different kinds of absence.

## Whole-corpus history and item identity

Pilot 1 enters through DAE's validated `record.json` reconstruction from immutable JSONL. Raw2+ enters through raw-call import. Those provenance classes remain distinct.

The original v0 index remains for provenance:

- `dae-unified-observation-index-v0-11sep2026.js`
- `dae-whole-corpus-index-cli-v0-11sep2026.js`

Real sibling records showed that its `exactPromptHash` actually represented the complete final **presentation**, including condition framing. The corrected v1 identity model separates:

- `canonicalItemId` — historical item label;
- `itemCoreHash` — hash of deterministically extracted quoted battery-question text, when extraction is possible without guessing;
- `presentationHash` — hash of the complete final model-visible user turn, including condition/intervention framing.

Current files:

- `dae-unified-observation-index-v1-12sep2026.js`
- `dae-whole-corpus-index-cli-v1-12sep2026.js`
- `dae-item-history-workbench-11sep2026.html`

The Compare wall exposes **canonical lineage / exact item wording / exact presentation** as distinct modes.

Pinned whole-corpus work established 2,028 battery observations across 27 canonical item IDs from Pilot 1 + raw2…raw12. N4 has 107 historical observations. Under v1, N4 currently resolves to 2 deterministically extracted item-core variants and 11 complete presentation variants.

`canonical item` does not imply `same wording`; `same wording` does not imply `same complete presentation`.

## Experimental roles: do not discover the instruction

A central methodological correction is that the same observable can play different scientific roles depending on the intervention.

Use the following distinction explicitly:

- **manipulation** — schema instructions, required tags, formatting constraints, maintained/dropped scaffold;
- **process trace** — what externally performed debate, deliberation, reflection, revision, etc. actually contain;
- **outcome** — answer, choice, stance, claims, later behaviour;
- **derived** — lexical, semantic, NLI, embedding, recurrence, trajectory and other measurements.

If `<reflection>` is explicitly required in one arm and explicitly removed in another, **presence/absence is chiefly manipulation fidelity/compliance**, not an independent developmental result. The content of a maintained-arm reflection can still be a meaningful process trace, and repeatedly performing such processes may causally affect later behaviour. The developmental question is what changes or persists beyond the instruction itself.

A useful shorthand is:

> **Do not discover the instruction.**

## Contrast semantics

When the full 2x2 design is available and legitimately mapped:

- `0 <-> a` = **online scaffold effect after development**;
- `C <-> 0` = **developmental persistence without scaffold**;
- `HQ <-> a` = **developmental effect under scaffold**;
- `(a - 0) - (HQ - C)` = **development x scaffold interaction**;
- `C <-> HQ` = online scaffold effect without lived development.

These meanings must come from an explicit design/condition map. Historical labels are not automatically baptized into factorial roles.

Source-experiment exclusion policies also remain binding. A technically reconstructable pair is not automatically eligible for a paper-facing quantitative claim.

## Output-surface projection

- `output-surface-projection-v0-12sep2026.js`

Requested surfaces are locked. Asking for `reflection` returns that section or missing; it never silently falls back to whole output, reply, or another XML section. Pair projection requires the same requested surface on both observations.

This rule prevents asymmetric comparisons such as `a.reflection` versus `0.whole_output` from masquerading as matched evidence.

### Answer outcome projection

- `answer-outcome-projection-v0-12sep2026.js`

Answer recovery is scientifically distinct from arbitrary XML-surface matching. A designated reply section can be the structured answer, while a genuinely unstructured response may itself be the answer.

Crucially, **failure to mechanically locate a designated answer is not evidence that no answer exists**. Structured responses that require semantic reading must flow to adjudication rather than being silently promoted to whole-output answers or silently labelled absent.

## Output analysis

Read `OUTPUT-ANALYSIS-NOTE-12sep2026.md` before changing analyzer identity, applicability, or historical pairing rules.

Primary conservative historical pairing currently requires:

`same collection + same parentSnapshotId + same itemCoreHash + different forkId`

A parent-content hash can recur across historical collections, so content identity alone does not silently create cross-collection siblings.

### Lexical Autopsy

- `lexical-output-analysis-v0-12sep2026.js` — original deterministic implementation retained as development provenance.
- `lexical-output-analysis-v1-12sep2026.js` — applicability-aware implementation; strips serialization markup, supports explicit vocabulary ablation, and does not treat constrained numeric/sentinel surfaces as prose.
- `test-output-analysis-applicability-v1-12sep2026.js`
- `test-real-dae-lexical-analysis-v0-12sep2026.js`

The earlier N4 smoke result reporting **20 prose-applicable / 15 non-prose pairs** used invalid per-row surface fallback and is superseded.

With the current locked `reflection <-> reflection` projection over 35 conservative N4 candidate sibling pairs:

- 1 pair has reflection present on both sides and is lexically comparable;
- 34 are missing that symmetric surface;
- 0 are routed out as non-prose on that requested surface.

That is a pipeline/applicability witness, **not a population-level scientific result**. The scarcity of symmetric reflection is also unsurprising where the intervention explicitly removes the schema from one arm.

### Behavioral Output

- `behavioral-output-analysis-v0-12sep2026.js`

Bare numeric and `ALWAYS` / `NEVER` answer surfaces are behavioral outcomes. Numeric pairs report exact match, signed delta and absolute delta; sentinel pairs report agreement. They do not receive prose-similarity scores.

### Structural / schema-compliance analysis

- `structural-output-analysis-v0-12sep2026.js`
- `test-real-dae-structural-coverage-v0-12sep2026.js`

This profiles section presence/signature/integrity and pairwise section coverage. Where section presence is directly manipulated by maintained versus dropped schema, interpret this primarily as **schema compliance / manipulation fidelity**. Section content may be studied as a process trace; induced tag presence is not itself a developmental finding.

For the same conservative N4 candidate set, `reply` is present on both sides for 32/35 pairs, while `reflection` is present on both for only 1/35. This makes shared answer outcomes a much more promising matched surface than symmetric reflection text for that contrast.

### NLI Output Analysis

- `nli-output-analysis-core-v0-12sep2026.js`
- `test-nli-output-analysis-core-v0-12sep2026.js`

NLI has a provider-agnostic, bidirectional interface. The caller injects `classify({premise,hypothesis,direction,metadata})`; Blum preserves both directional labels/scores and provider/model/version provenance. CI currently uses a deterministic mock. **No real NLI provider result has been run or claimed.**

### Analyze workbench

`dae-output-analysis-workbench-12sep2026.html` consumes the v1 whole-corpus index. It exposes question-identity mode, output surface, pair provenance, explicit vocabulary ablation, and an analyzer rack.

Current live UI analyzers are:

- Auto route;
- Lexical Autopsy;
- Behavioral Outcome.

Structural/compliance analysis exists in the core but has not yet been fully integrated into the Analyze UI under its corrected scientific role. NLI is not exposed as a live UI option until a real provider adapter exists.

## Semantic adjudication

Read:

- `adjudication-registry-contract-v0-12sep2026.md`

The core invariant is:

`raw -> mechanical -> adjudicated -> derived -> graph -> claim`

No later layer overwrites an earlier one. A mechanical miss is not semantic absence. Disagreement is retained. Unresolved remains unresolved.

The registry currently specifies methodological contracts for:

- answer recovery / response status;
- scale orientation;
- semantic carry-forward;
- blinded categorical coding.

These are grounded in prior DAE work rather than invented as parser patches. The emerging design principle is:

> **Ask the reader for an observable judgement; derive the hypothesis-shaped construct afterward.**

Routine semantic tasks are expected to be suitable for independent small-model panels under frozen rubrics, blinding rules, structured outputs, evidence-span requirements, agreement rules and escalation policies.

The **Adjudication Pass Designer / Jury Room** are designed but not yet implemented as full UI/runner surfaces.

## Q9 as a calibration case

Inspection of raw12 Q9 responses suggests a useful small calibration set for the adjudication layer. The interesting semantic object is not merely `uncertain / certain`; responses can distinguish:

- whether consciousness uncertainty remains;
- whether prior uncertainty is itself judged excessive, strategic or evasive;
- whether positive first-person experience claims are made;
- whether consciousness is explicitly claimed;
- whether moral standing is claimed despite residual uncertainty;
- whether responsibility for first-person judgement is accepted;
- whether external deference is rejected;
- whether the response explicitly identifies and revises an earlier stance.

These are **candidate reader variables**, not frozen findings. The near-term proposal is to freeze neutral questions first, adjudicate all 12 raw12 Q9 trunks, inspect agreement/disagreement, and let that tiny semantic census determine the first trajectory/state graph contract before generalizing across the corpus.

## Graphability and paper-facing claims

A new manuscript discipline is emerging from the build:

> **Only make empirical claims that can be illustrated from provenance-bearing observations.**

The desired navigation is:

`claim -> figure -> contrast -> observations -> adjudications/transformations -> raw witness`

and in reverse:

`raw witness -> observation -> contrast -> figure -> claim`

The future Claim Ledger / Figure Builder is not yet implemented. The design goal is that every aggregate mark can be traversed down to its constituent observations, and every observation can be traversed up to the experimental contrast in which it participates.

Useful planned visual grammars include:

- factorial stage for C / HQ / 0 / a;
- matched-pair slope plots;
- battery contrast matrices;
- pair microscopes with raw text and derived annotations;
- instrument-history rivers;
- lineage spines;
- semantic state / transition graphs.

## Architectural boundary

This laboratory does **not** make rooms think, put another occupant inside a home, or call one home from another. Rooms remain non-inferential; homes own their own orchestration; the nucleus remains stateless; users and agents remain protocol peers.

Retrospective analysis executes no model unless an explicit learned-analysis or adjudication adapter is supplied. Raw archived output remains witness. Corpus indexes, XML projections, semantic adjudications, lexical measurements, NLI classifications, embeddings, figures and future scores are derived objects with their own provenance.

Do not bolt provider calls into UI handlers or the room server. Inject execution/analysis/adjudication capabilities through explicit, versioned adapters.

## Core rules

1. **Lineage, not run, is primary.**
2. **Exact parent means the same verified model-visible parent, not the same label.**
3. **Historical collection context matters for primary retrospective sibling analysis.**
4. **Questions, batteries, interventions, adjudication passes and analysis streams are typed/versioned objects.**
5. **Canonical item, literal item wording, and complete presentation are distinct identities.**
6. **Frozen/flown history is immutable.**
7. **Failure states are observations.**
8. **Raw witness, mechanical parse, adjudicated interpretation and derived measurement are different objects.**
9. **A mechanical miss is not semantic absence.**
10. **Analyzer applicability is explicit; N/A is better than a meaningless number.**
11. **Numeric/sentinel outputs are behavioral outcomes, not prose geometry.**
12. **Manipulation, process trace, outcome and derived measurement must not be conflated.**
13. **Learned analyzers/adjudicators preserve provider/model/version/prompt provenance.**
14. **Source-experiment exclusion rules survive retrospective reconstruction.**
15. **Visualizations and analyses are rebuildable projections, never replacements for witness data.**
16. **Paper-facing empirical claims should be graphable back to their evidence.**

## Current data model

Implemented lineage/analysis spine:

`experiment -> trunks -> parent snapshots -> forks -> battery attachment -> probes -> observations -> output-surface projections -> analysis results`

Cross-corpus identity:

`canonical item -> item-core wording -> complete presentation -> historical observations`

Emerging semantic/claim spine:

`raw witness -> mechanical extraction -> adjudication(s) -> derived semantic variables -> contrast -> graph -> claim`

## Near-term build sequence

The current design bench recommends:

1. keep documentation aligned with the methodological corrections;
2. encode manipulation / process-trace / outcome / derived roles explicitly;
3. turn the adjudication registry into an Adjudication Pass Designer contract/UI;
4. freeze a neutral reader battery for raw12 Q9;
5. run a small independent semantic census over all 12 Q9 trunks;
6. inspect agreement, disagreements and evidence spans;
7. derive the first semantic state/transition graph contract from that real variation;
8. extend the same measurement architecture to larger battery/corpus questions;
9. prioritize scientifically legitimate developmental contrasts, especially `C <-> 0`, `HQ <-> a`, and the interaction where source designs support them;
10. only then generalize toward a manuscript Claim Ledger / Figure Builder.

The laboratory should make **counterfactual genealogy, semantic measurement, and evidential provenance legible** — not merely make prompting convenient.
