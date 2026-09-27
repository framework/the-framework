What the tests cover, for the agent view's choice of which events to show — the live event stream or the finished agent's archive — and of when to read its branch:

- **A finished agent shows its archive** - once the agent is no longer running and its archive holds events, the archive's events replace the ones the live event stream delivered.
- **An empty archive never replaces what is on screen** - when the archive answers with no events (not written yet, or gone), the events already on screen stay and "This agent has no events." is not shown.
- **Nothing anywhere still says so** - a finished agent with no events on screen and an empty archive shows "This agent has no events.".
- **A stale archive never hides a resumed agent** - when the live event stream holds more than the archive (a resumed agent streaming its new events while the daemon's list still says it is not running), the stream's newer events are shown at once.
- **A foreign stream never beats the archive** - a live event stream whose first event does not match the archive's first event (the project root's event file, written by another agent) is never shown in place of the archive, however many events it holds.
- **The archive takes back over once it has caught up** - when the stream outgrows the archive, the archive is read again, and the re-read archive brings the events that exist only there, so a finished agent's "branch pushed" line reaches the screen without a page refresh.

It also covers when the view reads what the agent's branch holds:

- **Not while saving** - while the agent's card is marked saving, the branch is not read; once the mark is gone, it is.

And when the action bar is told its facts are ready:

- **Once its own reads are in** - a finished agent's bar is not ready while its archive is unanswered, still not once the archive has answered, and ready once the read of what its branch holds has answered too.
- **A second at most** - with an archive read that never answers, the bar becomes ready after a second.
- **A running agent at once** - a running agent's bar is ready from the first frame.

The rules for when a resume is offered belong to the composer and are covered by its own tests; the view only hands it how the agent ended.
