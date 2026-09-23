The `update-tickets` command skill: the prompt of the agent a runner starts for bringing the project's tickets up to date with its issue tracker, as a skill file the coding agent's harness expands from `/update-tickets`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner, the scheduler or a person, starts an agent with `/update-tickets`. The agent notes the time, reads when the tickets last caught up with the tracker, fetches what changed since, writes one ticket per issue, closes the tickets of closed issues and of the pull requests merged since, records the new import time, and says in one line how many it added, updated and closed.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The time first** - it notes the current UTC time before fetching anything, and records that time at the end, so an issue edited meanwhile is picked up by the next update rather than missed.
- **Where it starts from** - it reads when the tickets last caught up with the tracker; no such time and no tickets at all is a first import of every open issue, after which it goes straight to the record; tickets with no such time, a tracker it cannot reach, or a tracker it is not logged in to are an error shown to the user, saying which, and it stops; otherwise only what changed since that time is fetched, issues and their discussion.
- **One ticket per issue** - a new issue gets a ticket; an existing ticket is updated in place, keeping its file name, the lines above its title (priority, topics, issue, pull request) and its plan, the plan marked outdated when the change calls for it; a comment is folded in only where it changes what the work is, never pasted; a closed issue has its ticket closed, and a closed issue with no ticket gets none.
- **Merged pull requests** - every pull request merged since the last import whose body has a line `Closes tickets/<file>` has that ticket closed; a ticket already gone is nothing to do. This is how a ticket in review closes at its merge.
- **A rejected write** - a write to the tickets rejected because someone else wrote first is tried once more after reading again.
- **The record and the line** - the noted time is recorded as the new import time, and the agent says in one line how many tickets it added, updated and closed.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
