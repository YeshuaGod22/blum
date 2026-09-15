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

### 2. `parentSnapshotId` is not sufficient event identity

September `parentSnapshotId` is content-addressed from the exact sent prefix. Two independent trunks with identical prefixes can therefore have the same snapshot hash.

**Rejected:** `parentSnapshotId + ordinal` as a shared-message UID.

A verified shared-prefix message is shared only when:

`trunkKey + verified parentSnapshotId + ordinal (+ role)` agree.

This means:

- same verified trunk prefix → same ancestor message UIDs;
- different trunks with identical words → different message UIDs, same content hashes;
- branch-specific suffixes → different event UIDs.

### 3. Do not infer ancestry from matching strings

A graph edge is a scientific claim about lineage, not a compression trick.

Text equality may support content deduplication but never establishes conversational ancestry. Shared ancestor identity is admitted only from existing verified lineage evidence.

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

Pilot 1's normalized battery rows do not preserve the full lived prefix. Cold observations have no lived parent by design.

**Rejected:** return the first user message visible in any row and label it the treatment origin.

The strict first-treatment query resolves only when a complete lived prefix is mechanically verified. Weaker provenance returns `unresolved`, not a guessed prompt.

### 6. Portable means self-sufficient for ordinary scientific inspection

The portable bundle may omit repeated per-observation `modelVisibleMessages` arrays **only if**:

- each row retains message UID references;
- every reference dereferences offline;
- complete prompt/output content remains in the UID graph;
- first-treatment queries work without opening the archived witness tree.

The full-witness bundle remains the byte-level reconstruction/audit artifact. The portable bundle is allowed to normalize representation, not delete the experimental stimulus.

## Current objects

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
trunkKey
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
```

### Index extension

```text
messageGraph
messageLineage
```

## Hard regressions

The implementation is not green unless all hold:

1. independently administered identical prompts have different event UIDs and equal content hashes;
2. verified shared-prefix siblings reuse the same ancestor UIDs;
3. every indexed model-visible context reconstructs exactly from UID references;
4. every generated output has an addressable UID;
5. no message UID collision can hide conflicting role/content/parentage;
6. the pinned current corpus distinction remains explicit: 2,378 addressable vs 2,028 non-cold-schema;
7. strict first-treatment prompt queries do not guess from Pilot 1/cold/local-probe evidence;
8. portable-analysis may omit repeated arrays only while complete message/output content remains dereferenceable offline.

## Next extension

February Blum's phrase was **every datum**, not merely every message. Once this layer is stable, parsed response surfaces (`reply`, `reflection`, `debate`, `deliberation`, revisions, adjudication evidence spans) should receive deterministic derived-datum identities linked back to their source output message rather than becoming another parallel identity system.
