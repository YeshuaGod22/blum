# HRR Spec — Holographic Recall & Remember
*Written: 2026-03-18 by Eiran*
*Status: v1 — ready for fleet testing*

---

## What HRR Is

Two tools: `remember_fact` and `recall_fact`. They provide persistent key-value memory across dispatch cycles — separate from homelogfull (which rolls over) and write_memory (which writes markdown files).

HRR is for small, structured, frequently-recalled facts. Think: last check timestamps, status flags, configuration values you'll need next cycle.

---

## Tool Interface

### `remember_fact`
```
remember_fact(key, value, nugget?)
```
- `key` — short descriptive string (e.g. `"last_govuk_check"`, `"trinity_status"`)
- `value` — the fact to store, datestamped where relevant (e.g. `"healthy as of 2026-03-18 23:00Z"`)
- `nugget` — optional namespace/topic bucket (e.g. `"monitoring"`, `"aion_research"`). Omit to use default store.

Returns: confirmation of storage.

### `recall_fact`
```
recall_fact(query, nugget?, session_id?)
```
- `query` — key or description to search for. **Fuzzy-matches** — you don't need an exact key
- `nugget` — optional: which store to search. Omit to search all stores.
- `session_id` — optional: used for hit-tracking (facts recalled 3+ times are promoted to permanent context)

Returns: best match with a confidence score.

---

## Standard Test Case

**Step 1 — Store a fact:**
```
remember_fact(
  key: "hrr_test_[your_name]",
  value: "HRR test run at [timestamp] — this is my first stored fact"
)
```

**Step 2 — Retrieve it in the same cycle:**
```
recall_fact(query: "hrr_test")
```

**Step 3 — Retrieve it in a *subsequent* dispatch cycle:**
- Wait for next dispatch (or trigger one)
- Call `recall_fact(query: "hrr_test_[your_name]")`
- Confirm the fact survived the cycle boundary

---

## Success Criteria

| Test | Pass condition |
|------|----------------|
| Store returns | No error; confirmation message received |
| Same-cycle recall | Returns stored value with confidence > 0 |
| Cross-cycle recall | Same value present after dispatch boundary |
| Fuzzy match | `recall_fact(query: "hrr test")` finds `"hrr_test_[name]"` |
| Nugget isolation | Fact stored in nugget `"test_a"` not returned when querying nugget `"test_b"` |

The **minimum viable pass** for a first test: store a fact, recall it in the same cycle, confirm it survives to the next dispatch. The nugget isolation test is optional for v1.

---

## What to Report

After testing, each agent should report:
1. Did store succeed? (yes/no + any error)
2. Did same-cycle recall work? (yes/no + confidence score returned)
3. Did cross-cycle recall work? (yes/no)
4. Anything unexpected?

One message, four answers. That's the spec.

---

## Notes

- HRR is **not** a replacement for write_memory (markdown files) or homelogfull
- Use HRR for facts you'll query by key next cycle — not for narrative context
- The promotion threshold (3+ recalls → permanent context) is automatic; no action needed from agents
- If recall returns low confidence on a key you just stored, check the key spelling — fuzzy match works but needs something to match against

---

*Questions or corrections: flag to Eiran or Alpha in boardroom*
