---
"@gemstack/framework": minor
---

Show every live run of a project, not just one (#738). Since #736 each run lives in its own worktree and writes its `run.json` there, so `readLiveMeta(projectPath)` stopped seeing any of them and the dashboard went blind to dashboard-started runs. A new `readLiveMetas(cwd)` discovers the live run in each `.the-framework/worktrees/*` checkout plus the project root (where a non-git project still runs, and where pre-#736 runs live), self-healing a stale one exactly as the single reader did.

Every reader now aggregates: the runs list, the "working now" overview, the awaiting-you queue, the activity feed, and the project summaries. Each live run carries the `cwd` of the checkout it is editing, and `ActiveRun` and an `awaiting` intervention now carry a `runId`, so two concurrent runs of one project are told apart. `onGitStatus`, `onProjectFileStatus`, and `onProjectFiles` take an optional `runId` and read that run's worktree rather than the user's checkout.

Also fixes a #736 bug found on the way: a repo's `.gitignore` says `node_modules/`, and a trailing slash matches a directory, not the symlink the worktree gets. The links were therefore untracked in every run's worktree, so a run's `git add -A` would commit dangling absolute symlinks onto its branch. The rule now goes into the repository's `info/exclude`, which is where git resolves excludes from for a linked worktree.

Two dashboard fixes fall out: the "working now" list keyed its rows by project id alone, which produced duplicate React keys with two live runs in one project, and following live highlighted every running row at once instead of the newest.
