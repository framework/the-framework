The cross-project Tickets view (#1144): every registered project's `tickets/*.md` backlog, one section per project, with status filters and a sort dropdown — its own full page, not a right-rail tab.

## TLDR

- Polls `onAllTickets` (10s) once for all projects; each section renders a poll-independent `TicketsPanel` (list + its own Update-from-GitHub bar) so one project's slow read never blanks another's.
- Filters (#1230): Open checked / Closed unchecked by default — the backlog is what needs doing; `hiddenByFilter` count is passed down so a fully-filtered project reads as filtered, not empty.
- Sort (#1265): "Date" is a no-op (`readTickets` already hands back newest-first — that IS date order); "Priority" re-sorts highest-first client-side via `parsePriority` (absent priority → -1), ties falling back to newest-first (`date.localeCompare`) rather than arbitrary order.
- `onOpenTicket(projectId, file)` routes to the detail page; `onOpenTicketPlan(projectId, file)` (optional) routes to the plan view (#685), re-bound per section onto its `TicketsPanel`'s `onOpenPlan`; `onRunStarted` is re-bound per section with its own projectId, since which project started an import isn't implied the way it is on a single-project page (#948).
- Full page width, no columns/max-width (#1265): each project's table spans the pane so a row fits title + all meta; columns "split the one dimension the rows actually need".
