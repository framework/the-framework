Records the runs a shutting-down daemon suspended (#923) in `.the-framework/suspended.json`, so a restart within 24h can pick the work back up.

## TLDR

- `SuspendedRun`: `runId`, optional agent `sessionId` to continue, ISO `suspendedAt`, optional `queueEntry` (#1268) — the queue pin carried across the restart so the resumed run re-emits it; the meta rebuilt on `--continue-run` proved able to lose the fold, and a released pin means a second agent on work the resumed one is still doing (#1253).
- `readSuspendedRuns` / `writeSuspendedRuns`: forgiving read (absent/malformed → `[]`), replace-the-list write (empty list clears).
- `resumableRuns(runs, now)` — pure cutoff filter (`SUSPEND_MAX_AGE_MS` = 24h): a machine off for a week must not wake up spending a day's quota on work whose repo has moved on; unparseable timestamps are dropped (age is exactly what the rule turns on), future timestamps count as recent.
