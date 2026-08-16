What the daemon does for a project: starting runs in isolated checkouts, retiring them when they end, and keeping every run recoverable.

## TLDR

- Each run gets its own worktree and branch, so concurrent runs never touch each other or the user's checkout; a project that is not a Git repo falls back to its main checkout, one run at a time. A repo whose worktree cannot be created fails the start rather than borrowing the user's working tree.
- A start is refused when the chosen agent cannot run (not installed or not logged in), so a doomed run spends no branch or worktree.
- The runs the daemon is still responsible for — spawning, running, or mid-retirement — are named for the background sweep, so it never reclaims a checkout out from under a teardown.
- A finished run's history is archived into the project, and its checkout is reclaimed once the work reaches the remote — the one retention rule, applied whatever the run did. A push that cannot land keeps the checkout, and the background sweep retries it later.
- A run killed by a transient connection error is continued automatically (at most twice), and a child that died before booting is marked failed with the cause surfaced — never left "waiting to start" forever.
- Project-less "topic" runs start in a neutral scratch dir and move into their project, conversation intact, once they bind to one.
- On shutdown, live runs are stopped rather than orphaned; each keeps its worktree and branch, so the dashboard can continue the same conversation in the same checkout when asked. A run can also be forwarded to a connected device, its events relayed back.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
