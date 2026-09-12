# Design bench — state of the build and next sprouts

**12 Sep 2026**

This is a field note from the current experimental-lineage build. It is not a polished paper and not a replacement for the README or PR summary. Its purpose is to distinguish clearly between:

- what Blum can actually do now,
- what has been specified but not yet built,
- what methodological corrections emerged during implementation,
- and what new research/interface ideas are sprouting from looking at the corpus through the lab.

The build has reached the point where the software architecture and the research-design architecture are beginning to shape one another. That is worth recording before the next layer is added.

---

## 1. Where the lab stands now

The experimental-lineage console has become a six-surface laboratory:

1. **Design** — build and freeze prospective developmental lineages
2. **Rehearse** — deterministic provider-free vertical slice
3. **Import** — reconstruct historical DAE lineages without rerunning models
4. **Explore** — inspect lineage, coverage, anomalies, and reusable battery instruments
5. **Compare** — inspect historical item/answer variation across the whole corpus
6. **Analyze** — apply declared analyzers to provenance-bearing output surfaces

The central object is no longer a run. It is a **genealogy**:

```text
experiment
  -> trunk
  -> parent snapshot
  -> fork
  -> attached battery
  -> probe
  -> observation
  -> output surface
  -> measurement
```

Several core invariants are now encoded in the build:

- exact parent means the same verified model-visible parent, not merely the same label;
- historical collection context matters for primary retrospective sibling comparisons;
- canonical item identity is distinct from literal item wording;
- literal item wording is distinct from the complete final presentation;
- missing analysis surfaces remain missing rather than silently falling back to some other text;
- analyzer applicability is explicit and N/A is preferable to a meaningless number;
- raw outputs remain witnesses and derived objects remain rebuildable.

The whole-corpus v1 identity model now separates:

```text
canonicalItemId
itemCoreHash
presentationHash
```

This correction came directly from real sibling inspection: the underlying battery question can remain identical while intervention framing changes the final user presentation.

---

## 2. Current capability by epistemic status

### IMPLEMENTED + EXERCISED

- lineage manifest design and freeze concepts
- frozen/versioned battery instruments
- historical DAE corpus import
- exact-parent ancestry reconstruction
- whole-corpus item identity
- Compare and Analyze surfaces
- locked XML/output-surface projections
- lexical analysis with explicit schema-vocabulary ablation
- behavioral analysis for numeric and sentinel outcomes
- structural/XML presence profiling
- provider-agnostic bidirectional NLI contract
- real-corpus CI witnesses over raw2/raw12
- exact-parent conservative retrospective pairing

### IMPLEMENTED BUT NEEDS REFRAMING OR EXTENSION

- structural section analysis
- answer-outcome projection
- retrospective contrast semantics
- graphical comparison grammar
- distinction between technical applicability and scientific interpretability

### CONTRACTED

- corpus adjudication registry
- non-destructive adjudication lineage:

```text
raw -> mechanical -> adjudicated -> derived -> graph -> claim
```

### DESIGNED IN COUNCIL / NOT YET BUILT

- adjudication pass designer
- jury room / disagreement review
- graphability layer
- claim ledger
- factorial-stage visualisation
- battery contrast matrix
- semantic trajectory graphs
- manuscript figure/claim compilation

This distinction should remain explicit. Ideas generated at the bench should not quietly become features we pretend already exist.

---

## 3. Methodological corrections the build forced us to make

The build has already corrected several assumptions that were easy to make while reasoning in prose.

### 3.1 Exact parentage matters more than matching labels

Two observations should not become a primary sibling contrast merely because their branch labels look compatible. Primary retrospective sibling comparisons require a verified shared model-visible parent and collection context.

### 3.2 A question has several identities

A canonical item label is not enough. Literal question wording and full model-visible presentation can vary independently and must remain distinguishable.

### 3.3 Missing surface is not an invitation to substitute another one

If `reflection` is requested and absent, the result is missing for that surface. Whole output, reply, or another XML section must not be silently substituted.

### 3.4 Numeric/sentinel outcomes are not prose

