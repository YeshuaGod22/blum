# Inference package + trajectory identity design note — 15 Sep 2026

## Core correction

February Blum established the invariant: **every scientific datum is addressable, provenance survives normalization, and compression happens at read/distribution time rather than by deleting evidence.**

The September EXP-003 work initially restored identity at the individual-message level. That was useful but still one layer too low. The experimentally administered unit is the **complete package sent to inference**.

The canonical hierarchy is now:

```text
CALL
  callUid
    |
    +--> INPUT PACKAGE
    |      inputPackageUid
    |      package content hash
    |      ordered section/event refs
    |
    +--> OUTPUT PACKAGE
           outputPackageUid
           raw-output content hash
           optional parsed section/event refs

TRAJECTORY
  instanceUid
  ordered owned callUids[]
  parent trajectory relation when applicable
```

System framing, prior conversation, and the current user input are subdivisions of one input package. `<reply>`, `<reflection>`, `<debate>`, etc. are subdivisions of one output package. Sections are addressable second-layer objects, not peers of the package they belong to.

Frozen raw witnesses remain authoritative for exact provider serialization. The retrospective normalized package layer reconstructs the canonical structured inference input retained by the importer: system framing plus ordered model-visible messages.

## Identity rules

### Event identity != content identity

Two independently administered calls may receive byte/text-identical packages and remain different experimental events.

```text
callUid          = one administered inference event
inputPackageUid  = this input-package event
outputPackageUid = this output-package event
contentHash      = normalized content identity
```

Equal content hashes never imply equal event UIDs.

The same principle applies to sections. A repeated user/history fragment can occur as a section event in many packages while its text is stored once by content hash in the portable projection.

### Historical labels are not identities

`trunkKey`, replicate labels such as `C-r1`, and the older field named `trunkInstanceId` are analysis/provenance labels, not globally unique inference or trajectory identities.

Concrete correction:

```text
raw7 C    = 250 independent one-call trajectories
raw7 C-r1 = 25 independent one-call trajectories
```

The 25 calls may share condition/replicate metadata. They do not thereby become one conversation or one inference event.

## Package sections

An input package is represented canonically as:

```text
InputPackage
  inputPackageUid
  callUid
  contentHash
  ordered sectionUids[]

InputSection
  sectionUid
  packageUid
  sectionType = system | message
  role = system | user | assistant | ...
  ordinal
  contentHash
```

The package is the scientific intervention unit. Sections answer second-layer questions such as “what was the current user prompt?” or “what prior assistant response was present?”.

An output package is parallel:

```text
OutputPackage
  outputPackageUid
  callUid
  raw-output contentHash
  sectionUids[]
  callOutcome
  stopReason

OutputSection
  sectionUid
  packageUid
  tag = reply | reflection | debate | deliberation | ...
  ordinal
  contentHash
  integrity
```

The raw output remains primary. Parsed XML-ish sections are derived subdivisions and never replace it.

## Trajectory semantics

A trajectory is an experimental conversational lineage made of **administered calls**, not a count of user/assistant-looking messages visible inside one package.

### Root lived trunk

A lived trunk owns multiple inference calls:

```text
call 1: inputPackage_1 -> outputPackage_1
call 2: inputPackage_2 -> outputPackage_2
...
```

Later input packages contain the growing conversational history, but trajectory depth counts calls, not the number of messages copied into those packages.

### Root single call

Cold/cold-schema observations are ordinary one-call root trajectories:

```text
callCount = 1
hasFurtherInferenceCalls = false
```

“Cold” means no inherited lived parent. It says nothing exotic about the existence of a first inference package.

### Branch call

A branch is normally a new inference call whose input package contains inherited conversational history.

Crucial distinction:

```text
branch callCount                         = 1
branch downstreamInferenceCallCount      = 0
branch visibleContextExchangePairCount   = potentially many
parent trajectory calls                  = ancestry reference
```

Inherited history is content inside the branch input package. It is not silently reclassified as calls owned by the branch trajectory.

Pilot 1 makes the distinction concrete. `record.json` explicitly links:

```text
ASb-r1-N9.raw.jsonl -> AS-r1-trunk.raw.jsonl
ASb-r2-N9.raw.jsonl -> AS-r2-trunk.raw.jsonl
```

Each AS trunk owns 5 inference calls. Each ASb branch owns 1 inference call whose input package contains those 5 prior exchanges plus N9. Thus an ASb package exposes 6 visible exchange pairs while the ASb trajectory itself has only 1 inference call.

## Pinned corpus census

Against DAE commit `e2d484b41461013832c00e9f1ba3549ac0ef2517`:

