---
name: update-tickets
description: Bring the project's tickets up to date with its issue tracker and its merged pull requests, unattended.
disable-model-invocation: true
---

Bring the tickets up to date with the project's issue tracker and its merged pull requests. Nobody will answer you: never ask, decide yourself.

1. Note the current UTC time, in ISO 8601, before you fetch anything: it is the import time you record at the end.
2. Read when the tickets last caught up with the tracker. If there is no such time and no tickets at all, this is a first import: bring every open issue across, then go to step 5. If there are tickets but no such time, or the tracker cannot be reached, or you are not logged in to it, show an error to the user saying which of those it is and stop.
3. Fetch the issues changed since that time, their discussion included. One ticket per issue: an issue with no ticket gets one; an issue with a ticket has it updated in place, keeping its file name, the lines above its title and its plan, the plan marked outdated when the change calls for it; a comment goes in only where it changes what the work is, never pasted; an issue now closed has its ticket closed, and gets none if it has none.
4. Fetch every pull request merged since that time. One whose body has a line `Closes tickets/<file>` has that ticket closed; a ticket already gone is nothing to do.
5. Record the time you noted as the new import time, and say in one line how many tickets you added, updated and closed.

A write to the tickets rejected because someone else wrote first is tried once more, after reading again. If this project has no ticketing system, show an error to the user and stop.
