What the daemon does for a project: starting agents in isolated checkouts, retiring them when they end, and keeping every one of them recoverable.

## TLDR

- Each agent gets its own worktree and branch, so concurrent agents never touch each other or the user's checkout; a project that is not a Git repo falls back to its main checkout, one agent at a time. A repo whose worktree cannot be created fails the start rather than borrowing the user's working tree.
- A start is refused when the chosen driver cannot run (not installed or not logged in), so a doomed agent spends no branch or worktree.
- The agents the daemon is still responsible for — spawning, running, or mid-retirement — are named for the background sweep, so it never reclaims a checkout out from under a teardown.
- A finished agent's history is archived into the project, and its checkout is reclaimed once the work reaches the remote — the one retention rule, applied whatever the agent did. A push that cannot land keeps the checkout, and the background sweep retries it later.
- An agent killed by a transient connection error is continued automatically (at most twice), and a child that died before booting is marked failed with the cause surfaced — never left "waiting to start" forever.
- On shutdown, live agents are stopped rather than orphaned; each keeps its worktree and branch, so the dashboard can continue the same conversation in the same checkout when asked. An agent can also be forwarded to a connected device, its events relayed back.
- Stopping resolves when the daemon has let go of the repo, not when the processes die: a child's exit event lands after its pid disappears, and the teardown that event starts — archive the agent, commit its work, keep or remove its checkout — runs well past that. The archive commit behind it would otherwise miss the ending of an agent still being archived. A teardown that wedges costs the shutdown its grace period, not the exit.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
