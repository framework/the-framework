Auto PM spends leftover subscription quota on the product's own roadmap: while the account is under its weekly boundary and nobody is at the keyboard, the daemon works the agent queue down and, once it is empty, refills it — importing, triaging, then planning tickets.

## TLDR

- One pure policy question per project — enabled, under the concurrency cap, past the cooldown, queue readable, quota under the boundary; the sweep loop only supplies the readings.
- A standing queue is drained before new work is invented; a calendar-paced codebase maintenance sweep outranks the rotation when due, and only ever while the queue is genuinely empty.
- Draining and planning fan out, one pinned queue entry or locked ticket per agent, so concurrent agents do disjoint work; every other routine stays one per tick since concurrent copies would undo each other.
- Both phases claim their ticket with a pushed lock file before the agent starts, so agents on other machines cannot double-book it: planning locks the ticket it will plan, and draining locks the ticket its queue entry links back to — an entry claimed elsewhere is dropped from the batch, and an entry with no ticket behind it keeps the queue itself as the coordination point.
- Each routine can be switched off individually, and every stand-down is reported with its reason: a wedged sweep must not look like a healthy idle one.
- Switching the draining routine off means "do not *work* the queue", not "do nothing": the tick falls through to the rotation, which puts entries *on* the queue rather than taking them off. Standing down instead made every inventing routine unreachable for as long as the queue held anything — and the queue is auto-populated, so that was most of the time. The one exception is a click that asked for the queue by name: a drain-only sweep says why it cannot, rather than borrowing the click.

## Rationales

- An unreadable quota fails closed — the opposite of the per-agent guard: quietly burning quota on work nobody asked for is worse than skipping a tick.
- "Run now" skips only the master switch: the click is the consent the preference exists to record; every other stand-down holds.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
