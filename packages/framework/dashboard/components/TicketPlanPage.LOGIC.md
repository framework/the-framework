One ticket's plan, rendered as markdown: the `.plan.md` file sitting beside the ticket, addressed by the ticket it belongs to, with a way back to the agent [1] that wrote it so the plan can be discussed with the one party that still has the reasoning in context.

## Context

**User story**: an agent [1] was asked to plan a ticket and wrote the plan into the repository. The user opens it from the ticket list's plan column, reads it, and — when it raises a question or needs a correction — picks the conversation back up with the agent that wrote it, rather than starting from scratch with an agent that has never seen the ticket.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] driver session: the coding agent's own conversation for one agent, which can be resumed by its session id.
[3] agent view: one agent's page in the dashboard.
[4] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.

## Business logic — TL;DR

- **The plan, addressed by its ticket** - the ticket's own file name decides which plan file is read, and the page names that path.
- **When there is no plan** - the page says so plainly instead of showing an empty document.
- **A long plan is cut, and says so** - the read is capped, and the page admits the tail is missing.
- **Picking the conversation back up** - the agent that wrote the plan is offered, to watch while it writes or to resume once it has finished.

## Business logic

### The plan, addressed by its ticket

#### Context

**Problem**: a plan has no identity of its own — it exists only as a ticket's plan. Addressing it by the ticket means the tickets list, the ticket's page and this page all name the same thing, and no separate index of plans has to be kept.

#### Business logic

The page is opened with a ticket's file name and reads the file beside it: `tickets/<stem>.plan.md`, the ticket's name with its `.md` replaced. The plan is read through the same guarded file read the dashboard's file previews use, which refuses paths outside the project and caps how much it returns. The file is re-read every 10 seconds, so a plan being written appears as it grows.

### When there is no plan

#### Context

See `## Context`.

#### Business logic

Until the first read returns, the page reads "Loading…". When no plan file is there — never written, or removed since the list was read — the page reads "This ticket has no plan yet.". A file that is not text is treated the same way. Starting an agent [1] to write the plan is offered on the ticket's row in the list, not here.

### A long plan is cut, and says so

#### Context

**Problem**: the guarded read caps the length it returns. A plan cut off silently would read as complete and the user would act on half a plan.

#### Business logic

When the read was cut short, the page adds "Plan truncated — open the file to read the rest." beneath the rendered plan.

### Picking the conversation back up

#### Context

**User story**: the plan raises a question, or is wrong in one place. The user wants to say so to the agent [1] that wrote it — which still holds the ticket, the plan and the reasoning behind it — instead of explaining all of that again to a new agent.

**Problem**: the plan file itself carries no mark of who wrote it.

#### Business logic

The agent that wrote a plan is found in The Framework's own records: the newest agent of that project whose ask named this exact plan — the "Create tickets/<stem>.plan.md" wording every surface uses to ask for a plan. An agent whose ask never named the plan, such as one that worked the agent queue's first open entry without naming it, is not attributed, and the page then shows no such offer. The attribution is re-read every 10 seconds.

When an agent is attributed, a line above the plan says which case this is and offers one button:
- While that agent is still running: "An agent is writing this plan right now." with an "Open agent" button, whose tooltip reads "Opens the session writing this plan, so you can watch it or step in."
- Otherwise: "Written by an agent whose session can be picked up where it left off." with a "Resume agent" button, whose tooltip reads "Opens the session of the agent that wrote this plan. Anything you send there continues that same conversation — the plan, the ticket and the reasoning behind it are already in its context."

Both open that agent's agent view [3]. Nothing is resumed by this page itself: a settled [4] agent's driver session [2] is continued by sending a message from that page, which is where the resuming already happens.
