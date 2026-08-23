What the tests cover: the roadmap loop — tickets are proposals, the agent queue holds confirmed work, and a drain agent claims the queue's next entry — as the Tickets and Queue pages drive it.

**Browsing the backlog**

- A project's Tickets page lists every ticket with its title, priority and summary read from the ticket file.
- A ticket's own page carries its full text, and a file name that would reach outside the tickets directory is refused.
- The cross-project tickets page shows the same backlog filed under that project.

**Queueing and draining**

- The Queue action on a ticket adds an entry to `TODO_AGENTS.md` that links back to the ticket, and the Queue page counts it as open work.
- A queued ticket appears on the Overview's hot tickets rail.
- A drain agent resolves the queue's next entry to its ticket and is started carrying that ticket, so while it runs its record names the ticket and the hot tickets rail links the ticket to the agent implementing it.

**Only a drain works the queue**

- An agent started from any other prompt claims no ticket, and the queued entry stays open — nothing else consumes the queue.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
