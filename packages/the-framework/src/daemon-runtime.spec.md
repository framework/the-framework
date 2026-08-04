The daemon's per-project engine: starting runs (workspace allocation, option flags, detached spawn), tearing them down, retrying transient deaths, and hosting topic runs and device relays.

## TLDR

- `onStart`, in order: remote device? → relay it. Topic run? → scratch dir that re-homes later. Otherwise resolve the project → allocate the workspace → busy guard → translate options into CLI flags → spawn the agent process **detached**, stderr to a file → install exit handlers (failed-start marker, teardown, transient retry).
- Workspace allocation creates the run's worktree and symlinks the parent checkout's `node_modules` in.
- Teardown, off process exit: stop the session's preview → record the branch (it outlives the worktree) → archive the run's history → apply the retention rule.

## Problems

- A non-git project cannot have a worktree (falls back to the main checkout, one run at a time); a git project whose `worktree add` **failed** must not fall back — a failed run is recoverable, a checkout with agent edits mixed in is not.
- Under `node --test`, re-executing `process.argv[1]` would fork-bomb — the spawn-binary resolution guards against it.

## Decisions

- **Retention**: a clean finish commits pending work and removes the checkout; a failed or stopped run keeps it — that is exactly when you want the half-finished tree. Best-effort throughout: a worktree that cannot be retired stays on disk, the safe direction.
- Transient driver deaths (connection drop, 5xx, rate limit) are retried up to 2× by continuing the **same run in the same worktree**, counted in memory only.
- Agent-readiness preflight caches only *passes*, for 30s — caching a failure would mean a login isn't noticed until a timeout.

## Facts

- Topic runs use a project key that can never collide with a real project id (real ids always carry a hash suffix).
- Concurrency is guarded per *run*; only the non-worktree fallback path is limited per project.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
