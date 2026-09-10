Derives an agent [1]'s agent id [2] from the moment it starts, and reads that moment back out of an id. The id is the ISO start time with every `:` and `.` replaced by `-` (`2026-08-15T10:00:00.000Z` becomes `2026-08-15T10-00-00-000Z`): safe as a directory and branch name, and because the form is fixed-width, ids sorted alphabetically are sorted chronologically, which is how the dashboard's history orders agents by id alone. The inverse recognizes only ids of exactly that shape and yields nothing for any other name.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[3] sweep: a background job the daemon runs on its clock.
[4] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] run: only the `logs` skill's record of one agent on the `agent-data` branch.

## Business logic — TL;DR

- **The id is the start time** - minted by the daemon at the moment it starts an agent, or a beat earlier by the sweep [3] that claims [4] a ticket for the agent it is about to start, so the claim and the agent carry one id; the store mints one the same way for an agent that was started without one. The id names the agent's checkout [5], its birth branch and its run [6].
- **The start time is read back from the id** - a reader that has only the id recovers when the agent started: to date an agent whose process died before writing anything, to show only the pull requests opened since the agent started (a reused branch carries a predecessor's), and to tell how old a leftover remote branch named by an id is before removing it. A name that is not one of The Framework's ids yields no time, so it is never dated, never filtered by, and never removed as one.
