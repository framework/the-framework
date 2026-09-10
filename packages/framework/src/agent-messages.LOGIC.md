The live chat [1] queue of a running agent [2]: the user's messages go in as they arrive on the control file [3], and the agent takes them out once its work has settled, either only what has already arrived (so the agent can end on an idle queue) or by parking for the next one. Closing the queue, which a stop [4] does, ends every parked wait and drops every later message.

## Context

**User story**: the user writes to a running agent from the composer [5]; the message lands in the agent's conversation once the agent's current turn settles, in the order it was typed; pressing Stop ends an agent that is parked waiting for a message.

**Business logic story**: the agent's process feeds the queue from the control file and closes it on Stop (`cli.ts`); the agent drains it once its work settles (`agent.ts`, `await-gate.ts`). A daemon-started agent takes what has queued and ends itself once the queue is idle; a stay-open agent parks. An agent with no interactive surface is given no queue at all, and its flow ends when the coding agent [6] stops asking.

## Glossary

[1] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[4] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[5] composer: the prompt editor on the project home, also used for live chat.
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Messages are delivered in arrival order, at once to a parked agent** - a message goes straight to an agent waiting for one; otherwise it queues, and queued messages come out first in, first out.
- **Waiting for a message, and what ends the wait** - a wait resolves with the next message, or with nothing once the queue is closed or the agent's stop signal fires, so a parked agent never hangs; a message already in hand wins over a stop signal that has already fired.
- **Taking only what has already arrived** - the end-of-work check never waits: it hands out a queued message or reports the queue idle at once, and reports idle once closed even when messages are still queued.
- **Closing the queue** - closing wakes every parked wait with nothing, and every message pushed afterwards is dropped.

## Business logic

### Messages are delivered in arrival order, at once to a parked agent

#### Context

See `## Context`.

#### Business logic

A message pushed while the agent is parked waiting is handed to that wait immediately; otherwise it is appended to the queue. Both the queue and the parked waits are served first in, first out, so two messages typed in a row reach the coding agent [6] in the order they were typed.

### Waiting for a message, and what ends the wait

#### Context

**Problem**: an agent parked for a message the user never sends must still end on Stop, and an agent stopped while a message is already queued must not lose that message.

#### Business logic

A wait returns a queued message at once when there is one, even when the agent's stop signal has already fired: a message in hand is not lost. With nothing queued, the wait returns nothing at once when the queue is closed or the stop [4] signal has already fired. Otherwise it parks until a message arrives, the queue is closed, or the stop signal fires; in the last two cases it returns nothing and the agent's loop ends cleanly.

### Taking only what has already arrived

#### Context

**Business logic story**: a daemon-started agent ends itself once its work is settled and nothing is queued; the dashboard reopens the conversation as a continuation when the user writes again. So the end-of-work check must never park.

#### Business logic

The end-of-work check hands out the oldest queued message, or reports the queue idle, without waiting. Once the queue is closed it always reports idle, queued messages or not: a closed queue is a stopped agent, and a stale message must never start a new turn [7] on it.

### Closing the queue

#### Context

**User story**: the user presses Stop on an agent that is parked waiting for a message; the agent ends instead of waiting on.

#### Business logic

Closing marks the queue closed and wakes every parked wait with nothing, oldest first. Any message pushed after the close is dropped.
