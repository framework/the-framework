---
"@gemstack/the-framework": minor
---

Tickets are now their own full-width page (#1144) instead of a tab squeezed into the 27rem right rail, reached from a "Tickets" row in the sidebar (below Overview) rather than needing a project selected first.

The page is cross-project: every registered project's `tickets/*.md` backlog gets its own full-width section — the table spans the whole pane rather than sharing it with grid columns — each with its own Import/Update-from-GitHub bar. Each ticket is a one-liner — topics, spiked/planned, the effort its spike/plan recorded, status, then a human-readable age ("2d ago"), "Priority: n", and its `GitHub:` issue link — dated by its filename (`<DATE>_<SLUG>.md`) rather than the file's mtime, and sortable by date (the default) or priority, with "Sort by" ties falling back to newest-first. Open/Closed checkboxes filter the backlog (Open only, by default); a project with tickets hidden by the filter says so instead of offering an import for work that already exists.

Clicking a row opens its own page at `/{projectId}/tickets/{filename}`, showing the ticket's entire markdown (not just the head a list row reads) and where the Queue button now lives. All of a ticket's meta — date, priority (spelled out as "Priority: n", not a bare number), its `GitHub:` link (as an issue-number link), status, topics, spiked/planned, and effort — sits below the description in that order.
