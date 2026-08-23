The Overview's "Hot tickets" card: a pooled cross-project shortlist of only the tickets that matter right now — the ones an agent is implementing, the ones sitting in the agent queue, and the ones flagged high priority. Every row is actionable: clicking it either opens the agent already working that ticket or opens its project's launcher pre-asked to work it.

## Business logic — TL;DR

- **Three lanes, nothing else** - In progress, AI Queue, and High priority; a ticket that is none of those does not appear here.
- **Complete lanes, never truncated** - each lane lists every ticket it holds with a count, never a "+N more", because a lane the user cannot read past forces them off the page to act.
- **A row opens the work, not the ticket** - a ticket an agent is implementing opens that agent; a ticket nobody has picked up opens its project's launcher with a ready-to-send draft asking for exactly that ticket and nothing else.
- **One tag per row, the one that earns the lane** - "implementing" when an agent is on it, otherwise "planned" for an in-progress ticket that has a plan, otherwise the priority for a high-priority ticket; agent-queue rows carry no tag because the lane already says it.
- **Live** - the whole card is re-read every ten seconds.
- **An honest empty state** - when nothing qualifies the card says so by naming the three lanes, never that there are no tickets.

## Business logic

### Three lanes, nothing else

#### User story

The user opens the Overview and wants one glance across all their projects at what is being worked on, what is queued next, and what they flagged as urgent — without reading every project's roadmap.

#### Business logic

The card projects every project's tickets and every project's agent queue into three lanes: In progress, AI Queue (the agent queue), and High priority, each with its own status colour — active, queued, and flagged respectively — and a count. The two lanes the user acts on off the queue, In progress and AI Queue, are stacked together; the High priority shortlist stands alone beside them. A lane with nothing in it dims to a single header line showing zero, so the populated lanes carry the card while the empty ones still say "nothing here".

Each row shows the ticket's title, its one tag, and which project it belongs to; hovering reveals the ticket's summary.

### A row opens the work, not the ticket

#### User story

The user spots a ticket on the card and wants to get to it in one click — to the agent already doing it, or to starting it.

#### Business logic

A ticket that names an agent opens that agent directly, since that agent is what the row is reporting. A ticket with no agent has nothing to jump to, so it opens its project's launcher, and the launcher arrives with the composer already holding the draft "Work on tickets/&lt;file&gt;. Do not start any other ticket." — the same wording the drain routine uses, narrowed to this one ticket. The draft is left editable in the composer rather than sent, so the user reads and adjusts the ask before it goes.

#### Rationale

The draft is plain text rather than a canned preset so there is no second, hidden version of the ask that could drift from what the row promised. Without the stashed draft, clicking such a row landed the user on an empty launcher with the ticket forgotten, which made the row a dead end.

### An honest empty state

#### User story

The user's roadmap is full but nothing is in progress, queued, or flagged.

#### Business logic

When no ticket qualifies for any lane, the card says "Nothing in progress, queued, or high priority." — it names the three lanes rather than claiming the backlog is empty, because the full ticket list may well not be.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
