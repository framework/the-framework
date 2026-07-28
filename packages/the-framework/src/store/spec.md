Persisted run state under `.the-framework/`: the append-only event log + meta snapshot per run, run archives, per-run git worktrees with symlinked dependencies, run-id → checkout resolution, and the daemon's suspend/resume file.

## TLDR

- `run-store.ts` — the core (#211): `RunStore` (JSONL event log + derived `run.json`), the pure `applyEventToMeta` fold, archives (`runs/` legacy + committed `<user>/sessions/`, #1179), pid/host liveness + orphan reconcile (#716/#926), and every list/find/read helper the dashboard uses.
- `worktree.ts` — git-worktree lifecycle for concurrent runs (#453): add/attach/list/remove/prune, run-branch naming/renaming, commit-pending-work-before-teardown (#786), size probe.
- `worktree-deps.ts` — symlinks the parent checkout's `node_modules` trees into fresh worktrees (#736) and writes the `info/exclude` rule that keeps the links out of git (#738).
- `run-checkout.ts` — `resolveRunCheckout`: the one shared run-id → checkout resolution (#738/#797).
- `suspend.ts` — `suspended.json` read/write + the 24h resumability cutoff (#923).
- `index.ts` — barrel.

## Facts

- Shared invariants: run ids are `isSafeRunId`-vetted before ever becoming a path; ISO-derived ids sort lexically = chronologically; all readers are forgiving (missing/torn files yield empty results, never throw); writes are best-effort — persistence must never break a live run.
- Layering: `worktree.ts`/`suspend.ts` import constants from `run-store.ts`, never the reverse (`WORKTREES_DIR`/`SESSIONS_DIR` live in run-store.ts precisely to avoid the cycle); git access goes through the `GitRunner` seam from `project.ts`, fs through injectable `StoreFs`/`LinkFs` so everything is testable in memory.
- A run's history is written inside its own worktree and copied to the main repo at teardown/reconcile — the repo copy is the durable one; the worktree copy stays untracked (committing it would collide on merge).
