---
"@gemstack/the-framework": minor
---

Tickets are now their own full-width page (#1144) instead of a tab squeezed into the 27rem right rail, reached from a "Tickets" row in the sidebar (below Overview) rather than needing a project selected first.

The page is cross-project: every registered project's `tickets/*.md` backlog gets its own section, each with its own Import/Update-from-GitHub bar. Each ticket is a one-liner — priority, topics, spiked/planned, and a human-readable age ("2d ago", "2w ago") — sorted newest-first by the file's mtime. Clicking a row opens its own page at `/{projectId}/tickets/{filename}`, showing the ticket's entire markdown (not just the head a list row reads) and where the Queue button now lives.
