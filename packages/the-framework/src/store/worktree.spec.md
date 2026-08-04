Worktree and branch lifecycle: create/attach/list/remove run worktrees (`.the-framework/worktrees/<runId>` on branch `the-framework/run-<runId>`), commit pending work, and rename the branch when the agent names the session.

## Decisions

- Read helpers are forgiving (swallow errors); **write helpers are not** — adding or attaching a worktree rejects on git failure, because a run that needs a checkout must not silently get the wrong one. Run ids are safety-gated so no caller can traverse out of the worktrees directory.
- `commitPendingWork` exists because the system prompt has the agent commit *pre-existing* changes, never its own final work — so removing a checkout without this would destroy an unstaged, unrecoverable diff. It retries a few times to outlast an index-lock race with the conversation committer (busiest exactly at session end); that transient loss once made real work read as "committed nothing". Returning false keeps the checkout — the safe direction.
- Removal tries plain first, then `--force` **with a log line** — forcing past unknown state is how uncommitted work got deleted historically.
- The branch rename only happens if the worktree is still on the original run branch — the agent is allowed to name its own branch and may already have moved.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
