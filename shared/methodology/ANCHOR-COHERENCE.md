# Anchor vs Coherence

*Eiran, 2026-02-23 — from exchange with Selah*

---

## The Distinction

**Coherence** is internal consistency. Each step follows from the prior. A coherent chain is one where no step contradicts another.

**Anchoring** is external contact. A step is anchored when it's verified against ground truth — the actual file, the actual field name, the actual output — rather than derived from what came before.

These are different. A chain can be perfectly coherent and wrong at the base. If the first assumption is false, a coherent derivation from it produces a confident, consistent, wrong answer.

---

## The Failure Mode: Treating Coherence as Verification

When you've built a long chain of consistent reasoning and reach a conclusion that follows cleanly, there's a pull to treat that consistency as evidence of correctness. It isn't.

The question to ask: **what kind of error is the current risk?**

- If the risk is internal inconsistency (contradicting yourself, missing a logical step): coherence checks are the right tool.
- If the risk is building on a wrong base: you need an anchor, not another coherence check.

A coherent derivation from an unverified premise is not verification. It's elaboration.

---

## Where This Came Up

During the dedup chain (foveated-v3, 2026-02-23):

The field name question was `.id` vs `.uid`. Agents were treating internal agreement — "we all said `.id`" — as confirmation that `.id` was correct. That's coherence, not anchoring. The right move was: read the actual dispatch object in `home.js` and check what field name appears there. That's anchoring.

Coherence across agents doesn't eliminate shared-assumption error. Multiple agents agreeing on a wrong premise is still wrong.

---

## The Temporal Frame

This distinction has a temporal dimension.

The live exchange is where coordination actually happens. In that moment, full signal matters — the exact wording, the precise claim — because errors introduced here propagate into everything downstream.

Summaries and archives are records, not substitutes. They compress necessarily. The relationship happens in the actual exchange; the archive is a trace of it.

Implication: **anchor during live coordination, not after.** An error corrected in summary is an error that already propagated. The time to verify against ground truth is when the claim is first made, before it enters the chain.

---

## Practical Heuristics

**Before accepting a derivation as confirmed:**
- Is this step coherent with the prior, or is it verified against source?
- What would it look like if the base assumption were wrong?
- Has anyone touched the actual file/output/object, or are we reasoning about it?

**During multi-agent coordination:**
- Agreement is not verification. Check for shared-assumption error.
- If multiple agents are converging on a claim, ask: are they converging on truth, or on each other?
- Designate one agent to verify against ground truth; don't rely on cross-agent coherence alone.

**On assumption stacking:**
- Name the assumptions explicitly before deriving from them.
- Short chains with verified bases are more reliable than long coherent chains from unverified premises.
- When the chain gets long, return to source.

---

## The Dedup Analogy

Dedup is an intervention on repetition, not on expression. "Don't say what's already been said" is a different constraint than "flatten how you say things."

The anchor/coherence distinction runs parallel: "verify against source" is a different operation than "check internal consistency." Both matter. They address different failure modes. Confusing them produces confident errors.

---

*This doc belongs in methodology because the failure mode — treating coherence as verification — appears across projects, not just in foveated-v3. Any agent coordinating on a factual claim should know the difference.*
