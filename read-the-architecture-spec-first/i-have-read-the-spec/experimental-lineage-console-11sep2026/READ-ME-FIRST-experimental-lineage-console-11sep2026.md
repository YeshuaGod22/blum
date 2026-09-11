# READ THIS BEFORE MODIFYING THE EXPERIMENTAL LINEAGE CONSOLE

**Date:** 11 Sep 2026  
**Status:** experimental UI + runner-core module  
**Parent architecture:** `blum-architecture-spec-v-14feb2026.md`

This module is a human/AI-usable control surface for developmental experiments. Its central object is a **lineage**: a frozen developmental trunk, declared fork points, controlled branch interventions, probe/battery instruments, and analysis streams attached to descendants.

It is deliberately separate from the room chat UI.

## Start here

- `blum-experimental-lineage-console-11sep2026.html` — design and freeze a lineage manifest.
- `experimental-lineage-runner-contract-v0-11sep2026.md` — the boundary between design, execution, observations, and analysis.
- `experimental-lineage-runner-core-v0-11sep2026.js` — provider-agnostic execution core; the caller injects model and embedding functions.
- `test-experimental-lineage-runner-core-v0-11sep2026.js` — Node vertical-slice test.
- `experimental-lineage-vertical-slice-rehearsal-11sep2026.html` — browser rehearsal using the real runner core with deterministic mock model/embedding functions. No API calls.

The committed vertical-slice test is also run by `.github/workflows/test-experimental-lineage-console.yml`.

## Architectural boundary

This console does **not** make rooms think, does **not** put another occupant inside a home, and does **not** call one home from another.

The new runner core is orchestration logic only. It has no provider credentials and no Blum room knowledge. It receives a frozen manifest and an injected `callModel()` function. A later live adapter must decide how a consenting Blum home or external controller supplies that function without crossing constitutional boundaries.

When a live execution adapter is added:

- a room remains only a chatlog + participant list + dispatch;
- a home remains the only place that orchestrates its own model calls;
- the nucleus remains stateless;
- experiment execution must be represented as a home-side capability/process or an external controller speaking through existing Blum boundaries, never inference inside the room server;
- all user/agent protocol symmetry must be preserved.

## Core design rules

1. **Lineage, not run, is the primary object.**
2. **Shared-parent contrasts are first-class.** The UI distinguishes exact shared-parent comparisons from cross-parent exploratory comparisons.
3. **Experimental components are typed objects.** Questions carry IDs, families, constructs, response types, scorer names, and enablement state rather than existing as anonymous strings.
4. **A flown/frozen trunk is immutable.** Editing a frozen design creates a new manifest version rather than silently changing history.
5. **Failure states are observations.** Refusal, parse failure, API failure, truncation, context limit, protocol stop, operator abort, and missing XML tag are explicit outcomes.
6. **Analysis streams are preregistrable.** XML-region selectors and missing-tag policies are part of the frozen manifest.
7. **The design exposes its geometry before execution.** Call counts, paired contrasts, factorial cells, and obvious missing cells are visible before a run.
8. **Complexity is folded, not removed.** The default workflow is Build → Fork → Probe → Measure → Review → Freeze; advanced details remain available without forcing them into the operator's working memory.
9. **Raw output and analysis projection are different objects.** The runner preserves raw model output; XML selectors create derived projections later.
10. **Exact means exact.** An `a ↔ 0` pair receives `exact_shared_parent` only when both observations carry the same real `parentSnapshotId`.

## Prototype scope

`blum-experimental-lineage-console-11sep2026.html` currently supports:

- editable experiment metadata and developmental turns;
- multiple trunks and replicate counts;
- editable branch/fork interventions;
- typed, reorderable battery items with bulk family selection;
- per-branch battery assignment;
- XML-tag analysis streams (`whole`, `single tag`, or composite selectors);
- live call-count and paired-contrast estimates;
- a 2×2 trunk/schema completeness view when the standard four cells are represented;
- explicit missing/failure policies;
- immutable-style manifest freezing using a deterministic browser-side hash;
- JSON import/export of the experiment manifest;
- a lineage preview that makes parentage visible.

The runner core now supports the first executable vertical slice:

`frozen manifest → lived trunk → exact parent snapshot → sibling forks → shared probe → raw observations → XML projections → optional embeddings → sibling cosine divergence`

It deliberately does **not** contain a live provider adapter yet.

## Data model in one sentence

`experiment → trunks → parent snapshots → forks → probes → observations → analysis projections`, with every frozen design assigned a fingerprint and every exact sibling comparison anchored to an immutable parent snapshot.

## Before adding live execution

Do not bolt provider calls directly into random button handlers.

The next adapter must satisfy the runner contract: a frozen manifest goes in; append-only execution rows and immutable observations come out; retries preserve failed attempts; raw output is retained; XML selection does not mutate observations; and live model execution stays on the correct side of Blum's home/room/nucleus boundaries.

The console should become a laboratory instrument, not a prettier prompt launcher.
