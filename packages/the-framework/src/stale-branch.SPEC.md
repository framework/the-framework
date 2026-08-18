Releases a pinned routine branch its closed or merged PR left behind, so a recurring job stops reporting a pending agent that no longer exists.

## TLDR

- Routine agents pin their branch name so two firings never run at once — but nothing released the name, so the first PR closed without deleting its branch jammed the routine forever.
- A branch existing is not evidence of pending work; an open PR is. The branch goes only when its PR history proves the work is over: some PR existed and none is open. Deleting is safe exactly then — the closed PR preserves the diff, so the branch is a leftover name, not the last copy of anything.
- An open PR keeps the branch (genuinely busy); no PR history keeps it too (either an agent still heading for its handoff, or the PR lookup hiccuped — deleting on a hiccup would discard work). A failed release never throws; the next sweep retries.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
