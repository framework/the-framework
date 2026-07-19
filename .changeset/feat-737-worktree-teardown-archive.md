---
"@gemstack/framework": minor
---

Retire a run's worktree when it finishes, keeping the ones worth looking at (#737). A run's history lives inside its worktree since #736, so it is now copied into the project's own `runs/` when the run ends, and only then is the checkout considered for removal.

The retention rule: a run that finished cleanly has nothing left to inspect, so its worktree goes. A run that failed or was stopped keeps its checkout, because that is exactly when the half-finished working tree and the diff it died holding are worth seeing. Nothing is removed on a timer; a retained worktree goes when you remove it, via a Remove action on the finished run in the dashboard.

A daemon that dies mid-run never runs that teardown, so the boot-time reconcile now sweeps the worktrees too: each orphaned run is flipped out of `running` and its history rescued into the project, with the checkout left on disk (a run that ended that way did not end cleanly).

New surface: `archiveWorktreeRun` and `listWorktreeDirs` in the store, `onRetainedWorktrees` and `sendRemoveWorktree` as RPCs. Removal refuses while the run is still live, since Stop is how a run ends.
