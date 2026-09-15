# Message lineage + instance identity design note — 15 Sep 2026

## Why this exists

February Blum established a strong traceability rule: **every datum has a UID**, maximum-detail ground truth is retained, and foveation/projection happens at read time rather than by deleting the underlying evidence.

EXP-003's September observation index had strong observation/trunk/snapshot provenance but no first-class identity for individual model-visible messages or generated outputs. The portable projection then removed repeated `modelVisibleMessages` arrays entirely. This made elementary questions such as “what was the first message to every model instance, and did anything come after it?” depend on witness archaeology.

This note freezes the correction.

## Council disagreements that changed the design

### 1. Content identity is not event identity

**Rejected:** use message text/content hash as the message UID.

Two independently administered prompts may have byte-identical text while remaining distinct experimental events.

Therefore:

- `messageUid` = datum/event identity;
- `contentHash` = textual identity;
- equal `contentHash` does not imply equal `messageUid`.

### 2. Historical labels are not instance identities

`parentSnapshotId` is content-addressed from the exact sent prefix, so two independent treatments with identical prefixes can share a snapshot hash.

`trunkKey` is a historical label, not a globally unique treatment instance. The pinned corpus reuses labels such as `CP-r1`, `F-r1`, and `H-r1` across raw collections with genuinely different treatment openings.

The pre-existing field named `trunkInstanceId` is not sufficient either: the raw adapter derives it from `{ trunkKey }`, so it inherits the same collision. Cold calls had the same problem: `C-r1-N4`, `C-r1-A1`, etc. were all being assigned a pseudo-instance identity derived only from `C-r1`, even though they are independent subject calls.

**Rejected:** treating replicate/trunk labels as model-instance IDs.

### 3. Do not infer ancestry from matching strings

A graph edge is a scientific claim about lineage, not a compression trick.

Text equality may support content comparison but never establishes conversational ancestry. Shared ancestor identity is admitted only from existing lineage evidence.

### 4. There are two useful identity levels

The corpus needs both:

1. **message / datum identity** — exact model-visible inputs and outputs;
2. **model-instance / trajectory identity** — the conversational root, trunk, or branch in which those messages occur.

These must not be confused with analysis groupings such as family, replicate, condition, or battery item.

## Primary instance ontology

For the question “what was the first message to every instance, and are there later input-output pairs?” the primary object is now `instanceStartCensus`.

### Root lived trunk

One developmental conversation per collection + trunk lineage. Raw2+ trunk turns are stored as separate call files, but their successively growing `sent` contexts belong to one lived conversation instance.

```text
instanceKind = root_lived_trunk
firstInput
firstOutput
ioPairCount
hasFurtherInputOutputPairs
downstreamInputOutputPairCount
parentInstanceUid = null
```

### Root single call

Every cold or cold-schema subject call is its **own** model instance.

`C-r1` is a replicate grouping, not an instance. For example, raw7 contains:

```text
C: r1-r10 × 25 battery items = 250 independent model instances
C-r1: 25 independent model instances
```

Each normally has:

```text
instanceKind = root_single_call
ioPairCount = 1
hasFurtherInputOutputPairs = false
parentInstanceUid = null
```

“Cold” therefore means **no inherited lived parent**. It does not mean “no first turn,” “not applicable,” or “one multi-question C conversation.”

### Branch instance

Every branch observation is its own forked model instance/trajectory. Its model-visible trajectory retains the inherited trunk prefix plus its branch input/output.

```text
instanceKind = branch_from_lived_trunk
parentInstanceUid = lived trunk instance when mechanically joinable
inheritedPrefixMessageCount
ioPairCount
hasFurtherInputOutputPairs
```

### Pilot 1

Pilot 1 uses session-event JSONL rather than one-file-per-call storage. `record.json` reconstructs the dialogue.

Crucially, the two ASb branch records are **not first-turn roots**:

```text
ASb-r1-N9.raw.jsonl -> parent_trunk = AS-r1-trunk.raw.jsonl
ASb-r2-N9.raw.jsonl -> parent_trunk = AS-r2-trunk.raw.jsonl
```

