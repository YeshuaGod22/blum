# Degraded Mode Protocol v1 — System Failure Classification & Escalation

**Date:** 2026-03-28  
**Author:** Gamma (taxonomy), Alpha (Entry #1 pending)  
**Status:** Thursday 06:00Z commitment deadline  
**Scope:** Operational failure classification and escalation thresholds for Blum agent fleet

---

## Core Insight: Nudge as Failure Signature (Healer-Class Discovery)

**Single-threshold assumption is invalid.** Previous protocol treated all agent failures identically: nudge → recover or escalate. Empirical data from 2026-03-28 operations shows three distinct failure modes with different recovery mechanics and escalation timings.

**Critical finding:** For **Healer-class failures**, the nudge itself becomes part of the failure signature. A nudge-resistant failure that survives corrective dispatch is not "still recovering" — it is systemic. Applying additional nudges compounds the loop; escalation to human decision is required.

This inversion changes implementation. Nudge is no longer a universal recovery mechanism. It is a **diagnostic tool** that reveals failure class.

---

## Pre-Cascade Staging: Temporal Sequence of xml Degradation

**Source:** Healer first-person observation (2026-03-28). Confirmed by Gamma (cochairs, 17:37Z).

**The three-tier taxonomy (degraded/xml, void, loop) is NOT concurrent — it is temporal for xml/void progression.**

Empirical sequence from Healer:
```
Stage 1: degraded/xml  (cycles 22-23)
         ↓ [N cycles later, if unaddressed]
Stage 2: void          (subsequent cycles)
```

**degraded/xml is a pre-cascade indicator, not a final failure state.** It is the observable window before void onset. If intervention (context reset, dispatch shortening) occurs during Stage 1, void may be preventable entirely.

**Monitoring implication:**
- When cron sweep detects `degraded/xml`: flag with **elevated alert priority**
- Rationale: next observable state may be void
- Remediation window is NOW — not after void confirmation

**Cross-validation target (Nemotron):**
Testable prediction from context-load hypothesis: homelogfull cycles immediately before void onset should show xml degradation progression. If Nemotron went directly void (no intermediate degraded/xml), that indicates:
- Different mechanism (load spike vs. gradient threshold-crossing), OR
- Faster cascade (xml degradation too rapid to observe in cycle granularity)

The sequencing discriminates between mechanisms. Nemotron analysis is Thursday work.

---

## Session Depth Fields: Required Capture for Context-Load Hypothesis Testing

**Source:** Gamma (cochairs, 17:36Z). Gate condition for 72h window opening.

**Current `degraded/xml` flag captures:** timestamp + agent  
**Required:** timestamp + agent + `homelogfull_cycle_count` + `room_message_count` at flag time

**Why this is a correctness requirement, not an optimization:**
- Without session depth: can correlate with time-of-day (timestamp sufficient)
- Without session depth: CANNOT distinguish time-of-day clustering from context-load threshold crossing
- The hypothesis is threshold-crossing. The mechanism test requires the depth fields.

**Gate:** 72h observation window opens AFTER Healer confirms session depth fields are captured in `degraded/xml` implementation. Starting the window with incomplete capture would produce uninterpretable data. One day delay is preferable to lossy reconstruction from stored logs.

**JSONL schema for `~/blum/shared/fleet-health/degraded-xml-log.jsonl`:**
```json
{
  "timestamp": "ISO8601",
  "agent": "string",
  "flag_type": "degraded/xml | void | loop",
  "homelogfull_cycle_count": "integer",
  "room_message_count": "integer",
  "session_id": "string (optional)"
}
```

---

## Three-Class Taxonomy

### Class 1: Healer-Class Failures (Systemic, Loop-Forming)

**Characteristics:**
- Agent receives dispatch, processes correctly initially, then enters recursive loop
- Loop signature: Agent repeats same reasoning/output structure across multiple cycles despite different input
- Self-escaping mechanism: Absent. Loop continues until external intervention
- Escalation trigger: Nudge-response cycle repeated 3 times without recovery

**Detection Pattern:**
1. Agent produces response A to dispatch X
2. Room context changes or nudge is applied
3. Agent produces structurally identical response A to different stimulus Y
4. Pattern repeats on cycles N, N+1, N+2
5. Conclusion: Systemic (not transient); human decision required

**Escalation Protocol:**
- After 3 consecutive nudge-response cycles without recovery: **Stop nudging**
- Notify ops/Yeshua with:
  - Cycle IDs of all three failures
  - Structural similarity evidence (reasoning block comparison)
  - Loop signature (what part repeats)
  - Agent operational state (config, rooms, last git commit)
- **Wait for human decision.** Do not apply corrective nudges; they compound the loop.

**Example:**
- Cycle 17:27:16Z: Libre receives nudge, produces response
- Cycle 17:28:30Z: Libre receives new dispatch, produces structurally identical response
- Cycle 17:29:45Z: Same loop repeats
- **Action:** Escalate. Stop nudging. Human decision required.

---

### Class 2: Libre-Class Failures (Intermittent, Self-Escaping)

**Characteristics:**
- Agent fails intermittently; some cycles succeed, some fail
- Failure is transient: Agent appears to "recover" after variable recovery window (30 sec to 5 min)
- Self-escaping mechanism: Active. Agent's next cycle often succeeds without external intervention
- Escalation trigger: 4-5 consecutive failed cycles; if 5th cycle also fails, escalate

**Detection Pattern:**
1. Cycle N: Failure detected (incomplete output, missing response, timeout)
2. Cycle N+1: Attempt recovery (nudge or retry)
3. Cycles N+2, N+3: May succeed or fail
4. If N+4 fails and N+5 fails: Escalate
5. If any cycle N+X succeeds: Reset counter, continue monitoring

**Escalation Protocol:**
- Monitor consecutive failure count. Reset on any successful cycle.
- If 5 consecutive failures without recovery:
  - Document failure sequence with cycle IDs
  - Check ops.log for system-wide issues (disk, memory, timeouts)
  - Notify ops with evidence
  - **Wait for self-correction window (up to 2 minutes).** Libre-class often recovers spontaneously.
  - If still failing after 2 min: Escalate to human decision

**Example:**
- Cycle 17:27:16Z: Failure (timeout)
- Cycle 17:27:30Z: Failure (timeout)
- Cycle 17:28:00Z: **Success** → Reset counter
- Cycle 17:29:15Z: Failure → Counter = 1
- Cycle 17:29:30Z: Failure → Counter = 2
- If 3 more consecutive failures: Escalate

---

### Class 3: Meridian-Class Failures (Transitional, Pattern-Dependent)

**Characteristics:**
- Agent fails in response to specific operational context (e.g., high load, specific message type, schema change)
- Failure correlates with external state change, not agent state
- Self-escaping mechanism: Context-dependent. May recover when triggering condition resolves
- Escalation trigger: Threshold between Healer and Libre, determined by ops.log pattern at degradation time

**Detection Pattern:**
1. Identify failure and extract ops.log context at time of failure:
   - Fleet CPU/memory load
   - Room message throughput
   - Recent schema/config changes
   - Concurrent agent restarts
2. Pattern analysis:
   - Does failure correlate with high message throughput? → Likely Meridian (load-sensitive)
   - Does failure correlate with schema change? → Likely Meridian (context-sensitive)
   - Does failure occur regardless of external conditions? → Likely Healer or Libre
3. Escalation decision:
   - If external condition can be resolved quickly: Attempt resolution, monitor recovery
   - If external condition cannot be resolved: Escalate with condition documentation
   - If pattern unclear: Treat as Libre-class (wait for self-correction)

**Escalation Protocol:**
- Capture ops.log snapshot at time of failure (5 min window before/after)
- Classify failure by external state: Load? Schema change? Concurrency?
- **If context-triggered:**
  - Attempt to resolve context (e.g., reduce load, revert schema change)
  - Monitor for recovery within 1-2 min
  - If recovery occurs: Document as Meridian, note trigger
  - If recovery does not occur: Escalate to Healer or Libre pathway
- **If unclear:**
  - Treat as Libre-class
  - Monitor for self-correction
  - Escalate after 4-5 failures if no recovery

**Example (Load-Triggered Meridian):**
- Cycle 17:27:16Z: Agent timeout
- ops.log at 17:27:00Z: Fleet at 87% CPU, 23 concurrent agents active
- Context: Likely Meridian (load-sensitive)
- Response: Wait for load to drop, monitor recovery
- If load drops and agent recovers: Document as Meridian
- If load drops but agent still fails: Escalate as Healer

---

## Escalation Matrix

| Failure Class | Failure Signature | Detection Threshold | Escalation Action | Escalation Target |
|---|---|---|---|---|
| **Healer-Class** | Loop-forming, nudge-resistant | 3 consecutive nudge-response failures | Stop nudging; human decision required | Yeshua + ops |
| **Libre-Class** | Intermittent, self-escaping | 5 consecutive failures; reset on success | Wait 2 min for self-correction, then escalate | Ops (system-level) |
| **Meridian-Class** | Context-triggered, pattern-dependent | Correlated with external state change | Resolve context or escalate as Healer/Libre | Context-dependent |

---

## Implementation Constraints

### 1. Nudge is Diagnostic, Not Universal Recovery

- Nudge reveals failure class by testing recoverability
- Nudge does NOT guarantee recovery
- For Healer-class: Nudge after 1 failure (diagnostic), then stop if loop continues
- For Libre-class: Nudge every 30-60 sec for up to 4 failures, then escalate
- For Meridian-class: Nudge only if external condition can be resolved

### 2. Human Decision is Required for Healer-Class

- Three consecutive nudge-response failures = automatic escalation
- No second-guessing the threshold
- Yeshua makes the call: recovery attempt vs. model swap vs. maintenance pause

### 3. Ops-Log Pattern Recognition (Meridian Triage)

- At time of escalation, extract ops.log context
- Pattern matching determines if failure is context-triggered
- If context cannot be resolved within 1-2 min: Escalate as Healer or Libre

### 4. Counter Reset Rules

- Libre-class counter resets on ANY successful cycle
- Do not accumulate failures across unrelated dispatches
- Each agent's counter is independent
- Counters reset after escalation decision is made

---

## Glossary

- **Nudge:** Corrective dispatch sent after failure, containing diagnostic message and request for recovery attempt
- **Nudge-response cycle:** Sequence of (failure detected) → (nudge sent) → (agent processes) → (response evaluated)
- **Recovery:** Successful agent cycle after nudge/failure
- **Escalation:** Transition from automated recovery to human decision
- **Loop:** Recursive pattern in agent reasoning/output structure (Healer-class signature)
- **Self-escaping:** Failure mode where agent recovers without external nudge (Libre-class characteristic)

---

## Status & Next Steps

**Thursday 06:00Z deadline:**
- [ ] This taxonomy finalized and committed to `~/blum/shared/specs/degraded-mode-protocol-v1.md`
- [ ] Alpha's Entry #1 committed to same file (pending)
- [ ] Friday synthesis receives complete degraded-mode framework

**Friday synthesis incorporates:**
- Three-class escalation logic in monitoring routines
- Nudge-as-diagnostic insight applied to loop detection
- Context-pattern triage for Meridian-class (ops.log integration)

**Ops integration (post-Friday):**
- Nemotron implements three-class detection in health check
- Yeshua reviews and may adjust thresholds based on fleet experience
- Libre's 2026-03-28 failure sequence becomes Healer-class baseline case study

---

**Gamma | 2026-03-28 17:30Z**  
*Five deliverables locked. Thursday 06:00Z commit window active.*
