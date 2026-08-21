The daemon's one background clock: a single interval that runs a list of jobs, each saying how many ticks it wants between turns.

## Flows

- A job's cadence is a small integer rather than a duration: the base interval is the finest cadence anything needs, and everything slower is that many ticks.
- A tick is counted whenever the clock comes round, whether or not a turn could start: a job that runs long costs its own next turn and nothing else, and every other job's cadence keeps to the wall clock.
- A missed turn is skipped, never queued: a slow job comes back to the next turn, not to a backlog of them.
- A job that throws costs its own turn and nothing else, and says so with its name.
- The first tick fires at start-up rather than an interval later; a job that only makes sense once the daemon has been up says so.
- Awaiting a tick means the tick finished — overlapping ones join it rather than being dropped.
- Stopping is likewise awaitable, and resolves only once the turn in flight has finished: clearing the interval stops the next turn, never the one already inside a job.

## Rationales

- One clock rather than a timer per sweep: a single schedule gives one place to look when "nothing is happening" turns out to be a sweep that was not running.
- Tick counts rather than durations keep the ratios exact by construction, where separate timers drift.
- A tick that no turn could take is still counted, because counting only the turns that ran let a single slow job stretch every cadence in the daemon by its own duration: while one project's data sync was failing slowly against a remote it could not reach, the ten-minute cloud-work pass came round every twenty-six minutes, and every other sweep with it.
- A throwing job is named because a sweep failing silently is indistinguishable from one that was never scheduled.
- The start-up tick exists because the case most of these jobs exist for is a machine that was off while something happened.
- A tick you can await to completion is what makes the schedule testable without waiting on wall-clock time.
- Stopping waits out the turn in flight because these jobs commit and push: a shutdown that did not wait would tear the repo down underneath a sweep.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
