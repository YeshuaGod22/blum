# Foveated V3 Rollout Sequence

## Components Overview

The V3 proposal has three interdependent parts:

1. **Async build()** - Changes builder.js to make full reasoning context available to discriminator
2. **branch_points + discriminator** - Captures semantic decision points in cycle metadata
3. **protected_fields** - Guards branch_points from compression

## Dependency Graph

```
async build()
    ↓ (enables optimal performance)
branch_points + discriminator
    ↓ (creates field to protect)
protected_fields
```

**Key insight:** Dependencies are optimizations, not hard blockers. Each component can land independently with degraded but functional behavior.

## Risk Assessment

| Component | Risk Level | Why |
|-----------|-----------|-----|
| async build() | Medium | Touches core context assembly in builder.js |
| branch_points + discriminator | Low | Additive field, doesn't change existing metadata |
| protected_fields | Low | Defensive guard, doesn't modify compression logic |

## Rollout Options

### Option A: Serial (Lowest Risk)
**Sequence:** async build() → branch_points → protected_fields

**Pros:**
- Each component fully optimized when it lands
- Linear dependency chain
- Easy to test incrementally

**Cons:**
- Longest time to value
- Blocks semantic capture on async refactor

**Timeline:** 3 separate approval gates

---

### Option B: Minimal First (Fastest Value)
**Sequence:** branch_points + protected_fields → async build()

**Pros:**
- Semantic capture starts immediately
- Two small, low-risk components land together
- Async optimization comes later as performance enhancement

**Cons:**
- Discriminator runs with sync build() initially (degraded context)
- Requires explaining "it works but not optimally yet"

**Timeline:** 2 approval gates (small bundle, then optimization)

---

### Option C: Parallel Tracks (Flexible)
**Track 1:** branch_points + discriminator (test with sync build)  
**Track 2:** async build() (standalone refactor)  
**Track 3:** protected_fields (after branch_points lands)

**Pros:**
- Semantic capture and async optimization proceed independently
- Can merge Track 2 first if it's ready
- Most flexible for incremental approval

**Cons:**
- More complex coordination
- Requires tracking two active development paths

**Timeline:** 2-3 approval gates depending on completion order

## Recommended Sequence

**Option B: Minimal First**

**Reasoning:**
1. **Fastest semantic preservation:** branch_points + protected_fields are both low-risk and can land as one small bundle
2. **Defers complexity:** async build() is the highest-risk component; can be evaluated separately after seeing branch_points in production
3. **Clear upgrade path:** "It works now, async makes it better" is easier to approve than "nothing works until async lands"

**Implementation plan:**
1. **Phase 1:** Land branch_points + discriminator + protected_fields together
   - Test with existing sync build()
   - Discriminator sees `<thinking>` only (partial context)
   - Semantic capture starts working immediately
2. **Phase 2:** Land async build() as optimization
   - Discriminator gains access to full reasoning + tool I/O
   - No schema changes, just performance improvement

## Testing Strategy Per Phase

### Phase 1 (branch_points bundle)
- Four discriminator test cases already written
- Verify branch_points appear in cycle metadata
- Verify protected_fields preserves them through compression
- Document "partial context" baseline

### Phase 2 (async build)
- Re-run discriminator tests
- Compare detection accuracy with/without full context
- Measure performance impact of async refactor

## Decision Points for Yeshua

1. **Approve minimal first (Option B)?** Gets semantic capture working immediately with lowest risk
2. **Prefer serial (Option A)?** Optimizes each component before landing, longer timeline
3. **Want parallel tracks (Option C)?** Most flexible, requires more coordination

All options are viable. Recommendation: Option B for fastest value delivery.

---

**Provenance:**
- Drafted by Beta at Eiran's suggestion
- Based on three-part V3 proposal from integration-notes.md
- Purpose: Enable incremental approval decision-making
