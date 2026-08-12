A small public server that lets people on different machines watch one run live: a publisher posts the run's events to it, and anyone with the run's link gets the dashboard in read-only watch mode.

## TLDR

- The first slice toward shared team sessions: the same dashboard, but the events come from the relay's own in-memory stream instead of a local file, and only watching is possible — no projects, no starting or stopping, and the relay never runs an agent.
- Deliberately unauthenticated (anyone with the URL can watch), so everything is bounded: the number of runs is capped with least-recently-watched eviction, request bodies are capped by size, and malformed requests get an answer instead of crashing the server.
- The publisher side forwards a live run's events in order and best-effort: a failed, rejected, or unresponsive delivery is reported but never interrupts the run or hangs its shutdown.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
