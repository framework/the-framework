Decides how one agent queue entry reads on screen and where clicking it goes.

Entries are lines of `TODO_AGENTS.md`, so they are markdown, and a ticket queued from the dashboard is written as a link back to its ticket. An entry that starts with a link shows that link's text as its title; anything written after the link is the agent's own note, which is detail for a tooltip rather than for a one-line list that would truncate the title away to make room for it. A link further into the line is part of a sentence rather than the name of the work, so it does not count as the title. An entry with no leading link shows as its own text.

The link's destination decides where the entry points: a target under `tickets/` names a ticket and opens that ticket's page, an absolute web address is kept as an outbound link, and anything else — a plain path inside the repo, say — keeps the title but points nowhere, since the dashboard has no page for it and a dead destination is worse than none.

## Business logic — TL;DR

- **The title is the leading link's text** - so the Overview's card reads as a title rather than as markdown source.
- **The agent's trailing note is not the title** - it stays out of the one-line entry.
- **Only a `tickets/` target is a ticket** - a web address is an outbound link; anything else points nowhere.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
