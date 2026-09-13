# Design council — semantic neighbourhoods vs. the next EXP-003 bottleneck

**13 Sep 2026**

## Question

Should Blum now spend its next development cycle building a high-dimensional semantic-neighbourhood census for EXP-003, or is there a more valuable immediate use of time?

## Council seats

### Measurement validity

**Position:** do not put a new derived similarity layer ahead of unresolved coding semantics.

The raw12 exploratory CF2/CF3 read surfaced three cases whose prior CF1 labels may be wrong when the complete raw target response is inspected. Those labels affect the population definition for the already-frozen CF2/CF3 follow-up. Re-adjudicating CF1 therefore has higher immediate evidential value than adding another candidate-generation system.

### Adjudication architecture

**Position:** execute the adjudication spine before extending discovery machinery.

Blum already has a frozen 10-unit CF2/CF3 follow-up specification with three independent readers per unit, hidden condition/family/CF1 status, matched antecedent+target evidence, and explicit derivation rules. The shortest path to a stronger paper-facing result is to clean the three CF1 cases, then run this existing pass.

### Representation learning

**Position:** keep the semantic neighbourhood work; it is genuinely useful, but treat it as retrieval rather than evidence.

The Surface Atlas and Qwen/LocalMAP run demonstrate that the corpus can be represented semantically at span level. The scientifically stronger extension is not another 2-D visualisation but high-dimensional nearest-neighbour retrieval over lineage-constrained pairs. This could discover CF2/CF3 candidates that hand selection misses. It should not decide CF2/CF3 labels by itself.

### Falsification / red-team

**Position:** delaying adjudication in favour of semantic mining increases researcher degrees of freedom.

A large semantic search space makes it easy to find interesting-looking recurrences after the fact. That is useful for hypothesis generation, but dangerous if introduced before the narrower frozen claims are resolved. The current ten-case bridge population is more constrained and therefore more diagnostic.

### Manuscript / figure discipline

**Position:** prioritize the layer that most directly unlocks a traversable claim.

The existing claim chain is closer to completion for CF1 -> CF2/CF3 than for semantic neighbourhoods. A semantic-neighbourhood figure would still require downstream adjudication. The CF1 re-review and frozen CF2/CF3 panel can directly produce graphable adjudicated columns.

### Product / operator burden

**Position:** stop adding machinery until the existing path becomes easy to execute.

The Surface Atlas setup exposed real journey friction. The next engineering work should reduce friction around adjudication execution and evidence packets rather than add another local-model workflow that the operator must shepherd manually.

## Verdict

**Unanimous on ordering:** semantic neighbourhoods are valuable, but they are not the best immediate use of EXP-003 time.

### Recommended sequence

1. Re-adjudicate CF1 for `F0-r1-D1.json`, `F0-r3-D1.json`, and `AS0-r3-R2.json` using the complete raw target response.
2. Preserve prior CF1 codes as provenance; never overwrite them.
3. Freeze the re-review outcome.
4. Re-materialize the eligible CF2/CF3 population from the frozen CF1 layer.
5. Execute the already-frozen three-reader CF2/CF3 follow-up.
6. Only then build a semantic-neighbourhood census as a **candidate-retrieval layer** for broader CF2/CF3 discovery.

## Semantic-neighbourhood role when resumed

When resumed, the neighbourhood instrument should:

- operate in the original embedding space, not use 2-D LocalMAP coordinates as the measurement;
- enforce lineage/temporal admissibility before ranking pairs;
- keep condition hidden during candidate selection;
- distinguish retrieval score from adjudicated recurrence;
- output evidence-addressable candidate pairs for the existing Jury Room;
- record model, text policy, truncation, normalization, similarity metric, and corpus/span fingerprints;
- test robustness to at least one alternate embedding/projection configuration before any broad prevalence claim.

The Surface Atlas remains useful as an exploratory visual interface. It is not promoted to a measurement conclusion.

## Decision

**NEXT:** CF1 re-review pass.

**THEN:** execute frozen CF2/CF3 panel.

**PARKED, NOT REJECTED:** high-dimensional semantic-neighbourhood census.
