One ticket's own page: its whole markdown rather than the one line the list shows, everything known about it (age, priority, the GitHub issue it tracks, its topics, whether it is planned, who holds it, its effort and uncertainty ratings, its file name), a button that puts it on the agent queue [1], and, when an agent [2] holds it, a button that lifts that claim [3].

## Context

**User story**: the user opens a ticket from the backlog to read what it actually asks for, decides it should be worked next and queues it from there, or sees that an agent [2] has held it since long after that agent died and lifts the claim [3] so somebody else can take it.

**Business logic story**: a ticket is a markdown file under `tickets/` on the project's `agent-data` branch [4]. The page reads that one file by its name — the same name the list row and the page's own address carry — so it never needs the list it was opened from.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. The dashboard labels it "AI queue".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] session name: the name an agent gives its own work; the dashboard labels the agent by it.

## Business logic — TL;DR

- **The ticket as it is written** - the whole file rendered as markdown, re-read every 10 seconds, with a plain answer when there is no such ticket.
- **What is known about the ticket** - one line of facts under the summary, in a fixed order, ending with the ticket's file name.
- **Queueing the ticket** - one button puts the ticket on its project's agent queue at its own priority, and then says so.
- **Lifting a claim** - a claimed ticket offers to release the claim, because nothing else ever will.

## Business logic

### The ticket as it is written

#### Context

See `## Context`.

#### Business logic

The page shows the ticket's title as its heading, its summary beneath, and then the ticket's entire content rendered as markdown. A back control returns to the list the ticket was opened from.

The ticket is re-read every 10 seconds, so a ticket an agent [2] edits, claims [3] or plans is updated on screen while the user is reading it. Before the first read the page reads "Loading…". A ticket that does not exist — deleted between the list and this read, or a hand-typed address — reads "This ticket does not exist." rather than an empty page.

### What is known about the ticket

#### Context

**Problem**: a ticket carries facts that decide what happens to it — its priority, whether it has a plan, whether an agent [2] already holds it — and they must be readable at a glance and always in the same order, so the page is scannable across tickets.

#### Business logic

Under the summary, in this order: the ticket's age ("2d ago", with the exact date and time on hover), "Priority: N" colored red from 8 up and amber from 5 to 7, a link to the GitHub issue the ticket tracks showing that issue's label and opening in a new tab, one badge per topic, "planned" when the ticket has a plan, the claim badge described below, "Effort: N" and "Uncertainty: N" when the ticket's plan recorded them, and last the ticket's file name.

Each of these appears only when the ticket has it, so a bare ticket shows only its age and its file name.

The claim badge reads "claimed" in the warning color, followed by the holder [4] when the claim names one. The holder reads as the agent's session name [6] when the claim names one of this project's agents, and clicking it opens that agent's page; any other holder is shown exactly as the claim wrote it and opens nothing.

### Queueing the ticket

#### Context

**User story**: the user has read the ticket and wants it worked, but not right now: it goes on the agent queue [1], where the daemon's own unattended work or the user picks it up later.

#### Business logic

A "Queue" button adds the ticket to its project's agent queue [1] as one entry: the ticket's title, linked back to the ticket's file, placed by the ticket's own `Priority:` when it has one. It starts no agent [2].

After a successful click the button reads "Queued" with a check mark and stays disabled for as long as the page is open, so the same ticket is not queued twice from the same reading. A refusal shows the daemon's reason, or "The ticket could not be queued." when it gives none, as red text above the ticket's content.

The button is disabled while either action on the page is in flight.

### Lifting a claim

#### Context

**Problem**: nothing times a claim [3] out. An agent [2] that died mid-work leaves its claim standing, and that ticket is then untouchable by every other agent until a human lifts it.

#### Business logic

While the ticket is claimed, a "Release lock" button sits beside "Queue", with "Claimed by <holder>" on hover when the claim names a holder [4]. Clicking it removes the ticket's claim.

The page treats the claim as lifted as soon as the release succeeds — the claim badge and the button both go — rather than waiting for the next read to catch up. A refusal shows the daemon's reason, or "The lock could not be released." when it gives none, and the ticket stays claimed.
