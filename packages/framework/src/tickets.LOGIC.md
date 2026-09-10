Fixes the one wording of the ask for a ticket's plan, "Create tickets/<stem>.plan.md", where the stem is the ticket's file name without its `.md`, so the sentence names the sibling `.plan.md` file the plan views read. It is the wording wherever plan work is asked for: the sentence the "Plan tickets" preset queues on the agent queue [1], the sentence the dashboard's plan column starts an attended agent [2] with, and the queue entry [3] the dashboard's bulk queue-add writes; one wording so the surfaces cannot drift apart and so a queued copy is recognizable by its exact text. The same sentence is how the agent that wrote a plan is found, since the plan file itself carries no mark of its author.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] queue entry: an item on the agent queue.
[4] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.

## Business logic — TL;DR

- **The plan ask** - "Create tickets/<stem>.plan.md" for the ticket `tickets/<stem>.md`; as a queue entry it is plain text and not a link to the ticket, so it never reads as the ticket being queued for implementation.
- **Who wrote a plan** - the newest agent whose ask contains the plan ask for that ticket, whether the ask is the sentence itself (the plan column's attended start) or a longer prompt carrying it (a drain [4] pinned to that entry); a plan written by an agent whose ask never named it, such as an unpinned drain told to work "the first open entry", is attributed to nobody.
