The Overview's [1] "Hot tickets" card: a cross-project shortlist of tickets in three lanes — "In progress", "AI Queue" and "High priority" — re-read every 10 seconds, where selecting a ticket opens the agent [2] implementing it, or its project's launcher [3] with the composer [4] prefilled to work on that ticket. Which tickets qualify and which lane each sits in is the daemon's decision (the lane rules in `src/dashboard/overview.ts`); the card shows every ticket it is given, never a "+N more".

## Context

**User story**: from the Overview [1] the user sees at a glance, across every project, which tickets an agent [2] is implementing or has planned, which sit on the agent queue [5] for the daemon to pick up on its own, and which are flagged high priority; one click takes them to the agent working a ticket, or to a launcher [3] ready to start an agent on it.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] launcher: the Start form on a project's own page.
[4] composer: the prompt editor on a project's own page, also used for live chat.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[6] preset: a canned prompt the user launches from the dashboard.
[7] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.

## Business logic — TL;DR

- **Three lanes in two columns** - "In progress" and "AI Queue" stack on the left, "High priority" stands alone on the right; each lane's header carries a colored dot, its label and its count, and an empty lane dims to its header.
- **Every ticket, with its one tag** - a row shows the ticket's title, at most one tag ("implementing" in the accent color, else "planned", else the priority value) and its project's name; the tooltip shows the ticket's summary.
- **Selecting a ticket** - a ticket an agent is implementing opens that agent; any other ticket opens its project's launcher with the composer prefilled "Work on tickets/<file>. Do not start any other ticket."
- **Empty says what is empty** - with no hot ticket at all the card reads "Nothing in progress, queued, or high priority." rather than claiming there are no tickets.

## Business logic

### Three lanes in two columns

#### Context

See `## Context`.

#### Business logic

The card is titled "Hot tickets" with a flame icon. The tickets are re-read from the daemon every 10 seconds and split by the lane the daemon assigned. The lanes sit in two columns, stacking on a narrow screen: "In progress", with a dot in the accent color for active work, above "AI Queue", with an amber dot for what is queued, on the left — the two lanes the user acts on off the agent queue [5] — and "High priority", with a blue dot for what is flagged, alone on the right. Each lane's header is its label in small capitals, preceded by its dot and followed by its count. An empty lane dims to a single header line, dot faded and label muted with the count "0", so the populated lane carries the card and the zeros still say "nothing here" at a glance. A populated lane lists every ticket it holds; there is never a "+N more", since a lane the user cannot read past is one they would have to leave the page to act on. The only cap is the daemon's own pooling limit of 60 tickets across the lanes.

### Every ticket, with its one tag

#### Context

**Problem**: a lane that holds both a ticket being coded as the user reads and a ticket someone planned at some point must say which is which; "planned" is a mark work left behind, "implementing" describes something happening now.

#### Business logic

A row is a button showing the ticket's title, truncated with an ellipsis, then at most one tag, then the project's name at the right. The tag is the one fact that earns the ticket its lane: "implementing", outlined in the accent color, when an agent [2] is implementing the ticket right now; otherwise, in the "In progress" lane, "planned" when the ticket has a plan; otherwise, in the "High priority" lane, the ticket's priority value; an "AI Queue" row carries no tag, because the lane already says it. Only "implementing" is colored; the other tags are muted. Hovering a row shows the ticket's summary, or its title when it has no summary.

### Selecting a ticket

#### Context

**Problem**: a ticket nobody is implementing has no agent [2] to jump to; landing on its project's launcher [3] with an empty composer [4] and the ticket forgotten would make the row a dead end.

#### Business logic

A ticket an agent is implementing opens that agent's page: the daemon knows which agent recorded the ticket, and that agent is what the row reports on. Any other ticket opens its project's launcher and hands the composer the draft "Work on tickets/<file>. Do not start any other ticket." — plain text the user reads and edits before sending, so there is no second, hidden version of the ask; it names the ticket's file, the ticket's identity, rather than its title, which is prose the agent would have to search for. Its wording is the drain [7] preset's [6], narrowed to the one ticket. The draft is stashed for the launcher to take once on arrival (the hand-over rules in `lib/draft-handoff.ts`); opening an agent leaves no draft behind, so nothing surfaces later on an unrelated visit to a launcher.

### Empty says what is empty

#### Context

**Problem**: the card is a shortlist, and the Tickets page may be full while nothing qualifies for a lane; an empty state must not claim the backlog is empty.

#### Business logic

When the daemon returns no hot ticket at all, the card's body reads "Nothing in progress, queued, or high priority.", naming the lanes rather than saying "no tickets".
