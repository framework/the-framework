The cross-project Tickets view (#1144): every registered project's `tickets/*.md` backlog with a full filter/sort/group toolbar — its own full page, not a right-rail tab.

## TLDR

- Polls `onAllTickets` (10s) once for all projects; grouped mode renders each project as its own poll-independent `TicketsPanel` (list + its own Update-from-GitHub bar) so one project's slow read never blanks another's.
- The whole viewing state is one `TicketsView` (see `lib/ticket-filter.spec.md`) rendered by `TicketFilterBar`: search, priority/topics/stage/effort/uncertainty/project/unlinked facets, sort with direction, Group by project vs a flat list. A shown/total tally (`12/75`) sits beside the page title — unfiltered it reads n/n, doubling as the backlog's total.
- **The URL is the selection, filters included** (route.ts's #784 doctrine): the view mounts from `location.search` and mirrors every change back via `history.replaceState` — replace, not a navigation, so Back steps over filter tweaks, and a filtered view is a link you can share, reload, and return to from a ticket's detail page. Defaults render the bare `/tickets`.
- Filtering runs on the flattened cross-project pool (`flattenTickets` → `filterRows` → `sortRows`); grouped mode slices the result per project, passing `hiddenByFilter` so a fully-filtered section reads as filtered (with a Clear button via `onClearFilters`), not empty — the import offer is for genuinely empty projects only (#1230's rule, kept).
- Group: none (#1144) is the flat cross-project list — the one view that can answer "what is the single highest-priority ticket anywhere". Rows are `TicketRow`s tagged with their project name, no per-project Update bars, one global hidden-count line; plan starts run through the page's own `useAction` since each row carries its own projectId.
- Click-to-filter: a row's topic badge adds its topic (additive — a second click widens the OR), the claim marker narrows to Stage: Claimed; both are threaded to rows in grouped and flat mode alike.
- A project deselected in the Project facet disappears entirely rather than sitting as a "N hidden" stub — that hiding was asked for by name.
- `onOpenTicket(projectId, file)` routes to the detail page; `onOpenTicketPlan` to the plan view (#685); `onRunStarted` is re-bound per section (or per flat row) with its own projectId (#948).
- Full page width, no columns/max-width (#1265): each project's table spans the pane so a row fits title + all meta.

## Decisions

- No status filter: the #1230 Open/Closed toggles died with the `status` key — a closed ticket is removed from the repo per the format, so everything listed is open work.
- `replaceState` over vike navigation for filter changes: filters are page state, not a route — pushing history per keystroke would bury the Back button, and the shell's router only owns the path.
