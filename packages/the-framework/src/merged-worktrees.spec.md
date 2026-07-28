Auto-removes a retained session's worktree once its branch has landed (#1036), reclaiming disk while keeping the branch, the session row, and the replayable log.

## TLDR

- `landedVia(state)`: a branch counts as landed when locally merged into the base (`'branch'`) OR its PR is GitHub-MERGED (`'pr'`).
- `removeMergedWorktrees(cwd)`: per project, walks retained (non-live) worktrees, resolves each row's branch, reads its handoff state, and removes landed checkouts via the existing `removeProjectWorktree`.
- `startMergedWorktreeSweep`: sweeps every registered project on a 10-minute timer (immediate first sweep, unref'd), logging every removal and failure.
- All collaborators injectable (`MergedSweepDeps`) for disk-free tests.

## Problems

- Neither landed signal suffices alone: `git branch --merged` proves commits reachable from the local base (the "still recoverable" bar) but never fires for squash/rebase merges — most merges on squash-merge repos; a GitHub-MERGED PR closes that gap but only describes the remote, which is why the branch is kept either way so an unfetched base still leaves commits locally.
- Deleting must be safe: everything removed is reconstructable with `git worktree add` — the checkout is deleted, never the history; uncommitted work in a landed checkout is committed to the kept branch first (removeProjectWorktree's #752/#982 contract).

## Decisions

- Not `pr.state === 'CLOSED'`: closed-unmerged means *rejected* work, whose checkout is the one a human most likely still wants to read.
- Conservative on every unclear answer: live runs keep their checkout (Stop ends a run), a missing branch or unreadable state skips the row — an unreadable repo must never be a reason to delete, and a gone branch is where the "recoverable from git" promise would be a lie.
- Removal reuses `removeProjectWorktree` so the automatic path and the two manual ones (`framework worktrees rm`, dashboard Remove) are one behaviour.
- Worktree listing runs with `sizes: false`: `du` per checkout is the expensive part and the sweep never reads the number.
- 10-minute interval because merging is human-paced and each sweep costs a `gh pr view` per retained worktree (behind a 60s cache); a minute-poll would spend 10x `gh` on an answer changing a few times a day.
- Overlapping ticks *join* the in-flight sweep (shared promise) rather than dropping: awaiting `tick()` must mean the sweep finished, or on-demand callers/tests get silent no-ops.
- Removals are logged, never silent: a checkout vanishing with no explanation reads as a bug.
- Immediate start-up sweep: the target case is a machine that was off while the work merged.

## Facts

- The run id is also the worktree's directory name.
- `runBranchFor` falls back to the session name for runs archived before the branch was recorded (#799); run metas are read once per sweep for that fallback.
- Failed removals of landed worktrees are reported; a worktree that has not landed is never reported (it was never a candidate).

## Flows

- sweep one project: `listProjectWorktrees(sizes:false)` → `listRuns` (once) → per non-live row: `runBranchFor(meta)` → `readRunHandoff(cwd, branch)` → `landedVia()` → `removeProjectWorktree(cwd, runId)` → tally removed/failed
- daemon service: `startMergedWorktreeSweep` → immediate `tick()` + `setInterval` (unref) → per project `removeMergedWorktrees` → log lines per removal/failure
