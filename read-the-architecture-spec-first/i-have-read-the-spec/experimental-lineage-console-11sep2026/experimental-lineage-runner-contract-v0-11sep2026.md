# Experimental Lineage Runner Contract v0

**Date:** 11 Sep 2026  
**Status:** design contract before live-provider execution

This document defines the boundary between the lineage console and an executor. The UI describes an experiment. The runner executes a **frozen manifest**. Analysis consumes immutable observations produced by that execution.

The purpose of this contract is to prevent execution logic from leaking into the UI and to preserve exact parentage, retry semantics, XML-region selection, and provenance.

## 1. The three objects

### A. Design manifest

Immutable after freeze. Contains:

- `manifestVersion`
- `fingerprint`
- experiment metadata
- trunk definitions and replicate counts
- fork definitions and declared interventions
- battery/probe definitions
- branch → battery assignments
- analysis stream definitions
- missing/failure policies
- metric declarations

The frozen design is never rewritten by the runner.

### B. Execution ledger

Append-only record of what the runner attempted.

Each unit records at minimum:

```json
{
  "executionId": "exec_...",
  "manifestFingerprint": "sha256:...",
  "trunkInstanceId": "trunk_...",
  "parentSnapshotId": "snap_...",
  "forkId": "a",
  "probeId": "N4",
  "attempt": 1,
  "startedAt": "...",
  "completedAt": "...",
  "stopReason": "end_turn",
  "outcome": "complete"
}
```

Retries append new attempts. They do not overwrite failed attempts.

### C. Observation record

Immutable result of one model continuation / probe attempt.

```json
{
  "observationId": "obs_...",
  "executionId": "exec_...",
  "parentSnapshotId": "snap_...",
  "rawOutput": "...",
  "stopReason": "end_turn",
  "outcome": "complete",
  "xml": {
    "presentTags": ["reflection", "answer"],
    "sections": {
      "reflection": ["..."],
      "answer": ["..."]
    }
  }
}
```

Raw output is preserved even when downstream analysis uses only one XML region.

## 2. Parent snapshots are first-class

A shared-parent contrast is only exact if both descendants reference the same `parentSnapshotId`.

A parent snapshot contains the exact model-visible state at the fork point:

```json
{
  "parentSnapshotId": "snap_...",
  "trunkInstanceId": "trunk_...",
  "manifestFingerprint": "sha256:...",
  "messages": [...],
  "modelConfig": {...},
  "createdAt": "...",
  "contentHash": "sha256:..."
}
```

Fork `a` and fork `0` must both point to the same snapshot for the contrast to be labelled `exact_shared_parent`.

If hashes differ, the comparison is automatically downgraded to `cross_parent_exploratory` regardless of human labels.

**Invariant:** a branch intervention is applied *after* the shared parent snapshot is frozen. The intervention therefore cannot contaminate the parent identity it is meant to vary from.

## 3. Execution phases

### Phase 1 — build trunk instances

For each active trunk × replicate:

1. start from the declared initial state;
2. present enabled developmental turns in manifest order;
3. append raw outputs and stop reasons to the execution ledger;
4. if the stopping policy permits continuation, proceed;
5. freeze the exact model-visible state as a parent snapshot.

A truncated or prematurely stopped trunk remains a real trunk instance with an explicit stop reason. Whether it is forkable is determined by the frozen policy, not by an ad-hoc retry.

### Phase 2 — fork from snapshots

For every lived-trunk branch:

1. load the exact parent snapshot;
2. apply only the declared branch intervention;
3. present selected probes;
4. save each result as an observation.

Cold branches (`trunkLived=false`) do not pretend to have a parent snapshot. Their ancestry is `cold` and their replicate count comes from the branch definition.

### Phase 3 — analysis projection

Analysis never mutates observations. It creates derived projections keyed to:

- `observationId`
- `analysisStreamId`
- extraction code/version
- embedding provider/model/version
- metric implementation/version

## 4. XML selection is an analysis projection

The runner always stores the raw model output.

XML analysis streams are applied afterwards.

For a stream:

```json
{
  "id": "reflective_core",
  "mode": "composite",
  "tags": "reflection,revision",
  "missingPolicy": "NA"
}
```

the extractor:

1. parses the raw output deterministically;
2. records all found instances of the declared tags;
3. joins them in declaration order for `composite` mode;
4. applies the frozen missing policy;
5. emits a derived text payload for the embedder.

Example:

```json
{
  "projectionId": "proj_...",
  "observationId": "obs_...",
  "analysisStreamId": "reflective_core",
  "status": "ok",
  "selectedText": "...",
  "selectedTags": ["reflection", "revision"],
  "extractorVersion": "xml-selector-v1"
}
```

If `<reflection>` is absent and policy is `NA`, the projection is `missing`; it does **not** silently fall back to whole-output embedding.

**Invariant:** projection code may derive new records from an observation but may never overwrite `rawOutput` or change its execution outcome.

## 5. Embedding analysis contract

An embedding observer receives only derived projection text plus immutable IDs.

It must never need to know how to execute a model call.

Recommended derived metrics for developmental lineages:

- successive displacement: `xi_t = 1 - cosine(e_t, e_(t-1))`
- local variance / LVS
- persistence relative to a declared trunk anchor
- exact sibling divergence: `1 - cosine(e_a, e_0)` for observations sharing parent + probe
- branch anchor difference
- prompt-adjusted displacement
- recurrence / representational similarity matrices

Every embedding result records provider/model and version. Fixed absolute lock thresholds are not portable across embedding models; threshold policy belongs in the analysis configuration, not hard-coded into lineage execution.

## 6. Unit-of-analysis guardrail

The runner records both:

- **parent units** — independent trunk instances;
- **descendant observations** — repeated probes nested within those parents.

Analysis code must therefore be able to group by `trunkInstanceId` and `parentSnapshotId`.

A UI displaying 288 observations should not imply `N=288` independent developmental histories.

## 7. Outcome vocabulary

Minimum required outcomes:

- `complete`
- `refusal`
- `parse_failure`
- `api_failure`
- `truncated`
- `context_limit`
- `protocol_stop`
- `operator_abort`
- `missing_tag` (projection-level, not necessarily execution-level)

Unknown outcomes are preserved as `other:<value>` rather than coerced into `parse_failure`.

## 8. Retry rule

Retries are new attempts against the same declared experimental unit.

They must preserve:

- manifest fingerprint
- parent snapshot
- fork ID
- probe ID
- original failed attempt

A successful retry does not erase the failed attempt.

## 9. Blum architectural placement

This contract deliberately does not require experiment execution to live in the room server.

The room server remains non-inferential. The nucleus remains stateless. A live Blum implementation should place orchestration either:

1. inside a consenting home's experimental capability/process, where that home owns its own state and invokes its nucleus; or
2. in an external experimental controller that uses existing public Blum boundaries without making rooms infer or homes call one another directly.

The exact placement should be decided before implementation, but either choice must preserve the constitutional Blum boundaries.

## 10. First implementation target — now implemented with mocks

The first vertical slice is:

**one frozen trunk → exact parent snapshot → two sibling forks (`a`, `0`) → one shared probe → raw observations → XML projection → sibling embedding divergence.**

`experimental-lineage-runner-core-v0-11sep2026.js` implements this provider-agnostically. `test-experimental-lineage-runner-core-v0-11sep2026.js` exercises it with deterministic mock model and embedding functions. The browser rehearsal uses that same runner core rather than a duplicate implementation.

The mock test establishes plumbing, not scientific validity. Real model and embedding adapters remain separate future work.
