Covers auto PM's decision policy (quota and queue both failing closed when unreadable, cooldowns, concurrency caps), the drain-before-refill cycle, rotation order and per-routine opt-outs (an unticked drain routine falling through to the rotation, while a drain-only click still stands down), the calendar-paced maintenance sweep, fan-out with pinned entries and locked tickets, drains claiming their entry's ticket before starting (ticketless entries exempt, a lost claim dropping the entry rather than the batch), durable claims surviving restarts and hand-offs, a claim released when its agent settles with nothing to hand off and only then (the freed work not respawned, refused-spawn claims freed too, failed releases retried under a bound), on-demand and drain-only ticks, and the report the dashboard shows.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
