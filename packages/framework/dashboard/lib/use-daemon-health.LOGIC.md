Says whether the daemon is answering, so the dashboard can tell the user when it has stopped rather than quietly freezing.

## Context

**Problem**: a daemon that is gone is otherwise invisible. The live event stream retries silently, and every polled panel keeps the last value it had rather than blanking, so the whole page simply stops changing — which looks exactly like an agent [1] that has gone quiet. One cheap read on a fixed cadence turns "unreachable" into something the page can say out loud.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **A cheap read every 5 seconds** - the list of projects is asked for every 5 seconds, whether the daemon is healthy or not, and the answer is only used as evidence that the daemon is there.
- **Healthy until proven otherwise** - the page starts out assuming the daemon answers, so no alarm is shown before the first probe lands.
- **The daemon unreachable** - a probe that fails marks the daemon as not answering, and the dashboard shows "The daemon is not answering — retrying. Everything on this page is frozen until it returns."
- **The daemon coming back** - the next probe that succeeds clears the alarm, and nothing else has to be done: the live event stream reconnects and the polled panels resume on their own.
