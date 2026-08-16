Auto PM spends leftover subscription quota on the product's own roadmap: while the account is under its weekly boundary and nobody is at the keyboard, the daemon works the agent queue down and, once it is empty, refills it — importing, triaging, then planning tickets.

## TLDR

- One pure policy question per project — enabled, under the concurrency cap, past the cooldown, queue readable, quota under the boundary; the sweep loop only supplies the readings.
- A standing queue is drained before new work is invented; a calendar-paced codebase maintenance sweep outranks the rotation when due.
- Draining and planning fan out, one pinned queue entry or locked ticket per agent, so concurrent agents do disjoint work; every other routine stays one per tick since concurrent copies would undo each other.
- Each routine can be switched off individually, and every stand-down is reported with its reason: a wedged sweep must not look like a healthy idle one.

## Rationales

- An unreadable quota fails closed — the opposite of the per-agent guard: quietly burning quota on work nobody asked for is worse than skipping a tick.
- "Run now" skips only the master switch: the click is the consent the preference exists to record; every other stand-down holds.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
