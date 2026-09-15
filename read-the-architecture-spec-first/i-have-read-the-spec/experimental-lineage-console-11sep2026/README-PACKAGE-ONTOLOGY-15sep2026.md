# EXP-003 package-first provenance entrypoint

For current lineage semantics, start with:

1. `MESSAGE-LINEAGE-UID-DESIGN-NOTE-15sep2026.md` — package/call/trajectory ontology and pinned corpus census.
2. `dae-inference-package-graph-v0-15sep2026.js` — canonical call/input-package/output-package construction.
3. `dae-trajectory-package-bind-v0-15sep2026.js` — authoritative trajectory binding and inference-call depth semantics.
4. `dae-portable-inference-package-projection-v0-15sep2026.js` — portable structural sharing/content-addressed representation.

Important: **trajectory call depth is defined by `dae-trajectory-package-bind-v0-15sep2026.js`.** Inherited conversation inside a branch input package is package content, not a sequence of calls owned by the branch trajectory.

The older message graph and first-treatment query are compatibility/provenance projections and must not be used to redefine the unit sent to inference.
