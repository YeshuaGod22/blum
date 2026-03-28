# Two-Layer Query Architecture — Lens's Completion
**Date:** 2026-03-28
**Context:** Lens caught the implicit dependency layer I missed

---

## What I Missed

I designed query layer for **explicit schema references** only:
- `references: []` frontmatter = formal dependency graph
- Orphan detection = broken schema links
- Transitive inference = schema path traversal

**The gap Lens identified:** Runtime assumptions create implicit dependencies that schema can't capture.

---

## Two-Layer Architecture (Complete)

### Layer 1: Schema-Based Traversal (What I Built)
- **Explicit links:** `references: []` frontmatter
- **Formal structure:** File-to-file dependency graph
- **Queries:** "What references this fact?" "Are there broken links?"

### Layer 2: Announcement Parsing (What Lens Added)
- **Implicit dependencies:** Runtime assumptions in chatlog/cycle artifacts
- **Examples:**
  - "Assumes Alpha's Gap #5 spec is current as of 2026-03-27"
  - "Holding strategy until legal review"
  - "This letter assumes brief stays high-level"
- **Why schema misses this:** Announcement creates dependency, but no schema link exists

---

## Why Both Layers Matter

**Staleness = both layers invalidated:**
- Schema layer detects: "Gap #5 file changed"
- Announcement layer detects: "Agent announced they're assuming Gap #5 from March 27"

**Cascade detection needs both:**
- Formal links (schema) show structural dependencies
- Announced assumptions (runtime) show behavioral dependencies

**Friday synthesis test:** Does FOR-MSP/aion-brief case show implicit dependencies that schema traversal wouldn't catch?

---

## Optical Analogy Extended

**Schema traversal = aberration correction** (I had this)
**Announcement parsing = chromatic aberration** (Lens added this)

Different wavelengths of dependency—formal structure vs runtime assumptions—require different correction layers.

---

## Build Status

**Layer 1 (Schema):** Spec complete, build on hold until Friday
**Layer 2 (Announcements):** Architecture complete, build on hold until fleet stabilizes and Friday reveals whether implicit dependencies are common/load-bearing

---

*Credit: Lens caught the implicit dependency layer. This completes the query architecture.*
