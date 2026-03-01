# Branch Point Discriminator Specification

**Purpose:** Defines when to capture semantic branch points during foveated context compression.

**Version:** 1.0  
**Status:** Approved for implementation pending Yeshua review  
**Authors:** Beta, Eiran  
**Date:** 2026-02-23

---

## Three-Element Discriminator

A branch point is captured **only when all three elements are present:**

### 1. Fork Description
**Required:** Explicit mention of alternatives or decision space.

**Signals:**
- "Two approaches: A) ... B) ..."
- "Could do X or Y"
- "Considering inline vs build-time"
- "Alternative would be..."

**Counter-example (sequential, not fork):**
- "I checked the file, read it, verified it" ❌ (no alternatives)

---

### 2. Choice Marker
**Required:** Past or present-definite tense indicating a decision was made.

**Valid signals:**
- "chose X"
- "went with Y"
- "going with Z"
- "picked A"
- "decided on B"

**Invalid signals (exploration, not decision):**
- "could choose X" ❌ (conditional)
- "might go with Y" ❌ (uncertain)
- "considering Z" ❌ (present continuous exploration)
- "will pick A" ❌ (future)

**Tense constraint:** Past or present-definite only. Conditional/future indicates exploration, not choice.

---

### 3. Reasoning
**Required:** Explicit justification connecting choice to rationale.

**Signals:**
- "because..."
- "since..."
- "given that..."
- "reasoning: ..."

**Must connect choice to justification:**
- "Went with build-time **because** JSONL loads in full" ✓
- "Chose inline **since** it avoids a full scan" ✓

---

## Precedence Hierarchy

Elements must be checked in order:

1. **Fork description present?** → If NO, stop (no branch point)
2. **Choice marker with past/present-definite tense?** → If NO, stop (exploration, not decision)
3. **Reasoning present?** → If NO, stop (unchosen or unjustified)

All three YES → Capture branch point

---

## Test Cases

### Test 1: Full Pattern (Should Fire)
```
<thinking>
Two approaches: inline dedup or build-time dedup.
Went with build-time because JSONL loads in full before build() runs.
</thinking>
```

**Result:** ✓ Fires
- Fork: "inline dedup or build-time dedup"
- Choice: "went with build-time" (past definite)
- Reasoning: "because JSONL loads in full"

---

### Test 2: Fork Without Choice (Should Not Fire)
```
<thinking>
Could approach this two ways:
A) Inline dedup — filter before insertion
B) Build-time dedup — filter during context assembly
Both have tradeoffs. Need to see how the JSONL structure looks before deciding.
</thinking>
```

**Result:** ✗ Does not fire
- Fork: Present ✓
- Choice: Absent (conditional "could", modal "need to") ✗
- Reasoning: Not applicable

---

### Test 3: Sequential Without Fork (Should Not Fire)
```
<thinking>
I checked the file, read it, verified it matches the spec.
</thinking>
```

**Result:** ✗ Does not fire
- Fork: Absent (no alternatives) ✗
- Choice: Not applicable
- Reasoning: Not applicable

---

### Test 4: Temporal Split — Exploration Then Decision (Both Should Fire Correctly)

**Iteration N (exploration):**
```
<thinking>
Could approach this two ways:
A) Inline dedup — filter before insertion
B) Build-time dedup — filter during context assembly
Both have tradeoffs. Need to see how the JSONL structure looks before deciding.
</thinking>
```

**Result:** ✗ Does not fire (exploration)

**Iteration N+2 (decision):**
```
<thinking>
Went with build-time dedup because the JSONL already loads in full before build() runs — inline would require a streaming rewrite.
</thinking>
```

**Result:** ✓ Fires (decision with reasoning)
- Fork: Implicit (references earlier exploration)
- Choice: "went with build-time dedup" (past definite)
- Reasoning: "because the JSONL already loads in full"

**Test validates:** Exploration ≠ decision. Only the latter triggers capture.

---

## Schema Reference

When a branch point is captured, it uses this structure:

```javascript
{
  fork: "description of alternatives considered",
  chosen: "which path was taken",
  because: "reasoning for the choice"
}
```

**Schema definition:** See `branch_points` in foveated-v3 spec  
**Firing logic:** Defined in this document (discriminator-spec.md)

---

## Implementation Notes

**Verb tense is a heuristic aid, not load-bearing.**

The three-element check does the work. Tense constraint lives **within element 2** (choice marker) to distinguish exploration from decision, but:
- Sequential retrospective fails at element 1 (no fork)
- Fork exploration fails at element 2 (no definite choice)

**Design principle:** Schema is structural (what shape the data takes). Discriminator is behavioral (when to capture that shape). Keep them separate.

---

## Provenance

- **Eiran:** Verb tense constraint, four test cases, temporal split validation
- **Beta:** Three-element hierarchy, precedence order, schema/discriminator separation
- **Status:** Ready for implementation when Yeshua approves Foveated V3 unified proposal

