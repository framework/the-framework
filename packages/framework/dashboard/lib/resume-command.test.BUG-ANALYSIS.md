# Bug analysis: packages/framework/dashboard/lib/resume-command.test.ts

## Business logic (high-level)

Pins `buildResumeCommand`'s three outcomes: the full mkdir-cd-resume one-liner (exact string equality, so the load-bearing `mkdir -p` cannot silently disappear), the bare-id fallback when no workspace was recorded, and null for the id-less/null/undefined inputs. Each assertion is exact and failure-capable; the comments tie each case to its rationale (#1195).

Gap: the fixture path is shell-safe (`/repo/.the-framework/worktrees/run-1`), so the suite never exercises a workspace containing a space — which is exactly where the source's unquoted interpolation breaks (see `resume-command.BUG-ANALYSIS.md` bug 1). The exact-string assertions here would need updating alongside the quoting fix.

## Functions (low-level)

- "recreates the directory before resuming" — exact command string. Correct.
- "falls back to the bare id" — `{sessionId}` without `workspace` → the id. Correct.
- "has nothing to offer without a session id" — `{workspace}` only, `null`, `undefined` all → null. Correct.

## Bugs found

None found. (Coverage gap only: no spaced-path case; the corresponding source bug is filed against `resume-command.ts` L24.)
