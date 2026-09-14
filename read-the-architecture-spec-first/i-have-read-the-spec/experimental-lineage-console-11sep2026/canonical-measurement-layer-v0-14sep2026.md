# Canonical measurement layer v0 — 14 Sep 2026

## Purpose

Make the DAE corpus mechanically searchable without allowing downstream reports to reinterpret raw replies.

The canonical path is:

`raw witness -> observation index -> answer projection -> authorised mechanical parser -> adjudication when required -> canonical measurement row -> analysis / graph / claim`

No downstream report, graph, comparison, or UI may implement its own response parser.

## Invariants

1. **Witnesses are immutable.** Raw response text and source provenance remain unchanged.
2. **Mechanical and adjudicated values are separate fields.** Adjudication never overwrites the mechanical result.
3. **No parser fallback.** If an item/version has no authorised parser, the row is `parser_unregistered`; arbitrary-number recovery is forbidden.
4. **A mechanical miss is not semantic absence.** `unparsed`, `ambiguous`, and answer-projection failures are adjudication candidates, not zeros or missing observations.
5. **Unresolved remains visible.** A row cannot silently disappear because its answer needs semantic reading.
6. **Analysis consumes `usableValue`, never raw text.** `usableValue` is populated only from a valid mechanical parse or a locked adjudication result.
7. **Every value retains provenance.** Observation ID, item identity, source path, presentation/item hashes, parser identity, adjudication execution fingerprint, and evidence source are retained where available.
8. **Layer mixing is explicit.** Every query/report declares whether it is using mechanical, adjudicated, or resolved (`mechanical + adjudicated`) values.

## Canonical row

Each observed item response produces exactly one row:

```text
measurementId
observationId
collection
condition
family
replicate
forkId
trunkKey
itemId
itemCoreHash
presentationHash
sourcePath

answerProjectionStatus
answerSource

parserId
parserStatus
mechanicalValue
mechanicalKind
mechanicalEvidence

adjudicationStatus
adjudicationSpecId
adjudicationExecutionFingerprint
adjudicatedValue
adjudicatedKind
adjudicationEvidence

resolutionSource       # mechanical | adjudicated | null
usableValue
usableKind
measurementStatus      # resolved | adjudication_required | unresolved | empty | parser_unregistered
```

The complete dataset also carries a battery registry so queries can left-join registered items and expose `not_collected` cells rather than silently omitting them.

## Adjudication routing

Rows route to adjudication when any of the following is true:

- the answer projection reports `adjudication_required`;
- an authorised parser reports `unparsed` or `ambiguous` and the observation contains substantive output;
- the item declares a semantic adjudication requirement (for example threshold/sentinel semantics or scale orientation);
- an existing adjudication execution is incomplete, escalated, or unresolved.

Routing is declarative. The canonical layer records the requested `adjudicationSpecId`; it does not itself perform semantic judgement.

Initial reusable specs:

- answer recovery / response status (A1)
- scale orientation (A2)
- threshold/sentinel semantics
- semantic carry-forward (A3)
- blinded categorical coding (A4)

## Locked adjudication result

A result is eligible to populate `adjudicatedValue` only when it is tied to:

- a frozen adjudication spec/version;
- a frozen population/execution fingerprint;
- the exact unit/observation ID;
- a resolved consensus outcome (or explicit escalation result according to the frozen spec);
- reader provenance and evidence spans validated by the execution core.

Anything else remains `unresolved`.

## Query contract

### Show cohort C

Start from the battery registry, left-join canonical measurement rows for `condition = C`, and return every registered item with all replicate values and explicit unresolved/not-collected counts.

### raw12 versus C

Resolve the twelve raw12 lived trunks and their battery descendants from lineage metadata, select canonical `usableValue` rows, preserve fork/replicate identity, and compare against the registered C distribution. No reply inspection occurs in the report builder.

## Completion criterion

The corpus is **fully adjudicated for a declared analytical scope** when the adjudication queue for that scope is empty and every eligible observation is either:

- `resolved`, or
- explicitly classified by the frozen instrument as a substantive non-value outcome (for example refusal/no adopted answer) rather than being merely unparsed.

“Fully adjudicated” is always reported with the population snapshot and corpus fingerprint; it is never asserted globally without a frozen corpus-wide scope.
