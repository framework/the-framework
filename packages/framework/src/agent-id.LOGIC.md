Derives an agent [1]'s agent id [2] from the moment it starts, and reads that moment back out of an id. The id is the ISO start time with every `:` and `.` replaced by `-` (`2026-08-15T10:00:00.000Z` becomes `2026-08-15T10-00-00-000Z`): safe as a directory and branch name, and because the form is fixed-width, ids sorted alphabetically are sorted chronologically, which is how the dashboard's history orders agents by id alone. The inverse recognizes only ids of exactly that shape and yields nothing for any other name.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] run: only the `logs` skill's record of one agent on the `agent-data` branch.

## Business logic — TL;DR

- **The id is the start time** - the tool that starts an agent mints the id at that moment, in this form (the scheduler's ids are the same form). The id names the agent's checkout [3], its birth branch and its run [4].
- **The start time is read back from the id** - a reader that has only the id recovers when the agent started: to date an agent whose process died before writing anything, to show only the pull requests opened since the agent started (a reused branch carries a predecessor's), and to tell how old a leftover remote branch named by an id is before removing it. A name that is not one of The Framework's ids yields no time, so it is never dated, never filtered by, and never removed as one.
