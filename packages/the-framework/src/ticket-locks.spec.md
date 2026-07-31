The `.lock.md` claim on a ticket (#1420, replacing #1327's PENDING placeholders): before a fanned-out [Spike & plan] agent starts, its ticket gains a `tickets/<STEM>.lock.md` sibling holding `CLAIMED: <AGENT_ID>`, committed in one batch and pushed — the file the ticketing format defines, made where every agent already looks, so it needs no cooperation from anyone who has not heard of this module.

## TLDR

- `acquireTicketLocks(cwd, assignments)` — write one `.lock.md` per ticket, one pathspec-scoped batch commit, push to origin's default branch, only when the checkout is on it (`HEAD:main` from a feature branch would carry that branch's commits onto main — #1364 review); resolves the subset actually locked. Skips a ticket whose lock or plan already exists. Commit failure rolls the files back and resolves `[]`; push failure keeps the batch and logs.
- `releaseTicketLock(cwd, ticket)` — the manual release (#1420): delete the lock, one commit, best-effort push; `'released' | 'no-lock' | 'error'`. A failed commit puts the file back — the lock's protection is the committed state. This is the dashboard button's backend, and the *only* release besides the agent's own PR deleting the file.
- `ticketLockName(ticket)` / `ticketLockContent(agentId)` / `ticketLockHolder(md)` — the claim telling: `<stem>.lock.md`, first non-blank content `CLAIMED: <holder>`. The holder is shown by the dashboard so a human can tell whose claim they are about to release.

## Problems

- The guard cannot be daemon memory: a hands-off web run's local process ends at the hand-off (#1253), another machine's daemon shares nothing, and the #1313 PR-diff claims only start once a PR exists. The lock file covers the window *before* a PR; #1313 covers after.
- The agent cannot place the lock in time (#1420 discussion): it pushes at the *end* of its session onto its own branch, and a lock protects nothing unless it is on the default branch — where runs fork from — *before* work starts. Cloud sessions cannot push at all (#1320). So the daemon writes and pushes the locks, never the agent.
- A dead agent must not brick its ticket forever — but a timer is the wrong judge (#1420): a coordinator can live for days, and a lock released under a live agent re-opens the double-work window. Watching the queue is the user's responsibility; `releaseTicketLock` is their tool.

## Decisions

- One lock file per ticket for its whole life (#1420), not per-phase placeholders: the old mechanism pre-created `.spike.md`/`.plan.md` as `PENDING:` content, which made existence stop meaning work done and only covered spiking. `.lock.md` is a separate name, so a plan's existence is a plan again.
- The claim is the *commit*, not the file: files that never reached one are rolled back rather than left as uncommitted noise, and the sweep falls back to a single unpinned agent.
- Push failure is tolerated (logged, batch kept): the commit still guards every run forked from this checkout — the common case — and standing a healthy local fan-out down over a network blip would be worse. The push is the cross-machine half only.
- No timed release (#1420 dropped the 6h rule; `SPIKE_LOCK_STALE_MS` and `releaseStaleSpikeLocks` are gone): release is the agent's PR deleting the file, or a human's explicit click.
- The lock lifts *with the work*: the pinned prompt tells the agent to delete `.lock.md` in the same commit that adds the real `.plan.md`, so the merge that lands the plan frees the ticket in the same instant.
- Both operations never throw: they run on a background tick or behind an RPC with nothing to catch them.
