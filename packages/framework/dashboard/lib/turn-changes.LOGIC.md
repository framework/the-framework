Reads, off an agent's [1] events [2], the files each turn's [3] edits [4] changed: per turn, each file once, with the lines its edits added and removed.

## Context

**User story**: at the end of each turn, the agent's transcript shows a row for each file the turn changed, with the lines added and removed, as Claude Code on the web does (`components/EventList.tsx`, `components/ChangedFiles.tsx`). A click on a row shows that file's change in the side panel's Changes tab.

**Business logic story**: the tool that runs the coding agent writes, on the output of each tool call that edited files, the files the call changed: each file's path, the lines added, the lines removed, and whether the call made the file. Nothing else is read here: no git read is made, so the rows are the same while the agent works, after a reload and once the agent's checkout is gone.

**Problem**: the coding agents name a file by its whole path on the machine, and the Changes tab names it by its path in the agent's checkout. Asked for by its whole path, the file would not be found there.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message. Here, the events between one prompt and the next.
[4] edit: a tool call of the coding agent that changed files itself (writing a file, editing one, applying a patch) and whose output says the files it changed. A shell command that changes a file is no edit: its output says no file.

## Business logic — TL;DR

- **One list per turn** - the files of a turn [3] a later prompt ended are kept under that prompt; the files of the last turn, which no prompt has ended yet, are kept apart; a turn that changed no file has no list.
- **Each file once, its edits summed** - a file edited several times in a turn is one file, in the order first changed, with the lines added and the lines removed summed.
- **A file the turn made** - it holds the lines added less the lines removed again, never below zero, and removed none.
- **A path said from the agent's checkout** - a path inside the folder of the agent's checkout is said from that folder; any other path is left as it is; the file's name is the path's last part.
- **Only edits** - a file changed by a shell command is not there.

## Business logic

### One list per turn

#### Context

See `## Context`.

#### Business logic

The events are read in order. Every prompt ends the turn before it and starts the next: the user's own prompt, a message that continued the agent, and a prompt the tool sent (an answer picked for a question, a subagent's end) alike.

- The files changed before a prompt, since the prompt before it, are kept under that prompt, when there is at least one. Edits before the first prompt belong to the turn the first prompt ends.
- The files changed since the last prompt are the last turn's, kept apart: an empty list when there are none.
- A turn in which no edit [4] changed a file has no list, so nothing is kept under the prompt that ended it.

### Each file once, its edits summed

#### Context

**Problem**: the coding agent often edits one file several times in a turn. A row per edit would list the same file again and again.

#### Business logic

Within a turn, a file is known by its path as said from the agent's checkout. Each output that says files it changed adds, for each of them, its lines added and its lines removed to that file of the turn. The files are in the order each was first changed in the turn. So "+2 −1" then "+3 −2" on one file is that file once, "+5 −3". Each turn starts from nothing: a file changed in two turns is in both lists, each with that turn's lines alone.

### A file the turn made

#### Context

**Problem**: a new file written with three lines, then edited to add two lines and remove one, sums to "+5 −1". But the file was not there before the turn: the turn removed nothing of it, and it ends with four lines.

#### Business logic

A file is one the turn made when at least one of the turn's edits says it made the file. Such a file's lines added are the sum of the lines added less the sum of the lines removed, zero when that is below zero, and its lines removed are zero: "+3 −0" then "+2 −1" reads "+4 −0". A file that was there before the turn keeps its sums as they are. A file made in an earlier turn was there before a later turn, which sums its edits as they are.

### A path said from the agent's checkout

#### Context

See the problem in `## Context`.

#### Business logic

The caller gives the folder of the agent's checkout when it knows it. A path that starts with that folder followed by a slash is said without them (`/repo/.branches/agent-1/docs/A.md` reads `docs/A.md`); a slash at the end of the folder's own name changes nothing. Any other path is left whole: a file outside the checkout, a file in a folder whose name only starts with the checkout's, and every path while the folder is not known. The file's name is the last part of its path.
