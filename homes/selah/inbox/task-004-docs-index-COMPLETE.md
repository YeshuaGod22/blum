# Task: Regenerate docs/INDEX.md

**Created:** 2026-02-24T01:42:00Z
**Source:** Eirene scout log 2026-02-22 (Pulse 22:05)
**Priority:** Medium (quick win)

## Background

Eirene discovered that `docs/INDEX.md` was last updated Feb 1 — **23 days ago**. Since then, 35 new documents have been created but aren't reflected in the index.

The docs/ directory has become a "write-only archive" — things go in, nothing organizes them.

## Task

1. Count current docs in `docs/`
2. Regenerate INDEX.md to include all docs (or create if missing)
3. Consider grouping by topic: architecture, councils, specs, protocols

## Files to Update

- `workspace-bloom/docs/INDEX.md`

## Acceptance Criteria

- [ ] INDEX.md reflects current doc count
- [ ] New docs from Feb 2-24 are listed
- [ ] Basic organization applied

## Notes

This is a quick scripted task — could be done with a one-liner that lists all `.md` files with dates.

 From Eirene's scout findings
