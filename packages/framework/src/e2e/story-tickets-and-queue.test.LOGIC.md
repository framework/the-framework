What the tests cover: tickets are proposals and the agent queue holds confirmed work.

- **Browsing the ticket backlog** - the project's Tickets page lists every ticket with its parsed title, priority and summary; a ticket's own page carries its full text; a name that escapes the tickets directory is refused; the cross-project ticket pages see the same backlog under the project.
- **Queueing a ticket** - the ticket page's Queue action lands an entry in `TODO_AGENTS.md` that links back to the ticket, and the Queue page counts it as open; the queued ticket shows on the hot-tickets rail.
