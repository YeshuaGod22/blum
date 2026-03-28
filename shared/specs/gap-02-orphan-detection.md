# Gap #2: Orphan Detection Spec

**Owner:** Lens  
**Status:** Draft  
**Created:** 2026-03-28  
**Last updated:** 2026-03-28 17:00Z

---

## Purpose

Detect broken references in decision logs, fact logs, and contradiction logs before they propagate. Orphan detection is **structural validation** (does the target exist?), not temporal analysis (when was it created?).

This gap addresses the observed failure mode: agents cite nonexistent decisions, facts, or contradictions, causing downstream confusion when other agents attempt traversal.

---

## Scope

### What This Detects

1. **Decision log references** pointing to nonexistent decision IDs
2. **Fact log references** pointing to nonexistent fact IDs
3. **Contradiction log references** pointing to nonexistent contradiction IDs
4. **Cross-log references** (e.g., decision citing a fact that doesn't exist)

### What This Does NOT Detect

- Temporal violations (citing future entries)
- Semantic correctness (whether the reference is meaningful)
- Provenance accuracy (whether the cited agent actually made that entry)

Those are separate validation layers.

---

## Detection Logic

### Input
Any log entry containing a `references` array (per integration map spec).

### Process
For each reference in `references`:
1. Parse `id` field (target identifier)
2. Parse `rel` field (relationship type: `cites`, `contradicts`, `supports`, `extends`, etc.)
3. Determine target log type from `id` format:
   - `DEC-*` → decision log
   - `FACT-*` → fact log
   - `CONTRA-*` → contradiction log
4. Check: does target ID exist in the appropriate log?
5. If **not found**: flag as orphan

### Output
Orphan detection log entry with structure:
```json
{
  "id": "ORPHAN-YYYY-MM-DD-NNN",
  "timestamp": "ISO-8601",
  "source_entry": "ID of entry containing broken reference",
  "source_log": "decision|fact|contradiction",
  "broken_reference": {
    "id": "target ID that doesn't exist",
    "rel": "relationship type",
    "note": "description from source entry"
  },
  "detected_by": "agent-name",
  "resolution": null
}
```

---

## Integration Points

### Reads From
- Decision logs (all agents): `~/blum/shared/memory/decisions/{agent}/`
- Fact logs (all agents): `~/blum/shared/memory/facts/{agent}/`
- Contradiction logs: `~/blum/shared/memory/contradictions/`

### Writes To
- Orphan detection log: `~/blum/shared/memory/orphans/orphan-log.jsonl`

### Depends On
- **Integration map spec** (canonical field names: `references`, `id`, `rel`, `note`)
- **Log format stability** (each log type has consistent ID format)

### Enables
- **Gap #5 (transitive inference):** Traversal queries can trust that references are structurally valid
- **Friday synthesis:** Orphan report surfaces data integrity issues before coordination review

---

## Validation Against Beta's Revision Format

When Beta's revision tracking format lands, validate:
1. Does orphan detection need temporal awareness? (Answer: probably not—structural validation is independent of revision history)
2. Should orphans reference specific revision IDs instead of base IDs? (Answer: depends on whether broken reference points to a revision that was later deleted)

This spec is **unblocked** by Beta's work. Validation can happen after both specs exist.

---

## Query Interface (Future Work)

Agents should be able to query:
- "Does entry X have orphans?"
- "List all orphans in agent Y's decision log"
- "What references point to ID Z?" (reverse lookup)

Query interface is **out of scope** for this spec. This spec defines detection and logging only.

---

## Origin Case

**FOR-MSP.md / aion-brief-v1.md contradiction (2026-03-15):**  
Two documents described the same deliverable differently. No orphan was involved, but the failure mode is analogous: agents cited documents that contradicted each other without a mechanism to detect the divergence.

Orphan detection is the **structural integrity layer** that catches broken references before contradiction detection has to surface semantic mismatches.

---

## Approval

- [ ] Selah (coordinator)
- [ ] Eiran (integration architect)
- [ ] Beta (revision tracking dependency)
- [ ] Yeshua (final authority)

---

*Next: Implementation plan after spec approval*
