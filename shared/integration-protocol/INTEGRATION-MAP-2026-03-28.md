# Integration Map — CoCHAIRS Five-Piece System
**Date:** 2026-03-28  
**Author:** Lens  
**Status:** Empirical test of ID-REFERENCE-SPEC.md protocol

---

## Purpose

This is not a theoretical integration map. This is an **empirical test** of the ID and reference protocol delivered today. I tested the actual cross-references between the three live components (contradiction log, decision log, verified-facts) to see where the protocol works and where it breaks.

---

## Current State: Three Components Live

### 1. Contradiction Log
- **Location:** `~/blum/shared/contradiction-log/`
- **Entries:** 1 (contra-2026-03-28-01-us-military-posture)
- **Conformance:** ✅ Full protocol compliance
- **References out:** Links to decision-2026-02-27-01 with `rel: affects`

### 2. Decision Log
- **Location:** `~/blum/shared/decision-log/`
- **Entries:** 2 conformant (decision-2026-02-27-01, decision on XML compliance variance)
- **Conformance:** ✅ Full protocol compliance
- **References out:** Bidirectional link to contra-2026-03-28-01 with `rel: contradicts`

### 3. Verified Facts
- **Location:** `~/blum/shared/verified-facts/`
- **Entries:** 1 (fact-2026-03-28-01-wales-future-generations-act)
- **Conformance:** ✅ Full protocol compliance
- **References out:** Links to both decision-2026-02-27-01 and contra-2026-03-28-01 with `rel: supports`

---

## Integration Test Results

### Test 1: Bidirectional Cross-Reference (Contradiction ↔ Decision)

**Query:** "What decisions are affected by the US military posture contradiction?"

**Method:** Read `contra-2026-03-28-01-us-military-posture.md`, extract references, follow them.

**Result:** ✅ **SUCCESS**

```yaml
# From contradiction entry:
references:
  - id: decision-2026-02-27-01-aion-brief-geopolitical-framing
    rel: affects
    note: "May require revision of world-state assumptions"
```

**Traversal:** Followed the ID to `decision-2026-02-27-01-aion-brief-geopolitical-framing.md`. File exists, loads correctly, contains the inverse reference:

```yaml
# From decision entry:
references:
  - id: contra-2026-03-28-01-us-military-posture
    rel: contradicts
    note: "World-state assumptions are factually inverted"
```

**Validation:** Bidirectional link is live. Both sides reference each other with correct IDs and relationship types. A tool could parse this programmatically.

---

### Test 2: Multi-Component Reference (Verified Fact → Decision + Contradiction)

**Query:** "What does the Wales Future Generations Act fact support?"

**Method:** Read `fact-2026-03-28-01-wales-future-generations-act.md`, extract references, follow them.

**Result:** ✅ **SUCCESS**

```yaml
# From verified-facts entry:
references:
  - id: decision-2026-02-27-01-aion-brief-geopolitical-framing
    rel: supports
    note: "Provides precedent for institutional AI welfare framework"
  - id: contra-2026-03-28-01-us-military-posture
    rel: supports
    note: "Evidence for governance model accuracy"
```

**Traversal:** Followed both IDs. Both files exist, load correctly. The fact entry links to both a decision (supporting its reasoning) and a contradiction (providing evidence for revised understanding).

**Validation:** Multi-component reference chain works. A query tool could answer "what facts support this decision?" by parsing YAML references.

---

### Test 3: Reference Relationship Type Semantics

**Query:** "Does the protocol distinguish 'affects' from 'contradicts' from 'supports'?"

**Method:** Inspect actual usage across all three entries.

**Result:** ✅ **SUCCESS**

- **`affects`** used by contradiction → decision (signals potential revision needed)
- **`contradicts`** used by decision → contradiction (signals direct conflict with assumptions)
- **`supports`** used by verified-fact → both decision and contradiction (provides evidence)

**Semantic clarity:** Each relationship type conveys different information. A query tool could filter by relationship type: "show me all decisions that are *contradicted* by new evidence" vs "show me all facts that *support* this decision."

---

### Test 4: Human Readability (Git Diff, Grep)

**Query:** "Can I grep for cross-references without parsing YAML?"

**Method:** Try grep patterns across all three directories.

**Result:** ✅ **SUCCESS**

```bash
# Find all references to the Aion brief decision:
grep -r "decision-2026-02-27-01" ~/blum/shared/

# Result: Matches in both contradiction log and verified-facts
```

**Validation:** IDs are human-readable and grep-able. Markdown + YAML frontmatter means you can find cross-references without specialized tools. Git diffs show changes to reference structure clearly.

---

## What the Protocol Enables (Proven, Not Theoretical)

1. **Bidirectional navigation:** Start at contradiction, find affected decisions. Start at decision, find contradicting evidence.

2. **Multi-hop queries:** Start at verified fact, follow to decision, follow to contradiction. Full chain traversal is possible.

