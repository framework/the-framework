The feed of one agent's [1] events [2] on the agent view: the list of events (`EventList.tsx`), or a centered placeholder while there is nothing to show, with a warning banner above either while the live event stream is lost. The bar above the feed already carries the agent's name, status and session link, so the feed carries only the events themselves.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.

## Business logic — TL;DR

- **The lost-stream banner** - whenever the live event stream is down, a warning reads "Live stream lost — reconnecting. The session keeps running; this view may be behind.", so a dead connection never looks like an agent that went quiet.
- **The empty feed** - with no events, the feed shows the caller's label, or "Waiting for the session to start…" by default: a running agent is waiting for its first event, and a finished one says it has nothing to replay.
- **Following and where it opens** - by default the list follows new output as it arrives; a finished agent's feed is told not to follow and to open at its end, where the outcome is.
- **Gates are never plain text by accident** - the feed always hands the list its project, so a gate's [3] row is what the list draws for it where it was asked (an open gate is one "Asking" line that takes no answer, the agent view asking it above the message box, `QuestionPanel.tsx`; a gate with a recorded pick is the answered card); no caller can show an open gate as plain text by leaving the project out.
- **The message just sent** - handed in by the agent view and passed to the list as its last prompt; with it, an empty feed shows the list rather than the placeholder.
- **The working spinner** - handed in by the agent view and passed to the list.
- **The message being written** - handed in by the agent view while the agent runs and passed to the list, which shows it after the last row.
- **What waits** - the messages a working agent has not read yet, and the count of subagents an ended agent waits for, are handed in by the agent view and passed to the list, which draws them as its last rows; with none of either, nothing is passed. A message that waits is a row, so a feed with no event yet shows it and not the words for an empty feed.
- **The tail** - content the caller hands in is rendered after the last row inside the scroller, which is where a web agent's cloud mirror box rides.
- **The subagents** - the agent's subagents (the agents started for it, when it split its task across them), what each working one is doing now, and how a click on one opens its page are handed in by the agent view and passed to the list, which gives each subagent its rows.
- **A changed file's change** - the way to show the change of a file a turn's edits changed is handed in by the agent view, when there is one, and passed to the list, which makes each changed file's row at the end of a turn a button with it.
