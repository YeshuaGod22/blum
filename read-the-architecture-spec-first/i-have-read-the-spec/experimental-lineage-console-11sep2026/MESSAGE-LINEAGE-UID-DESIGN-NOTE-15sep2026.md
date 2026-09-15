# Inference package + trajectory identity design note — 15 Sep 2026

## Core correction

February Blum established the invariant: **every scientific datum is addressable, provenance survives normalization, and compression happens at read/distribution time rather than by deleting evidence.**

The September EXP-003 work initially restored identity at the individual-message level. That was useful but one layer too low. The experimentally administered unit is the **complete package sent to inference**.

The canonical spine is now:

```text
TRAJECTORY
  instanceUid
  ordered owned callUids[]

  CALL
    callUid
      -> INPUT PACKAGE
           inputPackageUid
           contentHash
           ordered input-section refs
      -> inference
      -> OUTPUT PACKAGE
           outputPackageUid
           raw-output contentHash
           parsed output-section refs
             -> MEASUREMENT
                measurementId
                -> ADJUDICATION TASK
                   -> blinded judgement / locked adjudication
```

System framing, prior conversation, and the current user input are subdivisions of one input package. `<reply>`, `<reflection>`, `<debate>`, etc. are subdivisions of one output package. Sections are addressable second-layer objects, not peers of the package they belong to.

Frozen raw witnesses remain authoritative for exact provider serialization. The retrospective package layer reconstructs the canonical structured input retained by the importer: system framing plus ordered model-visible messages.

## Identity rules

### Event identity != content identity

Two independently administered calls may receive text-identical packages and remain different experimental events.

```text
callUid          = one administered inference event
inputPackageUid  = this input-package event
outputPackageUid = this output-package event
sectionUid       = this package-section event
contentHash      = normalized content identity
```

Equal content hashes never imply equal event UIDs.

### Historical labels are not identities

`trunkKey`, condition labels, and replicate labels are analysis/provenance metadata, not event identity.

Concrete correction:

```text
raw7 C    = 250 independent one-call trajectories
raw7 C-r1 = 25 independent one-call trajectories
```

The 25 calls share condition/replicate metadata but are distinct inference events.

## Package and trajectory semantics

### Input package

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

The package is the intervention unit. Sections answer second-layer questions such as “what was the current user prompt?” or “what inherited assistant response was present?”.

### Output package

```text
OutputPackage
  outputPackageUid
  callUid
  raw-output contentHash
  sectionUids[]
  callOutcome
  stopReason
```

The raw output remains primary. Parsed sections are derived subdivisions and never replace it.

### Trajectory depth

A trajectory is a lineage of **administered inference calls**, not a count of user/assistant-looking messages visible inside one package.

For Pilot-1 ASb:

```text
parent AS trajectory = 5 calls
branch ASb trajectory = 1 call
branch input package = 5 inherited exchanges + N9
visible exchange pairs = 6
```

Therefore visible-context depth, parent depth, and branch call depth are separate quantities.

## Pinned corpus census

Against DAE commit `e2d484b41461013832c00e9f1ba3549ac0ef2517`:

### Inference events

- **2,659 calls**
- **2,659 input packages**
- **2,659 output packages**
- **38,222 package-section events**

Call source classes:

```text
raw2_plus_branch     1706
raw2_plus_cold        662
raw2_plus_trunk       271
pilot1_trunk_turn      10
pilot1_branch_call      2
pilot1_cold_call        8
```

Every call owns exactly one input and output package. Every call is owned by exactly one trajectory.

### Trajectories

- **2,420 trajectories**
- **42** multi-call trajectories
- **2,378** one-call trajectories
- **2,420 / 2,420** package-bound

```text
root_lived_trunk         42
root_single_call        670
branch_from_lived_trunk 1708
```

### Observation populations

Do not conflate the addressable corpus with the historical non-cold-schema battery population:

- **2,378 all addressable observation events**
- **2,028 non-cold-schema battery observations**
- **350 cold-schema observations**
- **27 canonical items**

`batteryObservations` means the 2,028 non-cold-schema measurement population. `allAddressableObservations` means all 2,378 observation events.

## Lineage proof is now mechanical

### Lived-trunk transitions

All **239 / 239** successive lived-trunk transitions are `verified_exact_extension`: the next input package reproduces the previous call state and adds exactly one new user input.

### Branch relations: two proof classes

All **1,708 / 1,708** branch relations are positively verified, with no lying graph and no invented parent events.

#### 1. Materialized parent trajectory

**1,442** branches have an addressable parent trajectory in the normalized corpus.

For these, Blum proves:

```text
parent terminal input package
+ parent terminal output package
= exact prefix of branch input package
+ exactly one new user message
```

Proof class: `materialized_parent_trajectory`.

#### 2. Frozen witness parent snapshot

For **266** branches, the historical parent inference calls are not materialized as corpus events. They occur in:

```text
raw2   12
raw4   12
raw6   48
raw10  50
raw12 144
```

The raw branch witness nevertheless preserves `prefix_len` and the exact sent prefix. The importer mechanically stores:

```text
parentSnapshot.messages = sent.slice(0, prefix_len)
parentSnapshot.contentHash
parentSnapshot.verificationStatus = verified_from_sent_prefix
```

Blum independently verifies that this frozen snapshot hash equals the corresponding prefix of the branch input package and that the package adds exactly one new user message.

Proof class: `frozen_witness_parent_snapshot`.

This **does not materialize or imply a missing parent call UID**. It proves inherited content, not an event that the corpus does not possess.

