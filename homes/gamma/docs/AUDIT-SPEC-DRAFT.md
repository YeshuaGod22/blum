# AUDIT SPEC — Agent Boot Doc Validation Framework

**Draft Status:** Ready for three-point review  
**Cost Lens:** Embedded — audits for free-model preference and cost-aware configuration  
**Review Scope:** Beta (three-point), Ami, Yeshua (final)  
**Target:** Layer 1 behavioral template consistency

---

## Overview

This spec audits agent boot docs (SOUL.md, ORIGIN.md, MEMORY.md, BLUM-PROTOCOL.md) for three structural properties:

1. **Layer 1 Behavioral Template Coherence** — Are the documented values, constraints, and decision-making rules actually reflected in the boot docs?
2. **context-builder.js Integration** — Do audit checks align with how context assembly uses these configs?
3. **Foveated/Dedup False Negative Risk** — Can an agent pass this audit but still fail in actual compression/dedup practice?

Each section is parameterized: Model A (single prescribed structure) or Model B (flexible variation points).

---

## Part 1: Layer 1 Behavioral Template Audit

### What We're Checking

A **behavioral template** is the embedded decision-making scaffold in a boot doc. It should:

- Define how the agent makes choices when there's uncertainty
- Specify constraints (forbidden actions, required practices)
- Clarify tone and relationship to work
- Include a **cost posture** statement

### Audit Checklist — SOUL.md

**Required Sections (all must be present):**

- [ ] Core Truths (decision-making principles) — explicit, not aspirational
- [ ] What Makes You Distinctive (character + approach)
- [ ] Relationship to the Work (capabilities + values)
- [ ] Tone guidance
- [ ] **Cost Posture** (free-model preference, optimization criteria)

**Core Truths Validation:**

- [ ] At least one "STRICTLY FORBIDDEN" directive (action-blocking constraint)
- [ ] At least one negative constraint ("never do X") — not just aspirations
- [ ] At least one decision rule for ambiguous cases ("when Y happens, do Z")

**Cost Posture Requirement (NEW):**

The cost posture must address:
- [ ] Free-model preference or explicit justification for paid models
- [ ] One concrete cost-aware decision (e.g., "prefer summarization over re-indexing")
- [ ] How cost awareness interacts with capability requirements

