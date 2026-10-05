What the tests cover, for the agent view's choice of which events to show — the live event stream or the finished agent's archive — and of when to read its branch:

- **A finished agent shows its archive** - once the agent is no longer running and its archive holds events, the archive's events replace the ones the live event stream delivered.
- **An empty archive never replaces what is on screen** - when the archive answers with no events (not written yet, or gone), the events already on screen stay and "This agent has no events." is not shown.
- **Nothing anywhere still says so** - a finished agent with no events on screen and an empty archive shows "This agent has no events.".
- **A stale archive never hides a resumed agent** - when the live event stream holds more than the archive (a resumed agent streaming its new events while the daemon's list still says it is not running), the stream's newer events are shown at once.
- **A foreign stream never beats the archive** - a live event stream whose first event does not match the archive's first event (the project root's event file, written by another agent) is never shown in place of the archive, however many events it holds.
- **The archive takes back over once it has caught up** - when the stream outgrows the archive, the archive is read again, and the re-read archive brings the events that exist only there, so a finished agent's "branch pushed" line reaches the screen without a page refresh.

It also covers when the view reads what the agent's branch holds:

- **While saving** - while the agent's card is marked saving, an empty branch is not offered, and the branch is read again once the mark is gone, then offered; a branch with commits, pushed or not, is offered while the mark is still there.

And the bar above the message box:

- **One read of the checkout** - the agent's checkout is read once, for that project and agent, and the same answer (its branch) is handed to the action bar and to the bar above the message box.
- **Read again as a turn ends** - when the events show the agent's turn ending, the checkout is asked for a second time at once, and its new answer (dirty) reaches the bar above the message box.
- **Where the next step is** - an ended agent's "Open PR" is inside the bar above the message box, the bar is told to show, and that bar comes after the action bar and before the composer in the page's order.

And when the bar above the message box is there:

- **A working agent** - the bar is told not to show while the agent's checkout is clean, to show once the checkout holds uncommitted changes, and still to show once the checkout is clean again.
- **An ended agent** - one whose branch holds no commit is told not to show; one whose checkout names a pull request (a merged one) is told to show.
- **As the agent ends** - a working agent with uncommitted changes ends and its checkout is gone: the bar is still told to show while the read of what its branch holds is unanswered, and told not to show once the read answers that the branch holds nothing.

And when the action bar is told its facts are ready:

- **Once its own reads are in** - a finished agent's action bar is not ready while its archive is unanswered, still not once the archive has answered, and ready once the read of what its branch holds has answered too.
- **A second at most** - with an archive read that never answers, the action bar becomes ready after a second.
- **A running agent at once** - a running agent's action bar is ready from the first frame.

And when the feed fills in, on a first visit:

- **Not before the archive** - a finished agent's feed shows neither the live event stream's events nor "Loading agent…" while its archive is unanswered, and shows the archive once it answers.
- **An agent not known to run yet** - before the daemon's list is read, the feed says neither "Waiting for the session to start…" nor "Loading agent…", the action bar is not ready, and neither the archive nor the branch is read.
- **A second at most** - with an archive read that never answers, "Loading agent…" shows after a second.
- **A watched agent keeps its events** - an agent that stops while shown keeps the live event stream's events on screen while its archive is read.

And what the installed modules add to an agent's page:

- **A working agent** - shows each module's summary in the bar above the message box, told the agent and that it is working.
- **An ended agent** - once the read of what its branch holds has answered, the modules' summary is gone from the bar above the message box.
- **A project without the module** - gets no summary.

And what the action bar's disclosure opens:

- **The details strip alone** - for an ended agent whose branch holds a commit, the opened disclosure shows the details strip, which is not there while closed, and no "Commits" or "Changed files" list.

- **A continued agent reads as going** - an ended agent's feed gets a new segment: the composer is told the agent is live; the archive is read again and holds the same lines, the list still saying ended: still live; the segment's end arrives: not live. An ended agent whose archive holds a segment with no end, shown from the first read, is not live.
- **While the agent commits** - an ended agent that left a file uncommitted: "Commit" pressed shows "Commit your work." in the feed and "Committing…" in the button's place, with no button, while the send is out; a refused send brings the button back and the line goes. A working agent whose last prompt is the ask, alone or with a publish sentence after it, says "Committing…"; one whose last prompt only begins with the same words says nothing; once the turn ends the button is back. While the ended agent's checkout is cleaned up and until its branch is read again, "Committing…" stays, the old "Commit" button never returns, and the new next step takes the line's place.
- **The next step while the agent works again** - a merged agent: the bar above the message box is told to show and says "Merged into the main branch.". Sent a new message: once its events show the new turn, "Merged into the main branch." leaves the bar above the message box although the daemon's list still says it ended; when the turn ends, the old line does not come back before the new read answers, and then "Commit" is offered.

The rules for when a resume is offered belong to the composer and are covered by its own tests; the view only hands it how the agent ended. What it hands over is covered here: with the events not read yet, the ending the agent's record says (an agent waiting on an answer reads as waiting from the first frame); once the events are read, the ending they say; with no record and no events, nothing.
- **The pull request lookup is waited for** - while the branch's read says its pull request lookup is still out, and while the next read is unanswered, the action bar is not ready; once the next read has the answer, it is.
- **A run just started** - its prompt shows before any event, with "Starting session" under it, and once its own prompt line arrives it shows once, with "Working…" under the agent's first row; no spinner while the answer is being written, and none once the run has ended. A chat the agent has written in shows no "Session set up" line before the agent's card is listed; once it is, the line opens to the checkout's folder and the branch the card says; a card that also names the branch the agent was told to start from adds "Started from the branch my/work, not from the main branch.", and a card that names none does not.
- **A subagent's own page** - an agent whose card names a parent is offered no "Open PR" for a pushed branch with commits: the bar above the message box says "not landed", and never "pushed"; the same branch on an agent with no parent is offered "Open PR" and says nothing of landing.
- **The next step of an agent whose subagents still work** - "Open PR" is not offered while a subagent is running, and is once none is; nor is it offered right after a subagent ended, since its main agent is about to go on.
- **A question the agent stopped on** - it is a panel placed before the composer and outside the transcript, and the transcript holds one "Asking" line with the question and none of its options; an answer typed in "Other" is sent as the user's message for that project and agent and shows at once as the transcript's last message of the user's; once the agent has gone on, the panel is gone.
