Releases a pinned routine branch its closed PR left behind (#1293), so a triage routine whose branch was never deleted stops jamming forever.

## TLDR

- `releaseStalePinnedBranch(cwd, branch)`: checks local + remote existence, asks the branch's full PR history (`ghPrsForBranch`), and deletes the leftover copies only when history proves the work is over — some PR existed and none is open. Outcomes: `absent` / `pending` / `unproven` / `released`.

## Problems

- Triage prompts pin their session name, so every firing wants the same branch and aborts when it exists (a triage in flight owns it). But nothing ever released the name: the first PR closed/merged without branch deletion jammed the routine forever — every later firing found the branch and reported a pending triage that did not exist.
- A branch existing is not evidence of pending work; an open PR is.

## Decisions

- Conservative on the two unprovable cases: an open PR keeps the branch (genuinely pending), and no PR history at all keeps it too — either a run still working toward its handoff, or a `gh` hiccup, and deleting on a hiccup would discard work.
- Deleting is safe exactly when history proves it: the closed PR preserves the diff on GitHub, so the branch is a leftover name, not the last copy of anything.
- `git branch -D`, not `-d`: a squash merge leaves the branch unmerged in git's eyes. Git refusing because a worktree still has it checked out is the in-flight guard working, not a failure.
- Never throws: a release that could not happen leaves the routine exactly as jammed as before, and the next tick retries.
