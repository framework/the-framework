The project home / launcher (what "Live" selects): `ProjectActions` bar + `StartRunForm` + a `RunOverview` of current events + the two #1455 sections (`OpenQuestions`, `ProjectTickets`) — never consumed by a run, so you can keep launching.

## TLDR

- Starting a run appends it to the rail with its own RunView alongside; this page stays put (running several at once lands with git worktrees, #453).
- Threads the Context-picking state (`files`, `context`, add/remove/toggle) into `StartRunForm`; `onRunStarted` carries the started run's id (and `runsOn`) up to the shell — dropping that id was bug #1169.
- `RunOverview` renders only when there are events.
- Below the form (#1455): `OpenQuestions` (every session's parked gate, answerable in place, item 4) and `ProjectTickets` (the active project's backlog in the /tickets presentation, item 5); `onOpenSession` / `onOpenTicket` / `onShowAllTickets` thread their navigation up to the shell.
- The whole column is a `ScrollArea` since the two sections can be tall — the form alone never needed to scroll.