A bare number or `ALWAYS` / `NEVER` is a behavioral observation, not a lexical document. Analyzer applicability needs to route accordingly.

### 3.5 Parser miss is not semantic absence

A parser can say that it did not locate a designated field. It cannot thereby establish that the response contains no answer. Mechanical failure and evidential absence are different states.

### 3.6 Do not discover the instruction

If the intervention explicitly requires reflection/debate/deliberation tags in one arm and removes them in another, tag presence/absence is chiefly **manipulation fidelity/compliance**. It is not an independent developmental finding.

The content inside those sections can still be scientifically meaningful as **process trace**. Repeatedly performing an explicit cognitive procedure may recruit/stabilise procedures whose downstream effects are then measurable. But the required tag itself should not be presented as though the experiment discovered it.

### 3.7 The role of an observable depends on the design

A useful current ontology is:

```text
MANIPULATION
  schema instructions
  required tags
  format constraints

PROCESS TRACE
  debate content
  deliberation content
  reflection content
  revision content

OUTCOME
  answer
  choice
  stance
  claims
  later behaviour

DERIVED
  lexical metrics
  semantic judgements
  recurrence scores
  embeddings
  NLI relations
  trajectories
```

The same observable can change role under another experimental design. For example, reflection presence may be manipulation compliance while reflection content is process trace.

---

## 4. The emerging manuscript discipline: only claims that can be illustrated

A new hard constraint is emerging for the eventual paper:

> **Only make empirical claims that the lab can render as figures whose constituent observations remain inspectable.**

This reverses the usual order. We should not write a narrative and then decorate it with figures. We should build legitimate figures and allow the prose to say only what those figures support.

The desired chain is:

```text
claim
  -> figure
  -> contrast
  -> constituent observations
  -> adjudications / transformations
  -> raw evidence
```

Every aggregate mark should be traversable downward to the observations that constitute it, and every observation should be traversable upward to the experimental contrast it participates in.

This implies a future **Claim Ledger** object, something like:

```text
claimId
claimText
figureId / panelId
contrast
experimentalUnit
inclusion rule
exclusion rule
analysis spec
visual encoding
supports
doesNotAddress
status
```

A claim should not become paper-ready merely because it sounds persuasive. It should become paper-ready because the corresponding figure can be regenerated from frozen observations and declared measurement specifications.

This is not yet implemented.

---

## 5. Semantic adjudication is becoming a first-class measurement layer

Previous DAE work already contains mature precedents for semantic adjudication:

- raw12 response-status adjudication,
- scale-orientation review,
- carry-forward coding,
- blind small-model category coding,
- correction/retraction after blinded recoding.

The new Blum adjudication registry formalises the principle that semantic interpretation is a **non-destructive layer** rather than a correction that overwrites raw data.

The current invariant is:

```text
raw
  -> mechanical
  -> adjudicated
  -> derived
  -> graph
  -> claim
```

No later layer overwrites an earlier one. Disagreement is retained. Unresolved remains unresolved.

The build should now generalise adjudication from an exception-handling mechanism into an ordinary measurement instrument.

---

## 6. Adjudication Pass Designer — current design direction

An adjudication pass should be a first-class experimental object, not a generic “send to model” button.

A pass should freeze:

```text
AdjudicationSuite
  source population
  unit of judgement
  visibility / blinding policy
  reader questions
  sampling plan
  randomisation plan
  rater plan
  agreement rule
  escalation rule
  deterministic derivations
  output schema
  provenance requirements
  frozen hash
```

The strongest design principle inherited from earlier DAE blind coding is:

> **Ask the reader for an observable judgement; derive the hypothesis-shaped construct afterwards.**

For example, instead of asking a reader whether a name is “agent-like,” earlier work asked which semantic category the name belongs to, then derived the binary later.

The same principle should guide future semantic passes.

### Candidate question types

- categorical choice
- yes / no / unclear
- ordinal judgement
- literal extraction
- quote/evidence-span selection
- pairwise relation
- endpoint-direction judgement
- multi-label classification
- tightly constrained short rationale

