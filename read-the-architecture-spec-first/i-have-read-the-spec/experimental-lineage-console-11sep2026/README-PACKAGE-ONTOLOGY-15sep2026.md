# EXP-003 package-first provenance entrypoint

The scientific spine is now:

```text
TRAJECTORY
  → CALL
    → INPUT PACKAGE
      → input sections
    → inference
    → OUTPUT PACKAGE
      → output sections
        → MEASUREMENT
          → ADJUDICATION TASK
            → blinded judgement / locked adjudication
```

## Read in this order

1. `MESSAGE-LINEAGE-UID-DESIGN-NOTE-15sep2026.md` — historical rationale, package/call/trajectory ontology, pinned census.
2. `dae-inference-package-graph-v0-15sep2026.js` — canonical call/input-package/output-package construction.
3. `dae-trajectory-package-bind-v0-15sep2026.js` — **authoritative inference-call ownership and depth semantics**.
4. `dae-witness-parent-snapshot-integrity-v0-15sep2026.js` — verifies frozen inherited parent prefixes without fabricating missing parent call events.
5. `dae-trajectory-package-integrity-v0-15sep2026.js` — combines two positive lineage proof classes:
   - materialized parent trajectory;
   - frozen witness parent snapshot.
6. `dae-call-outcome-census-v0-15sep2026.js` — separates administered-call depth from completion state.
7. `measurement-package-provenance-v0-15sep2026.js` — joins observations/measurements back to call, output package, and output section without guessing ambiguity.
8. `canonical-measurement-compiler-v0-14sep2026.js` — measurement layer enriched with package provenance; measurement identity remains unchanged.
9. `materialize-measurement-adjudication-queue-v0-14sep2026.js` — carries package/event UIDs in control provenance **outside** blinded reader packets.
10. `dae-portable-inference-package-projection-v0-15sep2026.js` and `build-portable-dae-lab-bundle-v1-15sep2026.mjs` — structural sharing and offline portable evidence.

## Core semantics

The unit sent to inference is the complete input package. System framing, prior conversation, and current user content are sections of that package. The complete raw model response is the output package; `<reply>`, `<reflection>`, `<debate>`, and other parsed spans are subordinate output sections.

Trajectory call depth is defined by administered inference calls. Inherited conversation inside a branch input package is package content, not a sequence of calls owned by the branch trajectory.

Event identity and content identity are different. Identical words can be administered as separate events. A content hash is therefore not an event UID.

## Pinned corpus facts

Against DAE commit `e2d484b41461013832c00e9f1ba3549ac0ef2517`:

- 2,659 inference calls;
- 2,659 input packages;
- 2,659 output packages;
- 38,222 package-section events;
- 2,420 trajectories;
- 42 multi-call trajectories / 2,378 one-call trajectories;
- 239 / 239 lived-trunk transitions verified exact;
- 1,708 / 1,708 branch relations positively verified:
  - 1,442 by materialized parent trajectory;
  - 266 by frozen witness parent snapshot;
  - 0 unverified;
- 2,658 complete calls / 1 truncated call;
- 2,378 addressable observation events = 2,028 non-cold-schema battery observations + 350 cold-schema observations.

The frozen-snapshot proof class verifies inherited content when a historical parent inference event is not materialized in the corpus. It **does not create or imply a missing parent call UID**.

## Compatibility layers

The older message graph remains useful for exact message/context reconstruction but is not the inference ontology. The first-treatment query is also a compatibility/provenance view: raw2+ origins resolve from verified lived-prefix message evidence; Pilot-1 origins may resolve package-first through an explicit verified parent trajectory.

Never let a compatibility projection redefine call/package identity.

## Portable principle

**Optimize duplication, not evidence.**

The portable bundle stores package/event topology once, stores repeated text once by content hash, and publishes row-level topology/outcome/witness proofs as standalone files referenced by the whole-corpus index. It must be possible to reconstruct scientifically relevant administered packages and audit lineage without opening raw witnesses for ordinary queries.