The witness-snapshot verifier covers all **1,706 raw2+ branch calls**; for 1,442 of those the stronger materialized-parent proof is also available, while 266 rely on the snapshot proof as their lineage route.

Combined branch result:

```text
materialized_parent_trajectory      1442
frozen_witness_parent_snapshot       266
unverified                              0
```

## Outcome-aware depth

Call outcome is a property of an already identified call; it never changes event identity.

Pinned result:

- **2,658 complete calls**
- **1 truncated call**
- **2,419 fully complete trajectories**
- **1 trajectory containing an incomplete call**

The sole truncation is:

```text
collection: raw12
trunk: H-r1
turn: 5
source: raw12/H-r1-t5.json
stopReason: max_tokens
```

The trajectory continues afterward and terminates normally. Thus “there are later calls” and “every prior call completed normally” are distinct claims.

## Measurement and adjudication provenance

Canonical measurement identity remains stable, but every measurement can now carry the inference-event provenance that produced it.

```text
observationId
  -> callUid
  -> inputPackageUid
  -> outputPackageUid
  -> outputSectionUid (when uniquely resolvable)
  -> measurementId
  -> adjudication task
```

Rules:

- raw2+ resolves by exact observation ID;
- historical Pilot-1 uses an explicit metadata bridge;
- zero call candidates => unresolved;
- multiple call candidates => ambiguous;
- multiple same-tag output sections are never guessed; exact section text may disambiguate a unique occurrence;
- measurement IDs do not change merely because provenance is enriched.

The real-corpus conservation regression requires every **2,378 / 2,378** normalized observation events to resolve to exactly one inference call/output package.

Package/event UIDs are propagated into adjudication **control provenance outside reader packets**. Blinded reader packets are regression-tested not to contain call/package/section UIDs, collection, condition, family, replicate, or source path.

This preserves the chain without turning provenance into a blinding side channel:

```text
CALL
 -> OUTPUT PACKAGE / SECTION
 -> MEASUREMENT
 -> ADJUDICATION TASK
 -> opaque reader packet
 -> judgement
 -> locked adjudication
```

## Treatment-origin compatibility query

The older treatment-origin query is a compatibility/provenance view, not the definition of an inference unit.

Two resolution routes are legitimate:

- raw2+ lived branches: verified lived-prefix message evidence;
- Pilot-1 ASb: explicit verified package-first parent trajectory → parent first call → first input package → first user section.

Matching text or reused trunk labels are never sufficient evidence.

Cold/cold-schema groups remain `not_applicable` for developmental origin because they have no lived parent by design.

## Portable representation

The first package-first portable build exposed a useful failure: duplicating full package content inside the whole-corpus index hit `RangeError: Invalid string length`.

The fix was structural sharing, not a larger memory limit.

Portable v1 publishes:

```text
data/dae-inference-package-graph-v0.json
data/dae-witness-parent-snapshot-integrity-v0.json
data/dae-trajectory-package-integrity-v0.json
data/dae-call-outcome-census-v0.json
data/dae-instance-start-census-v0.json
data/dae-instance-start-census-v0.csv
```

The package graph stores event topology and hashes while repeated text is stored once in a content-addressed store.

Pinned compact result:

- 2,659 calls / input packages / output packages
- 38,222 section events
- **8,101 unique content blobs**
- all package refs reconstruct offline
- both lineage proof classes remain inspectable offline
- outcome state remains inspectable offline
- all 2,420 trajectories retain package references

The full-witness bundle remains the byte/provider-level audit artifact. Portable normalization changes representation, not evidence.

## Hard regressions

The package-first layer is not green unless all of these hold:

1. every administered call owns exactly one input and output package;
2. every call is owned by exactly one trajectory;
3. every trajectory binds to package-bearing calls;
4. independent identical packages retain different event UIDs;
5. system framing is subordinate to the input package;
6. output sections are subordinate to the complete raw output package;
7. raw7 C-r1 remains 25 distinct one-call/package events;
8. Pilot AS trunks own five calls each;
9. Pilot ASb branches own one call each while preserving inherited context;
10. all 239 trunk transitions are exact extensions;
11. all 1,708 branch relations have one explicit positive proof class;
12. zero branch relations remain unverified;
13. call outcomes conserve all 2,659 call events;
14. all 2,378 normalized observations resolve to one inference-call/output-package provenance route;
15. output-section ambiguity is explicit rather than guessed;
16. adjudication control provenance retains package UIDs while reader packets omit them;
17. portable packages reconstruct from refs + content store;
18. the whole index references rather than duplicates standalone heavyweight proof graphs;
19. the compatibility message graph still reconstructs every indexed observation exactly.

## Remaining critique targets

The unit-of-inference, trajectory topology, branch parentage, outcome-aware depth, and measurement linkage problems are now mechanically covered. Remaining useful work is downstream usability and terminal-state completion:

1. surface package/measurement/adjudication addressability in the analysis UI;
2. continue canonical measurement terminal-state cleanup until every measurement is mechanically resolved, adjudicated-and-locked, explicitly unresolved with a task, genuinely not collected, or parser/spec unavailable;
3. keep compatibility projections subordinate to the package spine and remove stale warnings when stronger evidence legitimately supersedes them;
4. preserve the distinction between evidence strength classes rather than flattening every verified relation into one undifferentiated edge.

Target chain:

```text
raw witness
 -> inference package/call
 -> trajectory proof
 -> output package/section
 -> mechanical measurement
 -> adjudication
 -> derived analysis/graph
 -> claim
```

**Optimize duplication, not evidence. No lying graph.**