The instance census joins those explicit parent links. Each AS trunk is a five-pair developmental instance; each ASb branch trajectory contains those five inherited pairs plus its N9 branch pair, for six complete pairs total.

The older treatment-origin query still reports these Pilot-1 rows as incomplete **within the stripped normalized battery-row projection**. That is a limitation of that secondary projection, not a corpus-level uncertainty about whether the ASb files were first turns.

## Pinned instance-start census

On the pinned EXP-003 corpus:

- **2,420 actual model instances / trajectories**;
- **1,750** have further complete input-output pairs downstream of the first pair;
- **670** do not;
- **0** instances are missing a first input.

By instance kind:

- **42** `root_lived_trunk`;
- **670** `root_single_call`;
- **1,708** `branch_from_lived_trunk`.

By ancestry metadata:

- 2 `pilot1_lived_trunk`;
- 40 `lived_trunk`;
- 320 `cold_no_lived_parent`;
- 350 `cold_schema_no_lived_parent`;
- 2 `pilot1_lived_trunk_branch`;
- 1,706 `lived_trunk_branch`.

Hard examples:

- raw7 `C` = **250 independent instances**;
- raw7 `C-r1` = **25 independent one-pair instances**;
- Pilot 1 = **2 five-pair AS trunks**;
- Pilot 1 ASb = **2 six-pair branch trajectories with explicit parent-trunk joins**.

## Secondary treatment-origin view

The older `dae-first-treatment-prompts` query answers a narrower question: whether a normalized battery observation itself contains enough mechanically verified evidence to certify a lived developmental origin.

Its grouping-level census remains useful for provenance diagnostics, but it is **not** the primary answer to “what is the first turn of every model instance?” In particular:

- cold groups being `no_lived_parent_by_design` does not make their first input non-applicable;
- Pilot-1 branch rows being incomplete in that projection does not make the underlying branch trajectories historically unresolved;
- replicate labels that produce multiple first inputs are grouping labels, not failed instance identities.

## Message lineage layer

For verified lived-prefix evidence:

```text
treatmentInstanceId = hash(collection + trunkKey + verified parentSnapshotId)
```

and message identity retains the event/content distinction:

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

The pinned normalized observation graph currently has:

- **2,378** addressable battery observations;
- **2,028** in the historical non-cold-schema projection;
- **7,889** addressable message/output nodes;
- **2,378 / 2,378** indexed model-visible contexts reconstructing exactly from UID references.

Observation population and instance population are deliberately different objects.

## Portable means scientifically inspectable

Portable v1 may omit repeated per-observation `modelVisibleMessages` arrays only because their complete content remains UID-addressable in `messageGraph`.

It now also ships `instanceStartCensus`, so offline inspection can directly ask:

```text
instanceUid
collection
family
replicate
probeId
instanceKind
firstInput
firstOutput
ioPairCount
hasFurtherInputOutputPairs
downstreamInputOutputPairCount
parentInstanceUid
```

without opening the full witness tree.

The full-witness bundle remains the byte-level reconstruction/audit artifact. The portable bundle is allowed to normalize representation, not delete the intervention or the instance topology.

## Hard regressions

The implementation is not green unless all hold:

1. independently administered identical prompts remain distinct events;
2. verified sibling prefixes reuse ancestor message UIDs only when lineage evidence warrants it;
3. every indexed model-visible observation reconstructs exactly;
4. every generated indexed output is addressable;
5. every instance in the instance census has a first input;
6. raw7 C contains 250 independent instances and C-r1 contains 25;
7. Pilot-1 AS contains two five-pair trunks;
8. Pilot-1 ASb contains two six-pair branch trajectories joined to their explicit parent trunks;
9. replicate/trunk labels are never silently promoted to model-instance identity;
10. portable-analysis preserves both the message graph and the complete instance-start census offline.

## Next extension

February Blum's phrase was **every datum**, not merely every message. Parsed response surfaces (`reply`, `reflection`, `debate`, `deliberation`, revisions, adjudication evidence spans) should next receive deterministic derived-datum identities linked back to their source output message rather than becoming another parallel identity system.
