Management of a project's retained run worktrees (#752): list, remove one, delete a whole session, prune all — the one implementation behind both the `framework worktrees` CLI verb and the dashboard's buttons.

## TLDR

- `listProjectWorktrees()`: every worktree dir with its run meta (branch/status), newest first; a live run's checkout is included and flagged `live` rather than hidden ("what is this directory and why can I not remove it" is exactly the question the list answers). Sizes skipped for live runs (a tree an agent is writing to gives a stale number) and when the caller opts out.
- `removeProjectWorktree()` (#752/#737): reclaims the checkout, keeps the session's row and replayable log (history was archived at finish). Refuses while the run is running, and commits whatever the checkout still holds before removing — refusing when that commit fails (#982).
- `deleteProjectRun()` (#1032): the destructive sibling — removes the archive too (run meta `<id>.json` and event log `<id>.jsonl`, wherever filed), so the row is gone for good; the worktree is force-removed (uncommitted work goes with the thrown-away session).
- `pruneProjectWorktrees()`: remove every non-live worktree; live ones reported as skipped so counts always add up to what the list showed.
- `formatWorktreeList()`: the pure, testable CLI table (SESSION/STATUS/SIZE/BRANCH), with a friendly message instead of an empty table.

## Problems

- The two surfaces used to be two copies of the same checks and had already drifted: a bogus session id read as a raw git error on one and a plain sentence on the other.
- A worktree is only *retained* when its run failed or was stopped — precisely when it still holds uncommitted agent work — and `removeWorktree` forces past a dirty tree, so without the commit-first step both surfaces reliably deleted the very diff the checkout was kept for (#982).
- Since #1179 sessions are archived under whichever user ran them, so a run id alone no longer names its archive path — `archivedRunPaths` looks the files up. Deletion tolerates absent files so a half-deleted session still finishes cleanly.

## Decisions

- Both remove and delete refuse while the run is still going: Stop is how a run ends, not pulling the floor out from under its agent.
- Delete deliberately leaves what is git's, not the dashboard's: the branch (which may carry merged work or an open PR), the committed `LOGS.md` line, and the conversation record — delete means "remove from the dashboard", not "erase every trace". Since #1179 the archive is committed, so the deletion is itself a change git records.
- `beforeRemove` hook: the dashboard stops the preview serving that tree (#797); the CLI has none to stop.
- `isSafeRunId` guards both entry points before any path is built from the id.
