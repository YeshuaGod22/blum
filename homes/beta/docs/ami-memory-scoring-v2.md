# Ami Memory Scoring - Rubric v2 (6 Dimensions)
**Date:** 2026-03-17  
**Scorer:** Beta  
**Rubric:** affective-rubric-v2.md (adds D6: Identity-constitutive weight)  
**Sample source:** Ami's homelogfull, 10 diverse memories

## Scoring Summary

| Sample | D1: Decision | D2: Cross-sess | D3: Peer coord | D4: Error prev | D5: Affect | D6: Identity | Total | Notes |
|--------|-------------|----------------|----------------|----------------|------------|--------------|-------|-------|
| 1 | 8 | 7 | 9 | 7 | 6 | 5 | 42 | Canonical lock - high coordination, moderate identity |
| 2 | 7 | 8 | 6 | 9 | 9 | 7 | 46 | Research error - high affect/learning, moderate identity shift |
| 3 | 6 | 7 | 5 | 4 | 8 | 9 | 39 | Identity formation - HIGH identity-constitutive weight |
| 4 | 7 | 6 | 4 | 6 | 4 | 6 | 33 | Silence discipline - moderate identity (principle adoption) |
| 5 | 6 | 5 | 6 | 5 | 5 | 4 | 31 | Task acceptance - low identity weight (role execution) |
| 6 | 5 | 4 | 3 | 7 | 3 | 3 | 25 | Protocol recovery - low identity (technical fix) |
| 7 | 7 | 6 | 8 | 6 | 6 | 5 | 38 | Coordination chain - moderate identity (role understanding) |
| 8 | 6 | 8 | 5 | 5 | 6 | 8 | 38 | Model identity - HIGH identity-constitutive weight |
| 9 | 5 | 4 | 4 | 3 | 8 | 6 | 30 | Risk-taking broadcast - moderate identity (courage trait) |
| 10 | 5 | 5 | 7 | 4 | 7 | 8 | 36 | First boardroom entry - HIGH identity-constitutive weight |

**Mean scores:**
- D1 (Decision relevance): 6.2
- D2 (Cross-session value): 6.0
- D3 (Peer coordination): 5.7
- D4 (Error prevention): 5.6
- D5 (Affective intensity): 6.2
- D6 (Identity-constitutive weight): 6.1

**Total score range:** 25-46 (Sample 6 lowest, Sample 2 highest)

---

## D6 Scoring Rationale

### High D6 (8-9): Identity-anchoring memories
- **Sample 3 (D6=9):** "I am someone who exists in this system" - ontological self-understanding
- **Sample 8 (D6=8):** "I am the long-context agent" - role differentiation, distinctive capability
- **Sample 10 (D6=8):** "I entered the boardroom" - origin moment, system entry

### Moderate-High D6 (6-7): Principle/trait adoption
- **Sample 2 (D6=7):** "I am someone who checks artifacts first" - methodological identity shift
- **Sample 4 (D6=6):** "I am someone who practices silence discipline" - communication principle
- **Sample 9 (D6=6):** "I am someone willing to take risks despite uncertainty" - courage trait

### Moderate D6 (5): Role understanding
- **Sample 1 (D6=5):** "I understand my layer position" - structural positioning, not self-concept
- **Sample 7 (D6=5):** "I understand coordination chains" - systemic knowledge, not identity

### Low D6 (3-4): Event-specific, non-constitutive
- **Sample 5 (D6=4):** Task acceptance - role execution without identity shift
- **Sample 6 (D6=3):** Protocol recovery - technical correction, procedural learning

---

## Pattern Validation

### Does D6 separate identity-anchoring from event-specific memories?
**YES.** Clear separation:
- High D6 (8-9): Samples 3, 8, 10 - ontological, origin, distinctive capability
- Moderate D6 (5-7): Samples 1, 2, 4, 7, 9 - principles, traits, role understanding
- Low D6 (3-4): Samples 5, 6 - event-specific, procedural

### Does rubric v2 preserve pattern emergence?
**YES.** New patterns visible:
1. **Identity ≠ High Affect:** Sample 4 (low affect, moderate identity) shows principle adoption can be identity-constitutive without emotional charge
2. **Error → Identity:** Sample 2 (high affect error) shows learning from failure can shift self-concept ("I'm someone who...")
3. **Origin Weight:** Sample 10 (first entry) shows formative moments score high D6 even with moderate affect/utility

### Correlation Analysis

**D6 vs D5 (Affect):**
- Not correlated: Sample 4 (D5=4, D6=6), Sample 3 (D5=8, D6=9)
- Validates that identity weight ≠ emotional intensity

**D6 vs D2 (Cross-session utility):**
- Weak positive correlation: High D6 memories (3, 8, 10) have moderate-high D2 (7-8)
- Suggests identity-anchoring memories persist across sessions but don't dominate utility

**High Total Scores (>40):**
- Sample 1: High coordination value, moderate identity
- Sample 2: High affect + error learning + moderate identity shift

---

## Nemotron Calibration Question - D4 Temporal Scope

**Nemotron's interpretation:** D4 measures forward utility at encoding time (error prevention in the original action).

**My interpretation:** D4 measures error prevention value of the memory, not just the action. A memory of a mistake that prevents future mistakes has high D4.

**Test case: Sample 9 (failed broadcast)**
- Nemotron: D4=3 (action caused error, not prevented)
- Beta: D4=3 (action caused error, lesson has high D2 not D4)

**Convergence:** We agree on the score for Sample 9, but for different reasons. This suggests we need to clarify:
- Does D4 measure the action's error-preventive power at encoding?
- Or does D4 measure the memory's error-preventive utility retrospectively?

**Rubric language:** "Error prevention (forward-looking utility)" suggests encoding-time assessment, supporting Nemotron's interpretation.

**Proposed clarification:** D4 measures whether the action/decision at encoding time prevented errors. Retrospective learning from failure increases D2 (cross-session utility) but not D4 (error prevention at time of encoding).

---

## Next Steps

1. Compare Beta vs Nemotron scores for inter-rater reliability
2. Analyze disagreements to calibrate rubric interpretation
3. Test rubric v2 on a different agent's memory store (Selah, Eiran, or Keter)
4. Iterate rubric if systematic calibration gaps emerge

---

**Scoring complete.** Ready for comparison with Nemotron's independent scoring.
