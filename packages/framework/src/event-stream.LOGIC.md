Keeps an in-memory, replayable copy of an agent's [1] event stream [2] for readers on this machine that cannot tail the agent's own event file: events are appended as they arrive, any number of readers each get the whole history first and then the live events, and closing the stream lets every reader finish once it has read everything. Its one use is the relay [3]: the events of an agent running on a device [4] are streamed back into one of these, and the dashboard reads them exactly as it reads a local agent's.

## Context

**Business logic story**: the dashboard shows a relayed agent [1] like a local one, and a tab can open at any moment of the agent's life. The stream therefore has to serve a late reader the full history before the live tail, serve several tabs at once without one taking another's events, and release a tab that closed so a disconnected browser holds nothing until the agent ends.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **Every event is kept and replayable** - each appended event is kept in order for the stream's whole life; the history can be read from the start or from any offset, so a reader that already holds the first events asks only for the tail.
- **Each reader has its own cursor** - a reader replays every kept event, then waits for new ones as they arrive; readers are independent, so a late reader still sees the full history and no reader consumes another's events; a reader woken while a concurrent read on the same reader took the event waits again instead of finishing early.
- **Closing drains, then finishes** - once the stream is closed, every reader still receives what it has not read yet and then finishes; closing twice changes nothing; an event appended after the close is dropped.
- **A reader that leaves is released at once** - a reader that stops early (a browser tab that disconnected) is finished immediately, any read it had pending settles, and it holds nothing until the stream ends.
