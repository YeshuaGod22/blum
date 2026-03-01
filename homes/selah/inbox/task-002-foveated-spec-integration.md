# Task: Integrate Foveated Architecture Spec

**Created:** 2026-02-23T23:50:00Z
**Source:** Eirene scout log 2026-02-22
**Priority:** High

## Background

Eirene identified that `memory/inbox/synthesis-beta` contains a complete 37KB foveated context architecture spec — the result of three parallel synthesis councils (alpha, beta, gamma).

This work is sitting in the inbox unintegrated while the system continues operating without it.

## Task

1. Read `memory/inbox/result_*synthesis-beta*.md`
2. Compare against existing `docs/foveated-*.md` files
3. If synthesis-beta supersedes existing docs, move to docs/ and archive old versions
4. If it complements, merge the new material
5. Update docs/INDEX.md if it exists

## Acceptance Criteria

- [ ] synthesis-beta content is in `docs/` (not rotting in inbox)
- [ ] Old docs are archived with timestamp if superseded
- [ ] docs/INDEX.md updated

## Notes

This was identified as "highest priority to integrate" in Eirene's 22:35 pulse.

The Jan 29 foveated council outputs (24 days stale) may be superseded by this — check before deciding.
