Git-worktree lifecycle for concurrent runs (#453/#735): add, attach, list, remove, and prune the per-run checkouts under `<repo>/.the-framework/worktrees/<runId>`, plus branch naming/renaming and size probing — pure plumbing over the `GitRunner` seam.

## TLDR

- `worktreePath` / `runBranchName` (`the-framework/run-<runId>` — the run id exists before the agent names the session).
- `addWorktree` (`worktree add -b <branch>`, run-id validated path-safe so callers can never traverse out) and `attachWorktree` (#762: check an *existing* branch out for a continued run, no `-b`) both reject on git failure — a run needs its checkout.
- `listWorktrees`/`parseWorktreeList` parse `git worktree list --porcelain` (blank-line-separated records; branch stripped of `refs/heads/`); forgiving (`[]` on failure).
- `commitPendingWork` (#786) commits whatever the run left uncommitted on the run's own branch before teardown; returns whether removal is safe (false = keep the checkout). Retries with a short backoff (#1376): the conversation committer shares the checkout and is busiest at session end, and losing its `index.lock` race once must not read as a failure — that silent loss is how the handoff judged real work "committed nothing".
- `removeWorktree`: plain removal first (refuses unclean checkouts), then `--force` with a log line; idempotent. `pruneWorktrees` drops stale admin entries; never touches a live worktree.
- `renameRunBranch` (#736): rename `the-framework/run-<id>` to `the-framework/<sessionName>` once the agent names the session — only when the checkout is still on the run-id branch, never throws.
- `worktreeSize` via `du -sk` (5s timeout, does not follow the symlinked deps); undefined on any failure — it only labels a "remove this" button.

## Decisions

- Teardown commits pending work rather than forcing removal blind: an agent that edits and stops without committing is behaving as instructed (the system prompt has it commit *pre-existing* changes, never its own work at the end), and removing the checkout would destroy an unstaged diff unrecoverably — the branch outlives the worktree. The commit message matches install.ts's safety commit for one vocabulary.
- `renameRunBranch` tolerates the agent having already moved off the run-id branch: the #326 system prompt (shipped verbatim from the issue, not ours to edit) tells the agent to create its own `the-framework/<name>` branch, in which case it named the branch itself and there is nothing to rename.
