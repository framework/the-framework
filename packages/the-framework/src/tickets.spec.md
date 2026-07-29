The repo conventions for the human-facing roadmap: the `tickets/` directory (#629) and the flat `TODO_AGENTS.md` queue (#682), plus the ticket↔queue-entry link helpers (#1117/#1164).

## TLDR

- `TICKETS_DIR` = `tickets/` (only ticket files, `<DATE>_<SLUG>.md`, since #682 moved the backlog out); `FLAT_TODO_FILE` = root `TODO_AGENTS.md` — the durable AI task queue a run drains and the dashboard surfaces (the session-scoped `TODO_<slug>.agent.md` files are retired, #1369).
- `findFlatTodo()`: locates the flat backlog newest-convention-first: `TODO_AGENTS.md` → legacy `TODO-AGENTS.md` (hyphen spelling from the #682 brief) → `tickets/TODO.md` (#629 location) → root `TODO.md` (pre-#629). New backlogs are always created at `FLAT_TODO_FILE`.
- `todoPriorityForTicket()` (#1164): maps a ticket's `priority:` words onto the backlog's number scale — urgent→9, high→7, low→2, unmarked→5.
- `ticketFromQueueEntry()` / `isTicketPath()` (#1117): read a queue entry's markdown link back to its ticket; only `tickets/<name>.md` counts (no relative segments, absolute paths, URLs, dotfiles, or nesting) — one gate for both ends of the link, since the result is a path the dashboard renders and a reader opens.

## Decisions

- Priority mapping reserves the scale's ends per `todo_format.md`: 10 is "critical production bugs" (nothing queued by a click should claim it), 0 is "only if capacity" (a decision about the ticket, not a translation of it); an unmarked ticket sits in the middle — what "priority is optional" has to mean.
- The format specs are no longer named here as `node_modules/...` paths (they were unopenable and both files drifted, #1163); the content travels in the system channel (`CONTEXT_FORMATS` in system-prompt.ts). Priority sections need no parser support: `parseTodoEntries` returns entries in file order, so a priority-sorted file drains in priority order.