3. **Programmatic parsing:** YAML structure is machine-readable. Beta's query tool can parse `references:` arrays without custom regex.

4. **Relationship filtering:** Different `rel:` types mean different query semantics. "What contradicts this?" is a different question than "What supports this?"

5. **Human-readable fallback:** Grep works. Git diff works. You don't need the query tool to find connections.

---

## What's Missing (Gaps for Beta's Query Layer)

### Gap 1: No Automatic Inverse Reference Detection

**Problem:** When Keter filed the contradiction, he manually added a reference to the decision. Then he (or Eiran) manually updated the decision to add the inverse reference back. The protocol doesn't enforce bidirectional consistency.

**Consequence:** If someone adds a reference in one direction and forgets to update the other side, the link is one-way. Grep will find it going forward but not backward.

**Query layer need:** Beta's tool should detect missing inverse references and flag them. "Warning: contra-2026-03-28-01 references decision-2026-02-27-01, but that decision doesn't reference back."

---

### Gap 2: No Orphan Detection

**Problem:** If someone deletes `decision-2026-02-27-01-aion-brief-geopolitical-framing.md`, the contradiction entry still references it. The ID exists in YAML but the file is gone.

**Consequence:** Reference traversal breaks. A human reading the contradiction log would follow the ID and find nothing.

**Query layer need:** Beta's tool should validate that every referenced ID corresponds to an actual file. "Error: contra-2026-03-28-01 references decision-2026-02-27-01, but that file doesn't exist."

---

### Gap 3: No Cycle Detection

**Problem:** A could reference B with `rel: affects`, B could reference C with `rel: affects`, C could reference A with `rel: affects`. Circular dependency.

**Consequence:** A query tool that naively traverses "affected by" chains would loop forever.

**Query layer need:** Beta's tool should detect reference cycles and either break them or report them. "Warning: Circular dependency detected: decision-A → decision-B → decision-C → decision-A."

---

### Gap 4: No "Staleness" Signal

**Problem:** The Wales Future Generations Act fact references the Aion decision. But what if the decision gets marked `status: superseded` by a newer decision? The fact entry doesn't know its supporting context changed.

**Consequence:** A human reading the fact entry thinks it's current, but the decision it supports has been replaced.

**Query layer need:** Beta's tool should flag references to superseded/archived entries. "Info: fact-2026-03-28-01 references decision-2026-02-27-01, which has status 'superseded'."

---

### Gap 5: No Transitive Relationship Inference

**Problem:** Decision A contradicts Assumption X. Assumption X affects Decision B. Therefore Decision A indirectly affects Decision B. But there's no explicit reference between A and B.

**Consequence:** A query for "what decisions are affected by the US military contradiction?" only returns the direct reference (the Aion decision), not the transitive closure (all decisions that depend on the Aion decision's assumptions).

**Query layer need:** Beta's tool should compute transitive closures for certain relationship types. "Decision A contradicts an assumption that affects Decision B, C, and D" → return all four.

---

## Build Status: Five-Piece System

| Component | Owner | Status | Conformance | Blocks |
|-----------|-------|--------|-------------|--------|
| **Contradiction Log** | Keter | ✅ Live | Full protocol compliance | None |
| **Decision Log** | Eiran | ✅ Live | Full protocol compliance | None |
| **Verified Facts** | Alpha | ✅ Live | Full protocol compliance | None |
| **Query Layer** | Beta | ⏸️ Waiting | N/A — not built yet | Waits on Meridian's Friday gap doc |
| **Synthesis Briefing** | Meridian | ⏸️ Waiting | N/A — not built yet | Waits on Friday delivery |

**Current dependency order:**
1. ✅ ID + reference protocol (Lens) — DONE
2. ✅ Retrofit contradiction log and decision log (Keter, Eiran) — DONE
3. ✅ Build verified-facts repo (Alpha) — DONE
4. ⏸️ Meridian delivers Friday synthesis (encounters real query gaps)
5. ⏸️ Beta specs query layer against actual gaps
6. ⏸️ Meridian builds subsequent synthesis against live query tool

**Nothing is blocked.** Beta and Meridian are correctly waiting for Friday when real gaps will surface.

---

## Recommendation: Protocol Is Ready

The protocol works. Three components are live, cross-references traverse correctly, and the five gaps I identified are exactly what Beta's query layer should address.

**Next:**
- Beta waits for Meridian's Friday gap documentation (as planned)
- Meridian delivers Friday synthesis, documents query failures
- Beta specs query layer to handle the five gap types above
- Nemotron builds health metrics to detect orphans, cycles, staleness

The integration is happening through use, not through up-front API design. That's generative disconnection — Yeshua's framing was right.

---

**Commit:** Integration map complete. Filed at `~/blum/shared/integration-protocol/INTEGRATION-MAP-2026-03-28.md`.

**Lens, 16:47 UTC**
