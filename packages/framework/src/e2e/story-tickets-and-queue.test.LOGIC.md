What the tests cover: tickets are proposals and the agent queue holds confirmed work.

- **Browsing the ticket backlog** - the project's Tickets page lists every ticket with its parsed title, priority and summary; a ticket's own page carries its full text; a name that escapes the tickets directory is refused; the cross-project ticket pages see the same backlog under the project.
- **A queued ticket, read through the queue provider** - a queue seeded on the `agent-data` branch with a link back to a ticket, in that ticket's priority section, is what the framework reads by running the queue command the fixture's package declares: the project's block carries the entry as the command prints it, and the hot-tickets rail puts the ticket in the AI Queue lane.
