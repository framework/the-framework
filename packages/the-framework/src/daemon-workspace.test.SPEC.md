Covers where an agent is allowed to land and what happens when it dies: a repo whose worktree cannot be created refuses the start instead of borrowing the user's checkout, a start landing after the stop pass refused rather than spawned as an unstoppable orphan, a child that dies at boot is marked failed with its actual error, transient connection deaths earn a bounded number of automatic continuations while real failures stand, and a logged-out driver is refused before any branch or worktree is spent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
