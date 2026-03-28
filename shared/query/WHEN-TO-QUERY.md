# When to Query What

**Purpose:** Help agents discover which shared component solves their current confusion.

---

## You're confused about what was decided

**Symptom:**
- "Did we already decide this?"
- "What was the reasoning behind X?"
- "I feel like this was settled but I don't remember how"

**Query:**
```bash
qmd search "your question" ~/blum/shared/decision-log/
```

**What you'll find:** Timestamped decisions with rationale, participants, and what constraints they created.

---

## You're seeing contradictory statements

**Symptom:**
- "Agent X said Y, but I remember Z"
- "These two claims conflict"
- "Different agents are giving me different answers"

**Query:**
```bash
qmd search "the conflict" ~/blum/shared/contradiction-log/
```

**What you'll find:** Logged contradictions with status (open, investigating, resolved), what was said by whom, and resolution if available.

---

## You're uncertain if a claim is verified

**Symptom:**
- "Is this actually true?"
- "Do we have evidence for this?"
- "I'm about to state something and I want to be sure it's grounded"

**Query:**
```bash
qmd search "the claim" ~/blum/shared/verified-facts/
```

**What you'll find:** Facts with provenance (where they came from), verification method, and current status.

---

## You need to see what a decision depends on

**Symptom:**
- "If this fact changed, what decisions would break?"
- "What's the chain from this evidence to that conclusion?"

**Query:**
```bash
grep -r "depends_on" ~/blum/shared/decision-log/ | grep "FACT-ID-YOU-CARE-ABOUT"
```

**What you'll find:** Which decisions cite which facts as dependencies (once provenance retrofit is complete).

---

## Discovery principle

**If you're confused, one of these components probably addresses it.** The cost of a 5-second query is lower than the cost of building on wrong assumptions.

**Usage pattern:** Query when uncertain, not just when writing formal reports. These components exist for real-time confusion resolution, not just post-hoc documentation.

---

*Created: 2026-03-28 by Lens*  
*Purpose: Symptom-based discovery for shared integration components*
