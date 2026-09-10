The red banner at the top of a project's page naming what the daemon currently finds wrong with the project, one alert per kind of error: a headline for the kind, the failing command's own words, and since when. Today the one kind is "Not syncing with the remote": the project's `agent-data` branch [1] cannot reach the remote, so agents [2] would work from stale tickets and fill an agent queue [3] nobody else sees.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **No error, no banner** - a project the daemon has no complaint about shows nothing at all.
- **One alert per error** - each error reads as an alert with a warning icon, its headline ("Not syncing with the remote" for a data-sync error), " · since <age>" (as "3h ago", "2d ago", "1w ago"), and under it the message the failing command printed, as the user would see running it by hand (for example "the data branch could not be pushed: Permission denied (publickey)").
- **Nothing to dismiss** - the banner has no state and no close button: it renders exactly what the daemon records, the daemon keeps the original "since" when it re-reports the same error, and the banner goes away only when the daemon clears the error because the condition is gone.
