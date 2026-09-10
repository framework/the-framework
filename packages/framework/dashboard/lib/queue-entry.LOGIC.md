Decides how one queue entry [1] reads on screen and what it opens. Entries are lines of `TODO_AGENTS.md`, so they are markdown: an entry queued from the dashboard for a ticket is written as a link to that ticket, and agents [3] append their own notes after it. Shown verbatim, such a line reads as source and the note pushes the title out of a one-line list entirely, so this splits an entry into the words a person should read and the destination behind them.

## Context

**User story**: on the Overview [4] and on a project's queue, the user reads the agent queue [2] as a list of named pieces of work, and clicking one that came from a ticket opens that ticket's own page.

## Glossary

[1] queue entry: an item on the agent queue: one line of `TODO_AGENTS.md`, either a link to a ticket or a self-contained task.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] the Overview: the dashboard's cross-project page at `/`.

## Business logic — TL;DR

- **The title is a link at the very start** - an entry that begins with a markdown link reads as that link's text, and everything after the link is the agent's [3] own note, which is detail rather than the name of the work and is left out of the one-line title. A link anywhere else in the line is part of a sentence, not the name of the work, so such an entry reads as the whole line with surrounding whitespace removed — as does an entry with no link at all.
- **A link into the tickets names a ticket** - a target under `tickets/` identifies the ticket by its filename, which is what lets the entry open that ticket's page. This is the same target the dashboard writes when the user queues a ticket.
- **Anything else points out, or nowhere** - a target that is a full web address is kept as a link out of the dashboard. Any other target, such as a bare path in the repository, has no page in the dashboard, so the entry keeps its title and points nowhere rather than offering a destination that leads to nothing.
