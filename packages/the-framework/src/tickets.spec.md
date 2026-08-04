The repo conventions for the human-facing roadmap: the `tickets/` directory (#629) and the flat `TODO_AGENTS.md` queue (#682), plus the ticket↔queue-entry link helpers (#1117/#1164).

## TLDR

- `TICKETS_DIR` = `tickets/` (only ticket files, `<DATE>_<SLUG>.md`, since #682 moved the backlog out); `FLAT_TODO_FILE` = root `TODO_AGENTS.md` — the durable AI task queue a run drains and the dashboard surfaces (the session-scoped `TODO_<slug>.agent.md` files are retired, #1369).
- `findFlatTodo()`: locates the flat backlog — the root `TODO_AGENTS.md`, and nothing else. The pre-#682 spellings (`TODO-AGENTS.md`, `tickets/TODO.md`, root `TODO.md`) are no longer read: one convention, one location. New backlogs are always created at `FLAT_TODO_FILE`.
- `todoPriorityForTicket()` (#1164): a ticket's numeric `priority:` (0-10) taken at its word; anything else — unmarked, out of range, fractional, or the retired word spellings — lands at 5.
- `ticketFromQueueEntry()` / `isTicketPath()` (#1117): read a queue entry's markdown link back to its ticket; only `tickets/<name>.md` counts (no relative segments, absolute paths, URLs, dotfiles, or nesting) — one gate for both ends of the link, since the result is a path the dashboard renders and a reader opens.

## Decisions

- Priority is numeric-only: the word spellings (`urgent`/`high`/`low`) once mapped here were never the format and are no longer read. An unmarked ticket sits in the middle — what "priority is optional" has to mean — and out-of-range/fractional values are not clamped into something plausible, since inventing a value hides the typo.
- The format specs are no longer named here as `node_modules/...` paths (they were unopenable and both files drifted, #1163); the content travels in the system channel (`CONTEXT_FORMATS` in system-prompt.ts). Priority sections need no parser support: `parseTodoEntries` returns entries in file order, so a priority-sorted file drains in priority order.
