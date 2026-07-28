The cross-project TODO Queue rollup (#438/#314): parses task-list items out of each project's surfaced TODO docs and aggregates open/total counts per project, most-open first.

## TLDR

- `parseTodoItems`: every markdown list item (`-`, `*`, `1.`) is an entry; a leading GitHub-style `[ ]`/`[x]` checkbox sets done, an item *without* a checkbox counts as open.
- `collectQueue(projects)`: reads each project's `readDocs` output filtered to `TODO*` basenames, rolls items up per project; empty/unreadable projects omitted.

## Decisions

- The list-item rule deliberately matches the sweep's `parseTodoEntries` (todo-loop.ts): the queue's readers must agree on what an entry is, or the card says "Nothing queued" while the sweep drains the same file (#1296). Triage agents write the #1164 link style (`- [Title](tickets/x.md) — ...`) with no checkbox, and the old checkbox-only regex read that whole queue as empty.
