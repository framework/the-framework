The feed of one agent's [1] events [2] on the agent view: the list of events (`EventList.tsx`), or a centered placeholder while there is nothing to show, with a warning banner above either while the live event stream is lost. The bar above the feed already carries the agent's name, status and session link, so the feed carries only the events themselves.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.

## Business logic — TL;DR

- **The lost-stream banner** - whenever the live event stream is down, a warning reads "Live stream lost — reconnecting. The session keeps running; this view may be behind.", so a dead connection never looks like an agent that went quiet.
- **The empty feed** - with no events, the feed shows the caller's label, or "Waiting for the session to start…" by default: a running agent is waiting for its first event, and a finished one says it has nothing to replay.
- **Following and where it opens** - by default the list follows new output as it arrives; a finished agent's feed is told not to follow and to open at its end, where the outcome and the final spend are.
- **Gates stay answerable** - the feed always knows its project and agent, so a gate's [3] row is rendered as the interaction (an inline panel, or the answered card) and never downgraded to plain text, which would leave an agent parked with nothing to answer it.
- **The tail** - content the caller hands in is rendered after the last row inside the scroller, which is where a web agent's cloud mirror box rides.
