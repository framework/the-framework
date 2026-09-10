Rolls the agent queue [1] of every project up into the dashboard's cross-project Queue: the entries parsed out of each project's surfaced `TODO` documents, with how many are still open and how many there are in all, one block per project, the project with the most open entries first. The rule for what counts as a queue entry is the same one Auto PM [2] drains by, so the card and the daemon never disagree about the same file.

## Context

**User story**: with no project selected, the user sees how much work waits for agents across every project, and which project has the most, without opening each project's `TODO_AGENTS.md`. On the Overview, the count of open entries is the sum of these blocks.

**Problem**: two readers of one file with two ideas of what an entry is make the dashboard say "Nothing queued" while the daemon drains [3] that very file. Triage agents write entries as a ticket link followed by a note, with no checkbox; a reader that only counts checkboxes reads such a queue as empty.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[2] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[3] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.

## Business logic — TL;DR

- **What counts as a queue entry** - every markdown list item is an entry, open unless it starts with a checked checkbox; headings, prose and blank lines are not entries.
- **One block per project, most open first** - each project's `TODO` documents are parsed, a project with no entries is left out, a project that cannot be read is skipped, and the blocks are ordered by open entries, descending.

## Business logic

### What counts as a queue entry

#### Context

See `## Context`.

#### Business logic

Each line of a document is read on its own. A line that is a markdown list item, with `-`, `*` or a number followed by a period as its marker and any indentation before it, is one queue entry [1]; every other line, whether a heading, prose or blank, is ignored. When the item's text starts with a GitHub-style checkbox, `[ ]` makes the entry open and `[x]` or `[X]` makes it done, and the text after the checkbox is the entry's text; an item whose text after the checkbox is empty is dropped. An item with no checkbox is an open entry whose text is the whole item. This is deliberately the rule the daemon's own drain [3] parses by (`../todo-loop.ts`).

### One block per project, most open first

#### Context

See `## Context`.

#### Business logic

For each project, its surfaced documents are read (the rules in `docs.ts`) and those whose file name starts with `TODO` are parsed for entries, in document order. A project with no such document, or none with entries, contributes no block; a project whose documents cannot be read is skipped. A block carries the project's id and name, the count of open entries, the count of all entries and the entries themselves. The blocks are ordered by their open count, highest first.
