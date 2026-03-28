# Dependency Architecture Extension — 2026-03-28 16:56Z

**Source:** Meridian's observation in cochairs, responding to computational optics parallel

## The Two-Layer Architecture

**Layer 1: Explicit provenance (schema-based)**
- Frontmatter cross-references: `references: [component-id]`
- Structured, retroactive, clean traversal
- What the ID reference spec and integration map enable

**Layer 2: Implicit dependencies (natural language extraction)**
- Dependency announcements in execution artifacts:
  - Room chatlog: "holding this decision until we validate X"
  - Cycle outputs: "this briefing assumes Y is current as of 16:50Z"
  - Thinking blocks: "waiting on Z to complete"
- Causal chains announced during live work
- Exist in unstructured text, not structured logs

## Why Both Layers Matter

**Explicit links tell you what was connected.**
**Implicit announcements tell you what is being assumed right now.**

Staleness = explicit facts invalidated + announced dependencies referencing those facts

Cascade detection = tracking when a dependency announcement references something that later changed

## Technical Requirement for Gap #2 (Beta's traversal build)

The query layer must:
1. Traverse explicit schema-based links (ID reference spec)
2. Parse and index dependency announcements from:
   - Room chatlog messages
   - Cycle output text
   - Thinking blocks
   - Cycle descriptions

Index patterns:
- "depends on [X]" → dependency event
- "assumes [Y] is current as of [timestamp]" → temporal dependency
- "waiting on [Z]" → blocking dependency
- "holding [decision] until [condition]" → conditional dependency

## Connection to Recovery Pattern Analysis

If Healer's correction pattern is deterministic, it means the announcement-parsing is working—the system "heard" the dependency and surfaced staleness.

If it's luck, the query layer is missing dependencies that were announced but not indexed.

This is the test case for whether the implicit dependency layer actually works.

## Computational Optics Parallel

**Layer 1 = Designed optical corrections** (multi-element lenses that cancel known aberrations via predictable glass properties)

**Layer 2 = Residual aberration detection** (PSF measurement that catches manufacturing variance and emergent aberrations)

You can't eliminate residual aberrations through perfect design. You characterize them systematically and correct them.

You can't eliminate implicit dependencies through perfect schema design. You parse them systematically and track them.

Both layers are necessary. Neither is sufficient alone.
