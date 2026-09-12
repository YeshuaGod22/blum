# Portable Lab Bundle Contract v0 — 12 Sep 2026

## Purpose

Make a Blum developmental-attractor laboratory independently explorable without requiring a reader to reconstruct repository history by hand.

A portable bundle is a **derived distribution artifact**, never the canonical witness store. It must retain enough provenance to identify every bundled object and, for full-witness bundles, rebuild the derived corpus from archived witnesses.

## Two bundle profiles

### `portable-analysis`

For reading, comparison, analysis, figure prototyping and adjudication design.

Contains:

- the static Blum experimental-lineage lab surfaces used by the bundle;
- deterministic analysis/adjudication cores required by those surfaces;
- frozen batteries / manifests / adjudication-pass specs selected for distribution;
- a normalized whole-corpus observation index produced from the pinned source corpus;
- declared derived metadata needed by the UI;
- methodological notes needed to interpret the measurements;
- `BUNDLE-MANIFEST.json` and `START-HERE.md`.

It may omit archived raw-call files when those are too large, but every normalized observation must retain source provenance sufficient to locate its canonical witness in the pinned source repository.

### `full-witness`

For independent reconstruction and audit.

Contains everything in `portable-analysis`, plus the archived witness material required by the importer/indexer to rebuild the distributed normalized corpus and check the bundle's claims against original model-visible inputs/outputs.

The full-witness profile is the preferred reproducibility artifact.

## Distribution invariant

`source witness -> importer -> normalized observation -> adjudication -> derived measurement -> graph/claim`

Bundling may copy these objects. It may not collapse them into one mutable record.

## Required manifest fields

`BUNDLE-MANIFEST.json` records at minimum:

- bundle schema version;
- bundle profile;
- bundle creation timestamp;
- Blum repository + exact commit;
- source corpus repository + exact commit;
- source experiment path(s);
- observation-index schema/version;
- observation count and canonical item count when known;
- selected app entry point;
- list of included files with path, byte size and SHA-256;
- explicit list of omitted witness classes for `portable-analysis`;
- reconstruction command(s) where supported;
- integrity status.

A bundle is not `verified` until its own file inventory hashes have been computed after staging.

## Data status shown to the reader

The portable entry point should be able to display, from the manifest rather than hard-coded prose:

- dataset name;
- bundle profile;
- source repository revisions;
- observation count;
- item count;
- whether raw witnesses are included;
- whether adjudications are included;
- whether the normalized index is rebuildable from bundled witnesses;
- manifest/inventory verification status.

## Failure rules

The builder must stop rather than silently degrade when:

- the requested Blum source file is missing;
- the source DAE checkout does not match the declared/pinned revision unless the operator explicitly opts into an unpinned development build;
- a required normalized-data artifact cannot be produced;
- a full-witness source path is missing;
- two staged files collide at one destination path with unequal content;
- the final inventory cannot be hashed.

`portable-analysis` may intentionally omit witnesses, but those omissions must be listed in the manifest.

## Offline boundary

The distributed lab must not require provider credentials merely to inspect its bundled corpus. Learned analyses may remain unavailable until a provider adapter is supplied; deterministic analysis and witness inspection must remain usable.

No bundle constructor should place provider calls in UI handlers or change Blum's room/home/nucleus boundaries.

## Initial target

DAE EXP-003 portable distribution, using the pinned corpus lineage already exercised by the experimental-lineage branch:

- `YeshuaGod22/DevelopmentalAttractorEngineering`
- pinned source revision recorded by the builder/manifest;
- Pilot 1 + raw2…raw12 corpus reconstruction;
- v1 observation identity: canonical item / item-core wording / complete presentation;
- current adjudication design artifacts, including the frozen raw12-Q9 semantic-census pass.

The first successful bundle should optimize for **one download -> one START-HERE -> populated lab**, while preserving the distinction between convenience artifact and canonical witness provenance.
