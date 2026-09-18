Fixes the one wording of the ask for a ticket's plan, "Create tickets/<stem>.plan.md", where the stem is the ticket's file name without its `.md`, so the sentence names the sibling `.plan.md` file the plan views read. It is the wording wherever the dashboard asks for plan work: the sentence its plan column starts an attended agent [2] with, and the queue entry [3] its queue-add writes on the agent queue [1]; one wording so the surfaces cannot drift apart and so a queued copy is recognizable by its exact text. The same sentence is how the agent that wrote a plan is found, since the plan file itself carries no mark of its author.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] queue entry: an item on the agent queue.
[4] the queued work: one agent started with `/work-queue`, which takes one task off the agent queue by composing the skills in its checkout.

## Business logic — TL;DR

- **The plan ask** - "Create tickets/<stem>.plan.md" for the ticket `tickets/<stem>.md`; as a queue entry it is plain text and not a link to the ticket, so it never reads as the ticket being queued for implementation.
- **Who wrote a plan** - the newest agent whose ask contains the plan ask for that ticket, whether the ask is the sentence itself (the plan column's attended start) or a longer prompt carrying it; a plan written by an agent whose ask never named it, such as one told `/work-queue`, is not attributed.
