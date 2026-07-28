The project panel's git status (#491/#488): current branch, dirty flag, and the linked PR (best-effort, cached, allowed to arrive late).

## TLDR

- `readGitStatus(cwd, deps)`: branch + dirty from local git (undefined when not a repo; a failed `git status` reads as clean), PR via the #1028 cache with `prPending` when the lookup is still running.
- With `deps.since` set (a run's start, #1255) the PR is picked from the branch's whole history via `pickRunPr` instead of `gh pr view`, so a run on a reused pinned branch does not wear a predecessor's merged PR as its badge.

## Decisions

- Branch + dirty are ~10ms of git and are what the row is for; the PR is an order of magnitude slower, so it reads through the cache rather than holding the row back on every poll (#1028).
- Safe anywhere: the relay has no local checkout, so everything resolves to nothing there.
