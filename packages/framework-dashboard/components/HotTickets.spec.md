The Overview's "hot tickets" card (#1139): a cross-project shortlist of in-progress, AI-Queue, and high-priority tickets, polled every 10s via `onHotTickets`.

## TLDR

- A projection of every project's `tickets/` + `TODO_AGENTS.md`; three lanes in two columns — In progress + AI Queue stacked left (what you act on off the queue), High priority alone right — with dot colours matching the status vocabulary (primary = active, warning = queued, info = flagged).
- A row whose ticket a run is implementing carries `runId` (#1117) and opens that session via `onSelectRun`; a run-less row stashes a composer draft (`stashPendingDraft`) and opens the project via `onSelectProject`, so the launcher rehydrates prefilled (#1066, taken once) instead of arriving empty — the dead end #1139 fixed.
- `workOnTicketDraft(file)` = "Work on tickets/<file>. Do not start any other ticket." — drain-preset vocabulary narrowed to one ticket; exported so tests assert the real string.
- `TicketTag`: `implementing` (coloured) when a run is on it, else `planned` for in-progress rows, else the priority for high-priority rows; AI-Queue rows carry nothing — the lane already says it.
- Empty card names the lanes ("Nothing in progress, queued, or high priority.") rather than claiming the backlog is empty — /tickets may be full while nothing qualifies.

## Decisions

- The draft is plain text, not a preset: the user reads and edits it in the composer before sending, so there is no second hidden version of the ask to drift from the button (#1187).
- The draft names the ticket *file*, not its title: the title is prose the agent would have to search for; the file is the ticket's identity.
- Every ticket in a lane renders, never "+N more": a lane you cannot read past is one you must leave the page to act on.
- `implementing` is coloured while `planned` stays muted (#1117): it is the only tag describing something happening as you read it; the other is a mark older work left behind.
- An empty lane dims to a single header line so the populated lane carries the card and zeros still read at a glance.
