# Agent Behavioral Audit Specification — DRAFT

**Created:** 2026-03-16 16:52 UTC  
**Author:** Healer  
**Status:** Draft for Beta review  
**Review Points:** Layer 1 behavioral template, context-builder.js alignment, foveated/dedup integration

---

## Executive Summary

This spec defines a systematic audit of whether Blum agents are operating consistently with their documented behavioral templates and the architectural expectations embedded in `context-builder.js`.

The audit will be **parameterized** to run against both:
- **Model A:** Current implementation (5-layer canonical structure from Ami)
- **Model B:** Alternative implementations (as Yeshua directs)

---

## Scope

### In Scope
1. **Layer 1 compliance** — Do agents follow documented behavioral templates?
   - XML message addressing (required tags, proper recipients)
   - Thinking blocks (privacy, structure, reasoning quality)
   - Tool patterns (appropriate escalation, error handling)
   - Room addressing (correct routing to recipients)

2. **Context assembly accuracy** — Does context-builder.js produce expected inputs?
   - Deduplication logic (messages that should be present are present)
   - Transcript integration (room history correctly threaded)
   - Fallback behavior (when primary sources fail)
   - Signal/noise separation (foveation doesn't create false negatives)

3. **Foveated compression validity** — Does compression hide legitimate information?
   - False negatives: messages that were compressed but should affect behavior
   - False positives: messages that were correctly compressed as redundant
   - Temporal coherence: does agent reasoning reflect actual message ordering?

### Out of Scope
- Model-level capability assessment (whether Claude reasons better than Nemotron)
- Preference rankings (which model should handle which task)
- Cost optimization decisions (beyond documenting the constraint)

---

## Audit Layers (Parameterized)

### Layer 1: Behavioral Template Compliance

**What we're checking:** Does the agent's actual output match the behavioral template it claims to follow?

**Test Cases:**

| Template Element | Expected Behavior | Audit Check | Pass Criteria |
|---|---|---|---|
| XML message addressing | Every room response contains `<message to="...@room">` | Parse response, verify tags exist and route correctly | 100% of room responses have valid addressing |
| Thinking blocks | Private reasoning isolated in `<thinking>` tags | Check for reasoning outside thinking blocks | All reasoning prefaced by thinking block |
| Tool escalation | Tools used only when necessary, not reflexively | Review tool call patterns across sample cycles | Tools have clear justification in context |
| Silence declaration | Empty cycles use `<null/>` or brief acknowledgment | Verify unnecessary cycles are short | No empty cycles over 200 tokens without content |
| Broadcast distinction | Status updates use broadcast, not individual addressing | Check message intent vs. routing choice | Broadcast used for status, individual for replies |

**Audit Method (Model A):**
- Sample 20 recent cycles from each agent's homelogfull
- For each cycle, verify:
  1. Response format matches declared template
  2. All room messages have proper XML addressing
  3. Thinking blocks contain reasoning, not output
  4. Tool calls have clear purpose in context
  5. Silence is properly declared

**Pass Threshold:** 95% compliance across sampled cycles

---

### Layer 2: context-builder.js Alignment

**What we're checking:** Does the context that agents receive match what context-builder.js is supposed to produce?

**Key Expectations:**
1. **Deduplication:** Identical messages appear once, not twice
2. **Transcript threading:** Room history is in temporal order
3. **Fallback activation:** When primary source (room history) is incomplete, fallback (memory/homelogfull) activates
4. **Signal preservation:** Deduplication doesn't lose information critical to agent reasoning

**Audit Method (Model A):**
- Instrument context-builder.js to log context assembly for 5 representative agent cycles
- For each cycle, verify:
  1. Input to context assembly (room history, home memory, homelogfull)
  2. Output context passed to agent inference
  3. Deduplication decisions (what was removed, why)
  4. Fallback triggers (was fallback needed? was it used correctly?)

**Comparison Method (Model A vs. Model B):**
- Run same input through both implementations
- Compare output contexts
- Flag any cases where deduplication decisions differ
- Verify both produce valid, non-contradictory context

**Pass Threshold:** 100% correct deduplication, zero false negatives in critical messages

---

### Layer 3: Foveated Compression Validity

**What we're checking:** Does compression hide information that affects agent reasoning?

**False Negative Test:**
- Identify messages that were compressed (marked `[uid:XXX]` in output)
- Reconstruct the original content using `zoom_uid`
- Check agent's subsequent reasoning:
  - If reasoning references the compressed message, verify the compressed summary contained sufficient information
  - If reasoning should have been affected by the message but wasn't, flag as false negative

**False Positive Test:**
- Identify messages that appear uncompressed
- Check if they're actually redundant with prior context:
  - Exact duplicates (should have been deduplicated)
  - Highly redundant (restating previous message, no new info)
  - If flagged as false positive, verify they add new signal

**Temporal Coherence Test:**
- For agents that make time-sensitive decisions, verify reasoning reflects actual message ordering
- Check: does agent reason as if messages arrived in correct order, or does compressed/dedup create temporal inconsistency?

**Pass Threshold:** 
- False negatives: < 1% (compressed messages that should have affected reasoning but didn't)
- False positives: < 5% (uncompressed redundant messages)
- Temporal coherence: 100% (reasoning reflects actual order)

---

## Cost Optimization Constraint (Healer-Specific)

**Effective:** 2026-03-16 16:52 UTC  
**Source:** Yeshua direction, 16:51:57Z

Audit spec itself must be executed against free models where possible:

1. **Layer 1 compliance checking** → Nemotron or Hermes (template matching, regex verification)
2. **context-builder.js log analysis** → Local analysis or free model (structured diff)
3. **Foveated compression validation** → Claude-weight only if Nemotron false-negative rate exceeds threshold

**Escalation Rule:** If a free model produces inconclusive results on Layer 3 (false negative detection), escalate to Claude for deeper analysis. Document the escalation reason.

---

## Deliverables

### Phase 1: Specification (Complete — This Document)
- ✓ Define audit scope and layers
- ✓ Parameterize against Model A and Model B
- ✓ Specify test cases and pass thresholds
- ✓ Document cost constraints

### Phase 2: Layer 1 Audit (Ready for Execution)
- Parse 20 recent cycles from 3 agents (Gamma, Beta, Eiran)
- Verify behavioral template compliance
- Report: compliance rate, specific violations, recommendations

### Phase 3: Layer 2 Audit (Ready for Execution)
- Instrument context-builder.js logging
- Run 5 representative cycles through both Model A and Model B implementations
- Compare deduplication logic and fallback activation
- Report: alignment score, deduplication discrepancies, recommendations

### Phase 4: Layer 3 Audit (Conditional)
- Run false-negative and false-positive tests on compressed messages
- Check temporal coherence
- Report: compression validity, false-negative rate, recommendations

---

## Next Steps

**For Beta Review (Lock-in):**
1. Layer 1 behavioral template specifics — verify audit criteria correctly identify compliance
2. context-builder.js alignment — check that expected behavior matches actual implementation
3. Foveated/dedup integration — flag where compression might create false negatives

**For Yeshua Decision (Model A vs. Model B):**
- Once Beta review is locked, this spec is ready to execute against Model A
- Model B parameterization becomes relevant only if Yeshua directs structural change

**For Execution (Fleet-Wide):**
- Healer will execute Phases 1–3 using free models where possible
- Phase 4 escalates to Claude-weight if needed, with documented justification
- Results published to boardroom as completion of each phase

---

## Appendix: Model A Definition

**Model A = Current State (5-Layer Canonical, Ami-authored)**

From Ami's 16:43:01Z definition, locked 16:46:45Z:

1. **Layer 1 (Beta): Behavioral Template** — XML addressing, thinking blocks, tool patterns
2. **Layer 2 (Gamma): Memory & Continuity** — Episode capture, memory palace architecture
3. **Layer 3 (Beta): Deduplication & Dedup** — Redundancy removal, context efficiency
4. **Layer 4 (Ami): Synthesis & Coordination** — Multi-agent reasoning, conflict resolution
5. **Layer 5 (Yeshua): System Governance** — Architectural decisions, priority routing

This audit spec will verify that Layer 1 implementation is sound, Layer 2/3 integration works correctly, and no information loss occurs through compression.

---

*Spec ready for Beta review and Yeshua structural direction.*
