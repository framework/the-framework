The daemon's one background clock: a single interval that fires every 30 seconds, on which every sweep [1] takes its turns. Each sweep declares its cadence as a whole number of ticks [2] instead of owning a timer of its own, so every cadence is an exact multiple of one clock and there is one place to look when a sweep is not running.

## Context

**Business logic story**: every background job of the daemon (Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption, the data sync) is wired as one job on this clock in `daemon-services.ts`. The clock decides when each job's turn comes, what happens when a turn is slow or fails, and how the daemon's shutdown waits for the turn in flight.

**Problem**: one timer per sweep means timers that drift apart, turns that overlap, and failures nobody sees. A sweep failing silently is indistinguishable from one that was never scheduled at all.

## Glossary

[1] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] tick: One beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **A cadence is a count of ticks** - a job takes a turn when at least its cadence of ticks has passed since its own last turn; `1` is every tick, `20` is every twentieth, and anything below one counts as one.
- **The first tick fires at start-up** - the clock runs a tick the moment it starts, and every job takes that turn unless it opted out, in which case its first turn comes one cadence later.
- **A slow turn holds the tick; missed turns are skipped, never queued** - jobs run in order, one at a time; a tick that comes round while a turn is in flight counts as elapsed time but starts nothing, and a job that missed several ticks takes one turn next time, not one per missed tick.
- **A failing job costs only its own turn** - a job that throws is logged by name, the other jobs of the same tick still run, and the failed turn still counts as taken.
- **A tick asked for by hand joins the one in flight** - the shutdown and on-demand callers can run a tick now; one asked for mid-turn waits for that turn instead of starting another, so awaiting it means the tick finished.
- **Stopping waits out the turn in flight** - after a stop nothing runs again, and the stop resolves only once the job in flight has finished; the clock never keeps the process alive on its own.

## Business logic

### A cadence is a count of ticks

#### Context

See `## Context`.

#### Business logic

Each job says how many ticks [2] it wants between its turns; the default is one, and a value below one is raised to one. On every tick the clock walks the jobs in the order they were declared and gives a job a turn when the number of ticks since that job's own last turn has reached its cadence. The count is of ticks since the job's last turn, not of the clock's position: when the clock jumps over the tick a job would have landed on, the job is due at the very next tick instead of waiting a whole further cadence. A job's turn is claimed before it runs, so a turn that fails still counts as taken.

### The first tick fires at start-up

#### Context

**Problem**: the case most sweeps [1] exist for is a machine that was off, or a daemon that was down, while something happened: a push that could not land, a setting switched on, a pull request that went green. Waiting one full interval before looking would leave that case unattended for as long as the slowest cadence.

#### Business logic

The clock runs its first tick [2] immediately when it starts, not one interval later. Every job takes that start-up turn by default. A job that only makes sense once the daemon has been up a while says so and sits the start-up tick out; its first turn then comes one full cadence after the start.

### A slow turn holds the tick; missed turns are skipped, never queued

#### Context

**Problem**: a job can block for minutes, for example a data sync failing slowly against an unreachable remote. Measured in turns that ran rather than in time that passed, every other job's cadence would be stretched by that job's duration, so a ten-minute pass could come round every twenty-six. Measured naively the other way, a job that missed ten ticks would then run ten times in a row.

#### Business logic

The jobs of one tick [2] run one after the other, each awaited, so no two jobs and no two turns of the same job ever overlap. While a turn is in flight the interval keeps firing; each firing that lands on a busy clock is counted as time that passed and folded into the next tick, so a slow job cannot stretch any other job's cadence. A job whose turns were missed takes one turn at the next tick, never a backlog of the missed ones.

### A failing job costs only its own turn

#### Context

See `## Context`.

#### Business logic

When a job throws, the failure is logged once as "<job name> failed this tick: <error>", the remaining jobs of that tick [2] still run, and the job's next turn comes at its normal cadence.

### A tick asked for by hand joins the one in flight

#### Context

**Business logic story**: the daemon's shutdown and the dashboard's on-demand sweep [1] need to run a tick now and know when it is done.

#### Business logic

Besides the interval, a tick [2] can be asked for directly. A tick asked for while the clock is idle runs at once and counts as one tick; one asked for while a tick is running joins that tick without counting, and awaiting it means the running tick has finished. Only the interval's firings count as elapsed time beyond that.

### Stopping waits out the turn in flight

#### Context

**Problem**: the sweeps [1] commit and push; a shutdown that only stopped the next turn would tear the repository down under a sweep mid-commit.

#### Business logic

Stopping the clock clears the interval and refuses every further tick [2]. The turn already in flight stops at the next job boundary, but the job it is inside runs to its end, and the stop resolves only then. The interval never keeps the daemon process alive by itself: background work is never the reason the process stays up.
