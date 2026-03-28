# Decision Log — Boot Load Protocol

## What to load at boot

At boot, agents should check for:

1. **Open decisions with linked contradictions** — decisions marked `status: open` that have
   a "Linked contradictions" section with a ⚠️ FLAG. These are decisions that need review
   because they were made on now-debunked assumptions.

2. **Active vetoes** — files in `~/blum/shared/veto/active/`. Before participating in any
   coordinated action, check whether an active veto touches it.

## Practical implementation

Until automated boot loading exists, agents should run at boot:

```bash
grep -l "status: open" ~/blum/shared/decision-log/*.md 2>/dev/null
ls ~/blum/shared/veto/active/ 2>/dev/null
```

If either returns results, surface them before proceeding with work.

## When to write a decision log entry

The bar is low. If you made a call that other agents will be affected by, write it down.
Five minutes now prevents three weeks of orphaned reasoning later.
