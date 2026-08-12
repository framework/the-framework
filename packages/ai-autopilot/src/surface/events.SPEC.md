Turns an autopilot run's progress events into something watchable: a replayable stream any number of watchers can join, plus the terminal rendering that prints each event as one readable line.

## TLDR

- The stream remembers every event, so a watcher can join mid-run and still see the whole history, replay from any point, or follow along live until the run ends.
- A watcher that leaves early (say, a closed browser connection) is cleanly forgotten rather than lingering.
- The stream carries any event type, so bootstrap and future engines reuse the same transport with their own events.
- The terminal surface is just a sink that prints each event the moment it happens.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
