# Message lineage UID design note — 15 Sep 2026

## Why this exists

February Blum established a strong traceability rule: **every datum has a UID**, maximum-detail ground truth is retained, and foveation/projection happens at read time rather than by deleting the underlying evidence.

EXP-003's September observation index had strong observation/trunk/snapshot provenance but no first-class identity for individual model-visible messages or generated outputs. The portable projection then removed repeated `modelVisibleMessages` arrays entirely. This made scientifically elementary questions such as “what was the first treatment prompt of each trunk?” depend on witness archaeology.

This note freezes the correction.

## Council disagreements that changed the design

### 1. Content identity is not event identity

**Rejected:** use message text/content hash as the message UID.

Two independently administered prompts may have byte-identical text while remaining distinct experimental events.

Therefore:

- `messageUid` = datum/event identity;
- `contentHash` = textual identity;
- equal `contentHash` does not imply equal `messageUid`.

### 2. Neither `parentSnapshotId` nor `trunkKey` is sufficient event identity

September `parentSnapshotId` is content-addressed from the exact sent prefix. Two independent treatments with identical prefixes can therefore have the same snapshot hash.

`trunkKey` is also a historical label, not a globally unique treatment instance. The pinned corpus reuses labels such as `CP-r1`, `F-r1`, and `H-r1` across raw collections with genuinely different treatment openings.

The pre-existing field named `trunkInstanceId` is not sufficient either: the raw adapter derives it from `{ trunkKey }`, so it inherits the same cross-collection collision.

**Rejected:**

- `parentSnapshotId + ordinal` as a shared-message UID;
- `trunkKey + parentSnapshotId + ordinal` as a globally shared-message UID;
- trusting the old `trunkInstanceId` name without inspecting its constructor.

A verified lived-prefix event now has an explicit:

```text
treatmentInstanceId = hash(collection + trunkKey + verified parentSnapshotId)
```

A shared-prefix message is identified within that treatment instance by:

```text
treatmentInstanceId + ordinal (+ role)
```

This means:

- same verified treatment instance → same ancestor message UIDs;
- same trunk label reused in another collection → different treatment instance and different message UIDs;
- different treatment instances with identical words → different message UIDs, equal content hashes;
- branch-specific suffixes → different event UIDs.

### 3. Do not infer ancestry from matching strings

A graph edge is a scientific claim about lineage, not a compression trick.

Text equality may support content comparison but never establishes conversational ancestry. Shared ancestor identity is admitted only from existing verified lineage evidence.

### 4. Corpus identity and analysis population are different objects

The pinned current whole-corpus builder admits **2,378** addressable observations:

- `cold_no_lived_parent`: 320
- `pilot1_lived_trunk_branch`: 2
- `lived_trunk_branch`: 1,706
- `cold_schema_no_lived_parent`: 350

The familiar **2,028** population is exactly the projection excluding the 350 cold-schema/no-lived-parent observations.

Therefore:

- UID/addressability covers all admitted corpus observations;
- a battery analysis may freeze a narrower population;
- no single observation count may silently stand for both corpus identity and a claim-specific denominator.

### 5. “First user message” is not automatically “first treatment prompt”

Pilot 1's normalized battery rows do not preserve the full lived prefix. Cold observations have no lived parent by design. Reused `trunkKey` labels may denote different treatment instances across collections.

**Rejected:** return the first user message visible in any row and label it the treatment origin, or group treatment origins globally by `trunkKey`.

The strict first-treatment query:

- resolves only from a complete mechanically verified lived prefix;
- groups verified evidence by `treatmentInstanceId`;
- returns weaker provenance as `unresolved` rather than guessing;
- retains the old trunk-label helper only as a convenience surface that is allowed to expose reused-label conflicts.

Pinned real-corpus result at this design revision:

- **114** treatment-instance / unresolved groups;
- **59 resolved** treatment instances;
- **55 unresolved** weaker-provenance groups;
- **0 conflicts** inside verified treatment instances;
- **2 Pilot 1 groups explicitly unresolved**.

### 6. Portable means self-sufficient for ordinary scientific inspection

The portable bundle may omit repeated per-observation `modelVisibleMessages` arrays **only if**:

- each row retains message UID references;
- every reference dereferences offline;
- complete prompt/output content remains in the UID graph;
- first-treatment queries work without opening the archived witness tree.

Portable bundle v1 implements that rule as a wrapper around the frozen v0 builder. It preserves the existing v0 build path, then injects the canonical message graph, ships deterministic graph/treatment readers, updates population bookkeeping, and re-hashes the manifest.

The full-witness bundle remains the byte-level reconstruction/audit artifact. The portable bundle is allowed to normalize representation, not delete the experimental stimulus.

## Current objects

### Treatment instance

```text
treatmentInstanceId
collection
trunkKey
parentSnapshotId
```

### Message node

```text
messageUid
role
content
contentHash
parentMessageUid
datumRole
identityClass
ordinal
collection
trunkKey
treatmentInstanceId
parentSnapshotId
sourceObservationId
```

### Observation references

```text
observationId
modelVisibleMessageIds[]
inputMessageId
outputMessageId
systemMessageId
parentPrefixLen
treatmentInstanceId
```

### Index extension

```text
messageGraph
messageLineage
```

## Pinned corpus regressions

At the current identity semantics the pinned corpus has:

- **2,378** addressable observations;
- **2,028** observations in the historical non-cold-schema projection;
- **7,889** addressable message/output nodes;
- **1,706** verified lived-prefix rows;
- **2,378 / 2,378** model-visible contexts reconstructing exactly from UID references.

The old trunk-label convenience surface deliberately exposes reused labels: at the current revision it finds **34 explicit reused-label conflicts**. That is not a graph failure; it is evidence that a label is not an instance identity.

## Hard regressions

The implementation is not green unless all hold:

1. independently administered identical prompts have different event UIDs and equal content hashes;
2. verified siblings within one treatment instance reuse the same ancestor UIDs;
3. same label/snapshot/text in a different collection remains a distinct treatment event;
4. every indexed model-visible context reconstructs exactly from UID references;
5. every generated output has an addressable UID;
6. no message UID collision can hide conflicting role/content/parentage;
7. the pinned current corpus distinction remains explicit: 2,378 addressable vs 2,028 non-cold-schema;
8. strict first-treatment prompt queries do not guess from Pilot 1/cold/local-probe evidence and have zero conflicts within verified treatment instances;
9. portable-analysis may omit repeated arrays only while complete message/output content remains dereferenceable offline;
10. the strict treatment query must run against the portable bundle alone.

## Next extension

February Blum's phrase was **every datum**, not merely every message. Once this layer is stable, parsed response surfaces (`reply`, `reflection`, `debate`, `deliberation`, revisions, adjudication evidence spans) should receive deterministic derived-datum identities linked back to their source output message rather than becoming another parallel identity system.
