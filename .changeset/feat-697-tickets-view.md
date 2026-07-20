---
"@gemstack/framework": patch
---

Add the tickets view (#697). The dashboard's right rail has a Tickets tab listing the project's `tickets/*.md`: title, TLDR, priority, and whether the agent has already spiked or planned it. A spike or a plan folds into the ticket it belongs to rather than appearing as a ticket of its own.

Each row can be put on the agent queue with one click, which appends it to `TODO_AGENTS.md` directly rather than spending a session to write one line. An empty `tickets/` offers to import the repo's GitHub issues instead of being a dead end.

Tickets written before the ticket format still list: a heading, a filename, or neither is enough to get a row.
