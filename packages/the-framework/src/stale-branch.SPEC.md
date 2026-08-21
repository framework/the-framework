Releases a pinned routine branch its closed or merged PR left behind, so a recurring job stops reporting a pending agent that no longer exists.

## User Stories

- The user's recurring routine resumes on schedule after its PR merges or closes, instead of standing down forever behind a leftover branch.

## Flows

- Routine agents pin their branch name so two firings never run at once; a firing that finds the branch already existing stands down.
- A branch existing is not evidence of pending work; an open PR is. The branch goes only when its PR history proves the work is over: some PR existed and none is open.
- An open PR keeps the branch (genuinely busy); no PR history keeps it too (either an agent still heading for its handoff, or the PR lookup hiccuped). A failed release never throws; the next sweep retries.

## Rationales

- Without the release, a branch left behind by a closed PR would stand its routine down forever: every firing finds the branch and reports a pending agent that does not exist.
- Deleting is safe exactly when the PR history proves the work over — the closed PR preserves the diff, so the branch is a leftover name, not the last copy of anything.
- A branch with no PR history is kept because deleting on a lookup hiccup would discard work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
