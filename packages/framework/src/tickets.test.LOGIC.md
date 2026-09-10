What the tests cover:

- **The plan ask** - the sentence for a ticket file is exactly "Create tickets/<stem>.plan.md", and as a queue entry it links to no ticket, so it never reads as a ticket queued for implementation.
- **Who wrote a plan** - among the agents, the newest whose ask carries the sentence is named, whether the ask is the sentence itself or a drain's longer prompt containing it; another ticket's plan ask, an implementation ask that links the ticket, and an agent with no ask are not the author; a ticket nobody planned names no agent.