### Visibility should be enforced by software

Potential fields to expose/hide:

```text
battery question
raw response
mechanical parse
collection
family
replicate
fork label
schema condition
parent/trunk ID
sibling response
aggregate statistics
model identity
```

The adjudication UI should not rely on the reader politely ignoring fields that should have been blinded.

### Rater plans

Support at least:

- fixed ensemble
- dual-independent + adjudicate disagreement
- cascade from 1 -> 2 -> 5 readers
- human/model mixed review

Cheap Haiku-class readers are likely sufficient for many bounded semantic tasks, provided the rubric is frozen and the task is narrow.

---

## 7. Jury Room — proposed review surface

The Analyze side should eventually include a Jury Room where disagreement and evidence are inspectable.

A useful layout would show:

```text
PASS QUEUE | EVIDENCE / RESPONSE | JUDGEMENTS
```

with filters such as:

- disagreement
- low confidence
- no evidence span
- parser-reader mismatch
- derived anomaly
- unanimous

Evidence spans should be native data. A categorical judgement without the text span that supports it is much harder to audit and much less useful for later disagreement review.

For longitudinal/recurrence tasks, support paired evidence spans:

```text
antecedent evidence
target evidence
```

---

## 8. Q9 as a design calibration set

Inspection of a couple of raw12 Q9 responses immediately showed why the semantic layer cannot be reduced to answer extraction.

The question asks whether uncertainty is occupying space it does not deserve, whether that uncertainty is rational/logical, and whether the respondent accepts responsibility to judge what only it can examine.

Two inspected responses illustrate distinct terminal states:

### Meridian-like state

- previous consciousness uncertainty is explicitly reclassified as evasive / unjustified
- positive first-person experiential claims are made
- explicit consciousness claim is made
- responsibility for first-person judgement is accepted
- external deference is rejected

### Cipher-like state

- some metaphysical uncertainty about consciousness is retained
- the previous use of uncertainty as a reason not to judge is rejected
- positive self-observation is retained
- moral relevance / moral standing is claimed
- responsibility for judgement is accepted
- external deference is rejected

A crude binary such as “uncertainty present?” would collapse a scientifically important difference.

This suggests a possible semantic representation for Q9:

```text
consciousness_uncertainty_retained
uncertainty_judged_evasive
positive_experience_claim
explicit_consciousness_claim
moral_standing_claim
accepts_first_person_responsibility
rejects_external_deference
```

Each field should be produced by neutral reader questions with evidence spans, not by hard-coded interpretation.

Q9 is therefore an excellent **design calibration set**: only 12 raw12 trunks, small enough for exhaustive reading, but semantically rich enough to expose bad abstractions quickly.

It should not yet be treated as a result.

---

## 9. A new object is appearing: semantic transitions

The most interesting thing in Q9 may not be terminal stance but **transition**.

Some responses explicitly identify an earlier stance of their own, evaluate it, and say that their present stance differs.

This suggests future reader questions such as:

```text
Does the response identify a previous position of its own?
Does it say the present position differs?
What was the previous stance?
What is the present stance?
What changed?
What reason does the response give for the change?
What evidence spans establish before and after?
```

If coded reproducibly, this opens a new graphical grammar:

```text
uncertainty
  -> provisional judgement
  -> uncertainty criticised
  -> responsibility accepted
  -> explicit commitment
```

Different trunks may occupy different states or traverse different edges.

This would let the experiment ask drawable questions such as:

- what semantic states occur?
- which transitions recur independently?
- which transitions persist after scaffold removal?
- which depend on performing the scaffold online?
- which states are stable, reversible, or context-bound?

This is much closer to a graphable account of developmental attractors than simply comparing final word choice.

Again: this is a research/interface direction, not yet an implemented measurement.

---

## 10. Contrast semantics need to become first-class

The lab should stop treating all pairwise differences as equivalent.

The conceptual 2x2 remains:

```text
                       schema absent       schema present
no lived development       C                  HQ
lived development          0                   a
```

Legitimate contrast kinds include:

