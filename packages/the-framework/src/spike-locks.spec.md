The PENDING lock for concurrent spike agents (#1327): before a fanned-out [Spike & plan] agent starts, its ticket's `.spike.md`/`.plan.md` are created as `PENDING:<AGENT_ID>` placeholders, committed in one batch and pushed — a claim made where every agent already looks, so it needs no cooperation from anyone who has not heard of it.

## TLDR

- `acquireSpikeLocks(cwd, assignments)` — write both placeholders per ticket, one pathspec-scoped batch commit, push to origin's default branch, only when the checkout is on it (`HEAD:main` from a feature branch would carry that branch's commits onto main — #1364 review); resolves the subset actually locked. Skips a ticket whose sibling already exists (real or placeholder). Commit failure rolls the files back and resolves `[]`; push failure keeps the batch and logs.
- `releaseStaleSpikeLocks(cwd)` — frees a lock that is all three of: still a placeholder, older than `SPIKE_LOCK_STALE_MS` (6 h, by its last commit time — spiking and planning can take hours, and this is recovery, ideally never needed), and untouched by any open PR. One batch commit + best-effort push; resolves the released tickets.
- `isSpikeLock(md)` / `spikeLockContent(agentId)` — the placeholder telling: first non-blank content starts with `PENDING:`. Shared with the dashboard's ticket reader so a lock never renders as a real spike.

## Problems

- The guard cannot be daemon memory: a hands-off web run's local process ends at the hand-off (#1253), another machine's daemon shares nothing, and the #1313 PR-diff claims only start once a PR exists. The lock files cover the window *before* a PR; #1313 covers after.
- Agents cannot push (#1320), so the daemon writes and pushes the locks — a lock that only existed inside the run it protects would protect nothing.
- A dead agent must not brick its ticket forever, hence the staleness rule (#1327's thread): PENDING + no open PR + N hours.

## Decisions

- The claim is the *commit*, not the file: files that never reached one are rolled back rather than left as uncommitted noise, and the sweep falls back to a single unpinned agent.
- Push failure is tolerated (logged, batch kept): the commit still guards every run forked from this checkout — the common case — and standing a healthy local fan-out down over a network blip would be worse. The push is the cross-machine half only.
- Staleness is conservative three ways: an *uncommitted* placeholder is a batch mid-acquisition (never released); an open PR touching the file keeps it however old (the agent finished; #1313 owns the window now); an unreadable PR answer keeps it too (releasing over a `gh` hiccup re-opens the double-work window, while a dead agent's ticket only waits one interval longer).
- Release deletes only the PENDING files of a stem — a real spike beside a stale placeholder plan stays.
- Both operations never throw: they run on a background tick with nothing to catch them.