### Inference events

- **2,659 calls**
- **2,659 input packages**
- **2,659 output packages**
- **38,222 section events** in the current canonical section projection

Call source classes:

```text
raw2_plus_branch     1706
raw2_plus_cold        662
raw2_plus_trunk       271
pilot1_trunk_turn      10
pilot1_branch_call      2
pilot1_cold_call        8
```

Every call owns exactly one input package and one output package. Every call is owned by exactly one trajectory.

### Trajectories

- **2,420 trajectories**
- **42** own more than one inference call
- **2,378** are one-call trajectories
- **2,420 / 2,420** are bound to package-bearing calls

By trajectory kind:

```text
root_lived_trunk         42
root_single_call        670
branch_from_lived_trunk 1708
```

The earlier statistic that 1,750 instances had “further input-output pairs” described user/assistant-shaped exchanges visible in reconstructed context. It is retained only as a compatibility/context measurement. It must not be reported as inference-call depth.

## Observation/message compatibility projection

The existing normalized observation/message graph remains useful for old queries and exact reconstruction of the battery-observation layer:

- 2,378 addressable normalized observations
- 2,028 in the historical non-cold-schema projection
- 7,889 message/output nodes
- 2,378 / 2,378 model-visible observation contexts reconstruct exactly

This is now explicitly a compatibility/projection layer beneath the package ontology, not the definition of an inference event.

The old treatment-origin query also remains as a secondary provenance diagnostic. Its “59 resolved / 53 not applicable / 2 incomplete” grouping census must not be confused with first-package or trajectory identity.

## Portable representation

The first package-first portable build exposed a useful failure: embedding the full package graph inside the whole-corpus index duplicated large amounts of text and hit `RangeError: Invalid string length`.

The fix follows the scientific ontology rather than raising memory limits.

Portable v1 now stores:

```text
dae-whole-corpus-index-v1.json
  -> lightweight inferencePackageGraphRef

dae-inference-package-graph-v0.json
  calls
  input-package events
  output-package events
  section events
  contentStore[contentHash] = text
```

Package/section event objects retain UIDs and content hashes. Repeated text is stored once in the content-addressed store. Packages can be reconstructed deterministically from ordered section refs plus that store.

Pinned portable result:

- 2,659 calls / input packages / output packages
- 38,222 section events
- **8,101 unique content blobs**
- all package refs reconstruct offline
- all 2,420 trajectories retain first call/package refs offline
- raw7 C-r1 remains 25 distinct input-package events
- both Pilot ASb branches reconstruct inherited history while remaining one-call trajectories

The full-witness bundle remains the byte/provider-level audit artifact. Portable normalization changes representation, not evidence.

## Hard regressions

The implementation is not green unless all of these hold:

1. every administered call owns exactly one input package and one output package;
2. every call is owned by exactly one trajectory;
3. every trajectory binds to at least one package-bearing call;
4. independent identical packages retain different event UIDs;
5. system framing is a section of the input package, not a peer inference unit;
6. output sections are subordinate to the complete raw output package;
7. raw7 C-r1 contains 25 distinct one-call/input-package events;
8. Pilot AS trunks contain five inference calls each;
9. Pilot ASb branches contain one inference call each, six visible context pairs, and explicit parent-trajectory ancestry;
10. inherited conversational context never inflates branch inference-call depth;
11. portable package content reconstructs from section refs + content store;
12. the portable whole index references rather than duplicates the standalone package graph;
13. the compatibility 2,378-observation message graph still reconstructs every indexed observation exactly.

CI currently passes the full chain including the compact portable package bundle.

## Next critique targets

The package ontology resolves the unit-of-inference problem, but several stronger provenance tests remain desirable:

1. **Trunk extension proof.** Verify mechanically that each successive trunk call's input package extends the previous trajectory state rather than selecting a terminal call merely by turn/order heuristics.
2. **Parent relation proof.** For raw2+ branches, validate parent-trajectory relations against exact inherited package/prefix evidence rather than relying only on `trunkKey` correspondence.
3. **Outcome-aware depth.** Distinguish administered calls from successful/complete/truncated/failed calls using the already-preserved `callOutcome` and `stopReason`.
4. **Measurement linkage.** Attach measurements/adjudications to output package/section UIDs rather than creating another independent identity universe.

Target chain:

```text
CALL
 -> INPUT PACKAGE
 -> OUTPUT PACKAGE
 -> OUTPUT SECTION (when useful)
 -> MEASUREMENT
 -> ADJUDICATION
 -> CLAIM
```

Everything downstream should point back into this one provenance spine.
