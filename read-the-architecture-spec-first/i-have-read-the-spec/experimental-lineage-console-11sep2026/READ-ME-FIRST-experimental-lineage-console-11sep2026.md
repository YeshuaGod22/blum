# READ THIS BEFORE MODIFYING THE EXPERIMENTAL LINEAGE CONSOLE

**Date:** 11 Sep 2026  
**Status:** experimental UI module  
**Parent architecture:** `blum-architecture-spec-v-14feb2026.md`

This module is a human/AI-usable control surface for developmental experiments. Its central object is a **lineage**: a frozen developmental trunk, declared fork points, controlled branch interventions, probe/battery instruments, and analysis streams attached to descendants.

It is deliberately separate from the room chat UI.

## Architectural boundary

This console does **not** make rooms think, does **not** put another occupant inside a home, and does **not** call one home from another. In its current prototype state it is a local design-and-manifest tool only.

When an execution adapter is added later:

- a room remains only a chatlog + participant list + dispatch;
- a home remains the only place that orchestrates model calls;
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

## Prototype scope

`blum-experimental-lineage-console-11sep2026.html` is a standalone HTML/CSS/JS prototype. It currently supports:

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

It does **not yet execute API calls**. That boundary is intentional for this first commit: the data model and operator semantics should stabilize before an execution adapter is wired to live homes/providers.

## Data model in one sentence

`experiment → trunks → forks → probes → observations`, with `analysisStreams` attached declaratively and every frozen manifest assigned a fingerprint.

## Before adding execution

Do not bolt provider calls directly into random button handlers. Define the execution contract first: what a frozen manifest hands to a runner, what immutable IDs the runner returns, how retries/resumes preserve lineage, and how raw outputs/stop reasons/XML-presence metadata are written without mutating the design manifest.

The console should become a laboratory instrument, not a prettier prompt launcher.
