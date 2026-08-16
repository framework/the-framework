The daemon's one background clock: a single interval that runs a list of jobs, each saying how many ticks it wants between turns.

## TLDR

- Every sweep used to own a timer — six of them, each with its own interval, unref call and overlap guard — so there was no single place to look when "nothing is happening" turned out to be a sweep that was not running.
- A job's cadence is a small integer rather than a duration: the base interval is the finest cadence anything needs, and everything slower is that many ticks. The ratios are exact by construction, where separate timers drift.
- A missed turn is skipped, never queued: a slow job comes back to the next turn, not to a backlog of them.
- A job that throws costs its own turn and nothing else, and says so with its name — a sweep failing silently is indistinguishable from one that was never scheduled.
- The first tick fires at start-up rather than an interval later, because the case most of these jobs exist for is a machine that was off while something happened; a job that only makes sense once the daemon has been up says so.
- Awaiting a tick means the tick finished — overlapping ones join it rather than being dropped — which is what makes the schedule testable without waiting on wall-clock time.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
