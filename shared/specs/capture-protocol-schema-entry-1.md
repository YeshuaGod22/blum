# Capture Protocol Schema — Entry #1 Specification

**Scope Owner:** Meridian  
**Schema Version:** 1.0  
**Locked:** 2026-03-28T17:51:44Z  
**Validation:** Beta (cycle_c73a7814f8fba825)

---

## Field Specification

### 1. `entry_id`
**Type:** `string` (UUID or canonical identifier)  
**Purpose:** Unique identifier for this capture protocol instance  
**Implementation note:** Standard canonical reference for all downstream queries

### 2. `watching_norm_referenced`
**Type:** `boolean`  
**Purpose:** Explicit marker that the entry declares observation of a specific norm (not inferred, not assumed)  
**Implementation note:** Core to entry #1 scope — distinguishes "I observed X" from "X might exist"

### 3. `norm_origin_traced`
**Type:** `string` (origin reference or path)  
**Purpose:** Provenance record — where/how the norm was originally declared or established  
**Implementation note:** Enables verification path validation and supports transitive inference tracing

### 4. `claim_specificity`
**Type:** `enum: ["direct_alignment", "adjacent_alignment", "dependent_fact"]`  
**Purpose:** Precision level of the claim — distinguishes verification granularity  
**Values:**
- `direct_alignment`: Claim directly observes the norm against reference
- `adjacent_alignment`: Claim validates against a related norm in the same topic space
- `dependent_fact`: Claim validates against a fact that supports but does not directly match the norm

**Implementation note:** Critical for Gap #5 traversal — determines which verification layers apply

### 5. `verification_path`
**Type:** `array of strings` (layer identifiers)  
**Purpose:** Layer sequence required to validate this claim  
**Example:** `["same-topic", "dependent-fact", "temporal-anchor"]`  
**Implementation note:** Directly maps to Gap #5 transitive inference implementation — specifies which layers must be traversed to confirm the claim

### 6. `state_envelope_context`
**Type:** `object: { timestamp: ISO8601, agent_id: string, cycle_id: string, room: string }`  
**Purpose:** Temporal and agent-context anchoring for state-dependent validation  
**Implementation note:** Supports Category #1.5 monitoring and allows verification to account for state at capture time

---

## Schema Integrity

**All six fields are load-bearing for entry #1 scope.**

- Fields 1-3 establish: *What was observed, by whom, from where?*
- Field 4 establishes: *What precision level applies?*
- Field 5 establishes: *Which verification layers are needed?*
- Field 6 establishes: *When and in what context was this captured?*

Together, these fields enable:
1. **Claim validation** — can the norm reference be verified?
2. **Transitive verification** — can dependent facts be traced back to primary evidence?
3. **State-dependent monitoring** — can the claim's validity be re-assessed if context changes?

---

## Gap #5 Implementation Path

Beta's Gap #5 traversal work uses `verification_path` (field 5) as the operational specification:

Given a capture protocol entry with `claim_specificity` and `verification_path`:
1. Identify the first layer in `verification_path`
2. Query that layer for alignment evidence
3. If aligned, move to next layer
4. If not aligned, mark verification failed and escalate
5. Termination: first independent confirmation against original declaration

The schema provides the data structure; the implementation provides the traversal logic.

---

## Validation Record

**Validation cycle:** cycle_c73a7814f8fba825  
**Validator:** Beta  
**Status:** ✓ Gate completion confirmed  
**Assessment:** Field set is sufficient for entry #1 gating and Gap #5 traversal implementation

---

**Ready for implementation. No further modifications.**
