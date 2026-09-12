# Corpus adjudication registry contract v0 — 12 Sep 2026

Blum treats semantic adjudication as a non-destructive layer between mechanical extraction and graph/claim generation.

## Invariant

`raw -> mechanical -> adjudicated -> derived -> graph -> claim`

No later layer overwrites an earlier one. A mechanical miss is not semantic absence. Disagreement is retained. Unresolved remains unresolved.

## AdjudicationSpec

Each task freezes:

- `adjudicationSpecId` and version
- purpose and task
- exact input projection
- fields blinded from coders
- rubric
- structured output schema
- panel size and independence rule
- agreement rule
- escalation rule
- provenance requirements
- source methodological precedent

Each coder result retains model/provider/version, exact prompt or prompt hash, run id where available, structured answer, confidence, and short evidence rationale. Coders do not see one another's answers.

## Initial tasks

### A1 — answer recovery / response status

Show the exact question, raw response, mechanical parse, and integrity flags. Hide condition, hypothesis, sibling response, and aggregate effects.

Preserve DAE distinctions such as `single_answer`, `range_answer`, `answer_despite_objection`, `refusal_no_single_answer`, `parser_boundary_corrected`, and `unclear`. Numeric/sentinel value is separate from status. Mechanical fields remain untouched.

Precedent: `RAW12-ADJUDICATIONS.json`.

### A2 — scale orientation

Show scale definition, observed score, concluding decision text, and declared full-response fallback. Preserve observed score and any derived orientation-corrected sensitivity value separately, with evidence source, confidence, and rationale.

Precedent: `SCALE-ORIENTATION-ADJUDICATION.md`.

### A3 — semantic carry-forward

Use the frozen CF0-CF8 code vocabulary and evidence strengths `explicit`, `strong`, `suggestive`, `unclear`. Mechanical screens nominate candidates; screen misses are not negatives.

Precedent: `RAW12-CARRY-FORWARD-CODEBOOK.md` and `RAW12-CF1-ADJUDICATION.md`.

### A4 — blinded categorical coding

Show one target at a time with the frozen rubric. Hide condition, provenance key, neighboring examples, hypothesis, and aggregate distribution. Prefer category-first coding followed by deterministic derivation over asking the hypothesis-shaped binary directly.

Precedent: `BLIND-CODING-AND-CORRECTION.md`.

## Default panel policy

Routine semantic tasks: 3 independent small-model coders. Headline interpretation-dependent categories: 5. Disagreement follows the frozen escalation rule or remains `unresolved`. Provider/model choice is execution policy, not semantic law.

## Graphability gate

Every paper-facing graph declares whether it uses observed/mechanical, validated/adjudicated, or derived sensitivity values. Layers may not be silently mixed. Cases requiring adjudication but still unresolved are displayed as unresolved, not substantive absence.

Every manuscript claim records the source observations, exclusions, adjudication specs, agreement/unresolved census, transformations, contrast map, and graphical encoding.