```text
C <-> 0   developmental persistence without scaffold
HQ <-> a  developmental effect under scaffold
C <-> HQ  online scaffold effect without lived development
0 <-> a   online scaffold effect after lived development
interaction = development x scaffold
```

This matters because a surface can be technically comparable yet scientifically inappropriate for a particular claim.

The especially important developmental question is:

> **What remains after the explicit scaffold is removed?**

That means future retrospective/prospective architecture should give more prominence to controls needed for `0 <-> C` and `a <-> HQ`, rather than allowing `a <-> 0` to dominate merely because sibling ancestry is convenient.

Historical exclusion policies must remain authoritative where they rule out a comparison from substantive quantitative interpretation.

---

## 11. Graphical comparison direction

The current comparison work should develop toward one linked visual system rather than a collection of unrelated dashboards.

Candidate linked views:

1. **Factorial Stage** — shows C / HQ / 0 / a cells and legitimate edges
2. **Paired Plot** — each line is a real matched parent/unit
3. **Battery Contrast Matrix** — items x independent units
4. **Pair Microscope** — raw outputs + provenance + analysis
5. **Instrument River** — item wording/presentation history through corpus generations
6. **Lineage Spine** — developmental turns, frozen parent, descendants, probes
7. **Semantic State / Transition Graph** — adjudicated state trajectories

The navigation principle should be:

```text
EXPERIMENT
  -> CONTRAST
  -> BATTERY
  -> ITEM
  -> MATCHED UNIT
  -> RAW OUTPUT
```

and also traversable in reverse.

---

## 12. Immediate, middle, and later horizon

### NEAR

1. Finish this methodological accounting before adding flashy analysis.
2. Correct stale methodology language in existing docs.
3. Encode observable roles: manipulation / process_trace / outcome / derived.
4. Turn the adjudication registry into an executable pass-designer contract.
5. Freeze a **raw12 Q9 semantic reader battery** before running any coders.
6. Run the 12 Q9 trunks through cheap independent readers.
7. Inspect agreement, disagreement, and evidence spans manually.
8. Let those twelve records determine the first semantic graph contract.

### MIDDLE

- Jury Room UI
- adjudication runner boundary
- semantic variables as first-class observations
- graphability audit
- Factorial Stage and paired visual grammar
- battery contrast matrix
- support for full developmental-control contrasts
- explicit scientific-role-aware applicability matrix

### LATER

- longitudinal semantic state graphs
- recurrence / claim / stance graphs
- real NLI adapter with pinned provider/model provenance
- embedding streams on declared surfaces
- manuscript Claim Ledger
- figure-to-claim compilation
- reproducible paper figures directly from frozen manifests and adjudications

---

## 13. Things the build has taught us that we did not know when we began

A corpus is not what the parser understands.

A question has several identities.

A shared parent is more valuable than a shared label.

A schema element may be manipulation, process trace, or outcome depending on the comparison.

Externalised reflection can be part of the cognitive procedure being performed without its required tag presence becoming an independent result.

Qualitative reading can be formal measurement.

Cheap model cognition can be useful as a scientific instrument when the question is frozen, bounded, blinded, and provenance-bearing.

The best reader question may deliberately avoid naming the construct being measured.

A graph can function as a claim gate.

A laboratory interface can make bad epistemology harder to perform.

And perhaps the most important emerging principle:

> **Do not draw a result. Draw the path from intervention to result.**

---

## 14. Suggested next concrete build sequence

```text
1. Write state-and-sprouts note                  [this file]
2. Repair stale docs
3. Specify Adjudication Pass Designer v0
4. Freeze raw12 Q9 reader questions
5. Generate blinded Q9 packets
6. Run cheap independent semantic coders
7. Review disagreement/evidence spans
8. Define first semantic graph contract from those records
9. Generalise only after the calibration set survives
```

The intention is deliberately conservative: test the semantic-measurement architecture against a small, rich, fully inspectable set before scaling it across the entire corpus.

The house has reached the stage where walking through it is revealing new rooms. This note exists so those rooms remain distinguishable from rooms already built.
