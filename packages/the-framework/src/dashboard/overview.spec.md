Cross-project projections for the Overview/home surfaces (#437/#314): the "working now" rollup, recent runs rail, and the tickets pooling (hot-tickets card #1139 and the all-tickets page #1144).

## TLDR

- `buildOverview`: every project's live `running` runs (all worktrees since #736/#738, from `.the-framework/run.json` live metas), total open TODO count (via `collectQueue`), and the 5 most recently active projects.
- `buildRecentRuns`: all projects' runs pooled newest-first, capped at 30, each row tagged with its project — the shared sidebar's home recents.
- `collectAllTickets` (#1144): one ticket list per project, registry order, projects kept even when empty so import stays reachable — deliberately not pooled/bucketed.
- `buildHotTickets` (#1139): tickets pooled and bucketed into three lanes — `in-progress` (a live run records the ticket #1117, else planned), `ai-queue` (an open `TODO_AGENTS.md` entry links to it), `high-priority` — lane-ordered, capped at 60; tickets in no lane are dropped (the card is a shortlist, not the backlog).
- `ticketBucket` is the lane decision; everything takes injectable readers and is forgiving of read failures.

## Problems

- "Someone planned this at some point" vs "this is being coded as you look": only `RunMeta.ticket` from a live run is hard evidence (`runId` set, #1117), and it exists for drain runs only — the plan proxy still carries hand-worked tickets.

## Decisions

- Priority parsing: the ticket format's own 10–0 scale (10 = critical), so ≥7 is high — NOT the P0/P1 convention's low-numbers-first reading; getting that backwards kept `Priority: 8` backlogs off the card entirely. The word spellings (`high`/`urgent`/`p0`/…) are no longer read: the format says 0-10.
- Lane precedence in-progress > ai-queue > high-priority: work under way outranks queued, which outranks a flag.
- A queued ticket link only counts when it is the `[title](tickets/x.md)` link at the very START of an open queue entry (mirroring the dashboard's `queueEntryLabel`), returned as the bare filename that keys `WorkspaceTicket.file`.
- The implementing map is built per project because a ticket path is only unique within its own repo.
