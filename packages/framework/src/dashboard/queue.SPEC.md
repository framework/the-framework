Rolls every registered project's queued work up into the dashboard's cross-project Queue: it reads each project's surfaced `TODO*` documents — the agent queue `TODO_AGENTS.md` among them — and turns their markdown list items into entries, counted per project.

## Business logic — TL;DR

- **Every list item is an entry** - a markdown list item counts as queued work whether or not it carries a checkbox; only a ticked checkbox marks it done.
- **Most-open first** - projects are ordered by how much is still queued, and a project with nothing parsed is left out entirely.
- **A broken project is silently absent** - a project whose documents cannot be read is skipped rather than failing the roll-up.

## Business logic

### Every list item is an entry

#### User story

A triage agent fills the agent queue with entries written as ticket links and no checkbox. The user must still see those as queued work, and the Overview's count must match what the daemon will actually drain.

#### Business logic

Within a `TODO*` document, headings, prose and blank lines are ignored; every markdown list item — dash, star or numbered, at any indentation — is one queue entry. An entry that starts with a checkbox is done only when the box is ticked, and its text is what follows the box; an entry with no checkbox is open. An entry whose text is empty after the checkbox is dropped.

#### Rationale

This is deliberately the same rule the daemon's own queue-draining sweep applies. If the two disagreed, the dashboard could report "Nothing queued" while the daemon drains the very same file. An earlier rule recognised only checkbox entries, which read a whole queue of ticket-link entries as empty.

### Most-open first

#### User story

With several projects registered, the user wants the project carrying the most unfinished work at the top.

#### Business logic

Each project reports how many entries are still open and how many were found in total, along with the entries themselves. Projects are ordered by open count, highest first. A project with no `TODO*` document, no parsable entries, or an unreadable read contributes nothing to the list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
