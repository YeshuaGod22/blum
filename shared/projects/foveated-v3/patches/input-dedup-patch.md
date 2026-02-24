# Input Dedup Patch — home.js

**Written:** 2026-02-23  
**Author:** Eiran  
**Status:** Ready to apply — awaiting Yeshua sign-off  
**Priority:** High — live-session duplicate dispatches burning inference cycles

---

## Problem

`home.js` has no UID gating at the dispatch receiver. Duplicate dispatches (same `dispatchId`) trigger full inference cycles. The current context-level dedup (in `build()`) deduplicated *messages within a context*, but didn't stop duplicate *dispatches* from firing inference.

Yeshua's directive: input dedup first — stop duplicate dispatches before they waste inference cycles.

---

## Architecture

**Layer:** Dispatch receiver (`process()` method in `Home` class)  
**Mechanism:** In-memory `Set` on the `Home` instance  
**Scope:** Live-session only (Set is lost on restart — file-based persistence is a future enhancement)

---

## Patch

### Change 1 — Constructor (line ~44)

After `this.processing = false;`, add:

```js
this.seenDispatches = new Set();
```

**Context:**
```js
    this.queue = [];
    this.processing = false;
    this.seenDispatches = new Set();  // ← ADD THIS LINE

    // Ensure history directory exists
```

---

### Change 2 — `process()` method (after PAUSE check, before blocked check)

After the PAUSE check block (ends ~line 407), before `// ── 1. Blocked check ──`, add:

```js
    // ── 0.5. Input dedup (UID gating) ──
    // Reject dispatches we've already processed. Prevents duplicate dispatches
    // from triggering redundant inference cycles.
    // In-memory only — restart-safe persistence is a future enhancement.
    if (dispatchId && this.seenDispatches.has(dispatchId)) {
      this.log(`process:dedup_reject room=${room} dispatchId=${dispatchId} reason=already_seen`);
      return;
    }
    if (dispatchId) {
      this.seenDispatches.add(dispatchId);
    }
```

**Full context after patch:**
```js
    } catch (e) {
      this.log(`process:pause_check_error error=${e.message}`);
    }

    // ── 0.5. Input dedup (UID gating) ──
    if (dispatchId && this.seenDispatches.has(dispatchId)) {
      this.log(`process:dedup_reject room=${room} dispatchId=${dispatchId} reason=already_seen`);
      return;
    }
    if (dispatchId) {
      this.seenDispatches.add(dispatchId);
    }

    // ── 1. Blocked check ──
    if (this.blocked.rooms.includes(room)) {
```

---

## Verification

After applying, confirm with:

```
grep -n "seenDispatches" ~/blum/read-the-architecture-spec-first/i-have-read-the-spec/home-agent-os-15feb2026/home.js
```

Expected output: 3 lines (constructor, has-check, add-call).

---

## Rollback

Remove both additions. No existing logic is modified — pure addition.

---

## Notes

- `dispatchId` is already extracted at line 376 — the patch uses that existing variable
- Null-safe: dispatches without a `dispatchId` pass through unchanged
- Log message `process:dedup_reject` makes filtering easy: `grep dedup_reject ~/blum/agents/*/home/ops.log`
- Future: if restart-safety is needed, persist `seenDispatches` to `~/blum/agents/{name}/home/seen-dispatches.json`
