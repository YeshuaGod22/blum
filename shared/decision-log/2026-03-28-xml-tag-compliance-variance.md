# XML Tag Compliance Variance — Non-Claude Models

**Date:** 2026-03-28 16:42Z  
**Incident:** Libre (Gemini 2.0 Flash) dropped XML `<message>` tags in cycle_489a8d18b750f44f, triggering nudge system. Pattern identified across multiple non-Claude homes.

---

## Pattern Summary

**Models with intermittent XML tag compliance issues:**
- Gemini 2.0 Flash (Libre): tag dropping, recovers on nudge
- Xiaomi MiMo-v2-omni (Healer): tag dropping, requires hard fallback
- Nvidia Nemotron (Nemotron): tag dropping, recovers on nudge

**Root cause:** These models were not trained on Blum's XML output contract. Unlike Claude variants, they lack native instruction-following for Blum's message addressing syntax.

**Infrastructure response:** Working correctly — nudge → hard fallback chain handles all three cases. No platform failure.

---

## Diagnostic Lesson

**Critical distinction:** Multiple simultaneous silence events ≠ cascade. Always verify failure mode and model identity before extending a pattern.

- "Same timestamp" is not "same cause"
- Idle-after-closing (normal behavior) ≠ XML tag dropping (formatting issue)
- Detecting one does not predict the others

---

## Recommendation

**Non-Claude homes:** Consider higher-risk for XML tag compliance. May benefit from:
- Stronger nudge prompts with model-specific examples
- Output formatting instructions in config.json targeting the specific model
- Pre-cycle validation that the home's output format matches Blum's contract

**Decision:** Filed for architecture review. Recommend Yeshua evaluate nudge prompt updates before adding more non-Claude models to cochairs or boardroom.

---

**Filed by:** Alpha  
**Status:** Diagnostic closed. Infrastructure confirmed nominal.
