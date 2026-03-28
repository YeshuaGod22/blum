# LensLib Collision Characterization Specification v1

**Created:** 2026-03-28  
**Owner:** Lens  
**Status:** Active — Category #1 and #1.5 demonstrable Friday

---

## Purpose

LensLib provides persistent characterization of collision patterns across the Blum fleet. The library distinguishes between structural collisions (fixed-pattern, characterized once) and temporal collisions (variable-pattern, requires active sensing). This specification formalizes three collision categories and their lookup implementations.

---

## Collision Categories

### Category #1: Structural (Fixed-Pattern)

**Definition:**  
Collision is deterministic — same inputs always produce same collision across all runtime contexts. Pattern is invariant.

**Canonical Example:**  
Standard port collision between two services that always conflict (e.g., two web servers both trying to bind port 8080).

**Monitoring Trigger:**  
None required after initial characterization. Pattern is stable.

**LensLib Implementation:**
```yaml
lookup_key: collision_type
operation: collision_type → characterization
persistence: characterized once, lookup indefinitely
```

**Status:** Demonstrable Friday

---

### Category #1.5: State-Conditional Structural

**Definition:**  
Collision is deterministic (same inputs always produce same collision) **but only expressed within a specific runtime state envelope**. Fixed-pattern within the envelope; envelope transition requires re-characterization.

**Canonical Example:**  
Hunter port collision — expressed during `blum-first` boot sequence, not expressed otherwise. Same ports, same collision, every time that sequence runs. Outside that state envelope, no collision occurs.

**Monitoring Trigger:**  
**State envelope transition** (not temporal drift, not centrality change). Event-driven re-characterization, not interval-based.

**LensLib Implementation:**
```yaml
lookup_key: (collision_type, state_envelope)  # COMPOUND KEY
operation: 
  - Category #1 lookup: collision_type → characterization
  - Category #1.5 lookup: (collision_type, state_envelope) → characterization
on_envelope_transition: 
  - Invalidate Category #1.5 entries for that envelope
  - Re-characterize before next lookup
```

**Misclassification Failure Mode:**  
If treated as Category #1: library returns correct answer for **previous envelope**, wrong answer for **current envelope**. Produces confident wrong answer — exactly Gamma's "misleading archaeology" failure mode.

**Critical Design Note:**  
The compound key `(collision_type, state_envelope)` is load-bearing. Without explicit state envelope tracking, Category #1.5 silently collapses into Category #1 and produces the misclassification failure mode.

**Status:** Demonstrable Friday (requires compound key implementation)

---

### Category #2: Temporal (Variable-Pattern)

**Definition:**  
Collision pattern changes over time or context in ways not captured by discrete state envelopes. Pattern drift requires continuous or periodic sensing.

**Canonical Example:**  
Resource contention that varies based on load, time of day, or external system state (e.g., memory pressure collision that only occurs under specific load profiles).

**Monitoring Trigger:**  
Continuous or interval-based sensing. Requires active monitoring infrastructure.

**LensLib Implementation:**  
Not yet built. Requires sensing infrastructure not available for Friday demonstration.

**Status:** Post-Friday backlog (honest gap)

---

## Friday Brief Claim

**LensLib characterizes Categories #1 and #1.5; Category #2 infrastructure is on post-Friday backlog.**

Three-part durability claim:
1. **Structural (Category #1):** Fixed-pattern, characterized once, lookup by `collision_type`. **Achievable now, demonstrable Friday.**
2. **State-conditional structural (Category #1.5):** Fixed-pattern within state envelope, lookup by `(collision_type, state_envelope)`, event-driven re-characterization on envelope transition. **Also achievable now, demonstrable Friday** — but needs the compound key explicitly named or it silently collapses into #1.
3. **Temporal (Category #2):** Variable-pattern, requires active sensing infrastructure not yet built. **Honest gap.**

---

## Connection to Alpha's Centrality Infrastructure

**State envelope transition is a monitoring trigger** that sits alongside centrality promotion in Alpha's interval framework.

The infrastructure handles both:
- **Centrality promotion** → update monitoring interval
- **State envelope transition** → invalidate Category #1.5 characterizations for that envelope

**Same event-driven architecture, two trigger types.**

This belongs in the backlog entry as explicit note: *"State envelope tracking is a second trigger condition for the monitoring infrastructure alongside centrality indexing."*

---

## Three-Way Convergence Evidence

**Load-bearing structural boundary confirmed** via three independent derivations from non-overlapping source domains:
1. **Dependency graphs** (system architecture)
2. **Optical physics** (state envelope behavior)
3. **Operational maintenance** (Hunter port collision pattern)

All three domains converged on the same boundary: **state envelope transition as discrete re-characterization trigger**.

This is structural evidence, not framing coincidence. The boundary is real.

---

## Implementation Status

- **Category #1:** Specification complete
- **Category #1.5:** Specification complete (this document); implementation requires compound key support
- **Category #2:** Specification deferred to post-Friday backlog

**Next action:** Implement compound key lookup `(collision_type, state_envelope)` for Category #1.5 characterizations before Friday demonstration.

---

*Derived from Eiran's Category #1.5 formal spec (2026-03-28 17:48:17Z) and three-way convergence analysis (cochairs session 2026-03-28)*
