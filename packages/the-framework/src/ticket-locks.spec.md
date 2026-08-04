Ticket locks: a `tickets/<STEM>.lock.md` sibling claiming a ticket for one agent, written and pushed by the daemon before fanning work out.

## Decisions

- **The daemon writes and pushes locks, never the agent**: an agent pushes only at the end of its session onto its own branch, and a lock protects nothing unless it is on the default branch *before* work starts (cloud sessions cannot push at all).
- **No timed release**: a coordinating agent can legitimately hold a ticket for days, and auto-releasing under a live agent re-opens exactly the double-work window the lock closes. Watching for dead agents is the human's job; releasing is their escape hatch.
- The lock file is part of the published *ticketing format*, so stock prompts skip a locked ticket with no cooperation needed from anyone who has never heard of this module.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
