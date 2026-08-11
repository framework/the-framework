What the daemon does for a project: starting runs in isolated checkouts, retiring them when they end, and keeping every run recoverable.

## TLDR

- Each run gets its own worktree and branch, so concurrent runs never touch each other or the user's checkout; a project that is not a Git repo falls back to its main checkout, one run at a time. A repo whose worktree cannot be created fails the start rather than borrowing the user's working tree.
- A start is refused when the chosen agent cannot run (not installed or not logged in), so a doomed run spends no branch or worktree.
- A finished run's history is archived into the project; a clean finish loses its checkout, a failed or stopped run keeps it for inspection.
- A run killed by a transient connection error is continued automatically (at most twice), and a child that died before booting is marked failed with the cause surfaced — never left "waiting to start" forever.
- Project-less "topic" runs start in a neutral scratch dir and move into their project, conversation intact, once they bind to one.
- On shutdown, live runs are stopped and recorded so the next daemon resumes the same conversations in the same checkouts; a run can also be forwarded to a connected device, its events relayed back.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
