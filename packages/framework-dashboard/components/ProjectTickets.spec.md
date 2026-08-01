The active project's tickets on the launcher (#1455 item 5): the same presentation as the /tickets page, scoped to the current project.

## TLDR

- Polls the project-scoped `onTickets(projectId)` (10s) and renders `TicketsPanel` — the /tickets page's own per-project list, freshness bar and GitHub import/update buttons included — so the two surfaces cannot drift.
- Open tickets only, in the /tickets default order (newest first, as `readTickets` hands them back); the closed remainder rides `hiddenByFilter`, so an all-closed backlog reads as "filtered", never "no backlog".
- Header counts the open tickets and links to the full cross-project page (`onShowAllTickets`); `onOpenTicket(file)` opens a ticket's detail page; `onRunStarted` carries the panel's import/update session up to the shell (#948).
- A project with no `tickets/` at all gets no section: the /tickets page is where a backlog is started, and an empty panel with import buttons on every launch is noise.
