What the tests cover:

- **Totals and the working-now list** - the project count and the open queue entries summed across projects, the agents currently going, and the collected queues are all reported.
- **Project order** - projects are listed most recently active first, since the onboarding checklist acts on the first one.
- **Ticket presence** - each project reports whether it has tickets, as the onboarding checklist reads it.
- **The payload's shape is pinned** - the data carries exactly the totals (projects, open queue entries), the working-now list, the projects (id and ticket presence only) and the queues, so a field can only be added back deliberately.