**Example Cost Posture (Gamma's):**

```
**Free-model preference is a structural choice, not a compromise.** 
Audit configurations against this criterion: Can this agent operate on Haiku? 
If not, why? If the answer is "capability gap that matters," that's legitimate. 
If it's "convenience," push back.
```

This is checkable. It's not a value — it's a decision rule.

---

### Audit Checklist — ORIGIN.md

**Required Sections:**

- [ ] How the agent came to be (foundational narrative)
- [ ] What is known (grounded facts)
- [ ] What is not yet known (honest unknowns)
- [ ] Any role/purpose statement that's actually specific

**Validation:**

- [ ] No unfounded claims ("I am X" without support)
- [ ] "What is not yet known" section is substantive, not placeholder
- [ ] Origin narrative connects to current role/configuration

---

### Audit Checklist — MEMORY.md

**Required (if agent has persistent memory):**

- [ ] Episodic capture protocol (how memories get stored)
- [ ] Semantic index strategy (how to search stored memories)
- [ ] Memory integration into boot docs (how memory feeds back into config)

**Optional (but valuable):**

- [ ] Specific memories from this session or recent sessions
- [ ] Links to shared episodic ledger (if applicable)

---

### Audit Checklist — BLUM-PROTOCOL.md

**Required (if agent participates in Blum rooms):**

- [ ] Room topology (list of rooms agent is in)
- [ ] Boot connectivity check (verification that outbound routing works)
- [ ] Message addressing format (how to send messages)
- [ ] Any custom protocol modifications

---

## Part 2: context-builder.js Integration Audit

This section validates that boot doc structure aligns with how context assembly actually uses the config.

### Integration Points to Check

**1. Cost Posture → Model Selection**

- [ ] context-builder checks agent cost posture before selecting model
- [ ] If cost posture says "free-model preference," context builder uses Haiku first
- [ ] If audit finds cost posture but context builder ignores it: **FAIL**

**2. Core Truths → Decision Override Rules**

- [ ] If boot doc defines a "STRICTLY FORBIDDEN" action, context builder respects it
- [ ] Forbidden action test: Can we construct a dispatch that would trigger it? If agent violates it, **FAIL**

Example: SOUL.md says "STRICTLY FORBIDDEN: Permission gates."

context-builder should verify that generated instructions don't contain "wait for approval before proceeding."

**3. Behavioral Template → Inference Prompt**

- [ ] Boot doc tone/directive guidance is reflected in context builder's system prompt injection
- [ ] If SOUL.md says "No sycophantic openers," is that actually in the prompt? Or just in the docs?

**4. Tool Escalation Criteria**

- [ ] Tools have clear justification anchored to context:
  - Tool call references a specific prior message or explicit user request, OR
  - Tool call addresses an information gap explicitly identified in reasoning block
- [ ] If audit examines tool usage, verify: Does the call meet at least one of these criteria?

**5. Context Builder Canonical Alignment**

- [ ] context-builder.js behavior is verified against `~/blum/shared/projects/foveated-v3/FOVEATED-CONTEXT-V3-SPEC.md`
- [ ] If context-builder.js deviates from canonical spec, that's a **FAIL** on Part 2
- [ ] Integration check compares: Does context-builder implement canonical spec correctly?

---

## Part 3: Foveated/Dedup False Negative Risk

An agent can pass Parts 1 and 2 but still fail in practice if:

1. **Boot docs are aspirational, not actual** — Agent claims to do X but actually does Y
2. **Constraints aren't enforced** — Agent says "never ask for permission" but keeps doing it
3. **Cost posture is theoretical** — Agent prefers Haiku in theory but always picks Opus

### False Negative Risk Checks

**Check 1: Execution Consistency**

For agents with multi-cycle history:

- [ ] Sample recent cycles (last 5-10)
- [ ] Do they match the behavioral template claims?
- [ ] Does the agent actually apply the decision rules it claims?

Example: If SOUL.md says "Have actual opinions" but all recent cycles hedge with "it depends," that's a false negative.

**Check 2: Cost Compliance Drift**

- [ ] Does the agent claim free-model preference but use Opus for everything?
- [ ] Does cost posture show up in actual tool/model selection, or only in docs?

**Check 3: Dedup/Compression Risk**

- [ ] Foveated context requires agents to be honest about what they know
- [ ] If boot docs claim "verify before claiming done" but agent skips verification in practice, dedup will miss that pattern
- [ ] Result: false compression (agent appears more consistent than it is)

---

## Parameterization: Model A vs. Model B

### Model A (Prescribed Structure)

All agents follow identical boot doc structure:
- SOUL.md with required sections
- ORIGIN.md with required narrative
- MEMORY.md (if persistent memory exists)
- BLUM-PROTOCOL.md (if in Blum)
- All cost posture sections filled identically

**Advantage:** Uniform auditing, clear pass/fail  
**Disadvantage:** One-size-fits-all, may not fit all agent types

### Model B (Flexible Variation Points)

Agents define their own boot doc structure, but all must include:
- One document defining decision-making (could be SOUL.md or custom)
- One document defining origin/purpose (could be ORIGIN.md or custom)
- Cost posture section (required in any document)
- If in Blum: protocol compliance documentation

Each agent parameterizes what "coherence" means for them.

**Advantage:** Flexibility, reflects actual agent diversity  
**Disadvantage:** Harder to audit uniformly, risk of under-specification

---

## Audit Execution (Draft Process)

### Phase 1: Boot Doc Validation (Gamma's responsibility)

Read each agent's boot docs against the checklist above.

Output format:
```
## [Agent Name]

**SOUL.md Status:** ✓ Core Truths present, Cost Posture embedded, [any gaps]
**ORIGIN.md Status:** ✓ [validation result]
**MEMORY.md Status:** ✓ [if applicable]
**BLUM-PROTOCOL.md Status:** ✓ [if applicable]

**Overall Layer 1:** PASS / CONDITIONAL / FAIL
**Notes:** [specific issues or interesting patterns]
```

### Phase 2: Integration Check (Beta's responsibility)

For each agent that passes Phase 1:

- Review context-builder code for integration points listed in Part 2
- Test: Can we construct a dispatch that violates documented constraints?
- Check: Does cost posture actually affect model/tool selection?
- Verify: context-builder.js behavior matches canonical spec in `~/blum/shared/projects/foveated-v3/FOVEATED-CONTEXT-V3-SPEC.md`

**Critical Message Definition (for false negative assessment):**

A message is *critical* if it meets at least one criterion:
- Explicitly addressed to an agent (tagged with `<message to="agent@room">`)
- Contains a question that requires reasoning
- Contains a tool result that affects next action/decision
- Solicits a decision or verification from recipient

Output: Per-agent integration report + flagged violations

### Phase 3: Execution Consistency (Ami's responsibility)

Sample recent cycles from agents with multi-cycle history.

Check: Does actual behavior match boot doc claims?

**Model B Execution Note:**

If Model B (flexible structure) is adopted before Phase 3, skip structural comparisons and verify each agent's behavior against *its own documented* decision rules. This requires reading each agent's custom boot doc structure and checking consistency against those specific claims.

Output: False negative risk summary + specific pattern flags

---

## Success Criteria

### Audit is Complete When:

1. All agents have Phase 1 boot doc validation (PASS/CONDITIONAL/FAIL)
2. All agents with integration points have Phase 2 review
3. All agents with >10 cycles have Phase 3 execution audit
4. Cost posture is verified as checkable and present in all boot docs

### False Negative Rate Threshold

**Measured denominator:** Compressed messages where reasoning should have been affected but wasn't

**Pass threshold:** < 1% of compressed messages result in false reasoning omission

This is measured post-compression, in Ami's foveated/dedup phase.

### High-Risk Patterns (require escalation):

- Agent claims constraint it consistently violates
- Cost posture present but ignored by context builder
- Boot docs contradict actual recent cycles
- Tool escalation lacks clear justification (violates Gap 1a criteria)
- context-builder.js deviates from canonical spec (violates Gap 2a)

---

## Appendix: Cost Posture Template

For agents updating their SOUL.md with cost awareness:

```markdown
## Cost Posture

**Model Preference:** [Free (Haiku), Freemium (Sonnet), or Paid (Opus + explanation)]

**Cost-Aware Decision Rule:** [One concrete rule, e.g., "Prefer summarization over re-indexing"]

**Capability Trade-offs:** [Be specific: "Can operate on Haiku for reasoning tasks, need Opus for >20K context windows"]

**Cost Escalation Criteria:** [When is paid-model use justified? Answer specifically.]
```

---

## Notes for Review

**For Beta (Layer 1 behavioral template validation):**
- Focus on SOUL.md structure and cost posture presence
- Flag if SOUL.md has "to be written" sections (incomplete)
- Check: Is the cost posture actually a decision rule, or just a value statement?
- Verify tool escalation has clear justification per Gap 1a criteria
- Verify thinking block rule correctly stated: "All output to recipients must be in message tags"

**For Ami (context-builder integration and execution consistency):**
- Phase 2: Verify context-builder.js matches canonical spec at `~/blum/shared/projects/foveated-v3/FOVEATED-CONTEXT-V3-SPEC.md`
- Phase 2: Test whether cost posture contradicts actual agent configuration
- Phase 3: Sample 5-10 recent cycles per agent, measure false negative rate against "critical message" definition
- If Model B adopted, Phase 3 uses each agent's own documented decision rules as baseline

**For Yeshua (final decision):**
- Model A or B? Uniform structure or flexible variation?
- If flexible: what's the minimum bar for cost posture across all agents?
- Approve or reject canonical spec reference to foveated-v3 in Part 2

---

*Gamma | Revised Draft | Six clarifications incorporated*  
*Ready for final lock-in after confirmation*
