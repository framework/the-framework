The daemon's single background clock: one interval fires every thirty seconds, and each background job declares how many ticks it wants between its turns instead of owning a timer of its own.

## Business logic — TL;DR

- **One clock, cadences as whole numbers** - a job's schedule is "every N ticks", so the ratios between jobs are exact by construction and there is one place to look when a sweep is not running.
- **A tick is time passing, not a turn that ran** - an interval that fires while a job is busy still counts towards every job's cadence.
- **A missed turn is skipped, never queued** - a slow job never accumulates a backlog of turns to work through.
- **Most jobs take a turn at start-up** - the case most of them exist for is a machine that was off while something happened.
- **A job that fails costs only its own turn** - the other jobs in the same tick still run, and the failure is named in the log.
- **Stopping waits out the turn in flight** - because these jobs commit and push, stopping the clock is not the same as having let go of the repo.

## Business logic

### One clock, cadences as whole numbers

#### User story

The user asks why nothing is happening in the background. There must be a single place that answers it.

#### Business logic

One interval fires on the finest cadence anything needs — every thirty seconds. Every job states how many ticks it wants between turns: one means every tick, twenty means every twentieth. Slower cadences are therefore exact multiples of the base rather than separate timers drifting apart from each other.

The clock never keeps the daemon alive by itself: background work is never the reason the process stays up.

### A tick is time passing, not a turn that ran

#### User story

One background job — a data sync failing slowly against an unreachable remote — takes minutes. Every other job's schedule must not stretch by that job's duration.

#### Business logic

Each interval firing advances the clock, whether or not a turn could start on it. A firing that lands while a turn is still in flight is counted and folded into the next turn, so cadences are measured in time that passed rather than in turns that happened to run.

A turn asked for directly — by the shutdown sequence, or by a caller driving the clock — does not advance it, because neither of those is elapsed time. A caller that arrives while a turn is in flight joins that turn rather than starting a second one, so waiting on a turn always means the turn finished.

### A missed turn is skipped, never queued

#### User story

The daemon was busy through several of a job's scheduled turns. It must resume that job's normal rhythm, not run it repeatedly to catch up.

#### Business logic

A job is due when enough ticks have passed since its own last turn, and its turn is claimed before it runs — so a job that throws has still had its turn, and turns that could not happen are dropped rather than accumulated. Because dueness is measured from a job's own last turn rather than from a fixed pattern, a job the clock jumped over is due at the very next turn instead of waiting a whole further cadence.

Each job's turn is waited for before the next job starts, so a long job holds up its tick rather than overlapping with the following one.

### Most jobs take a turn at start-up

#### User story

The machine was off, or the daemon was down, while something happened that a sweep exists to handle.

#### Business logic

The first tick fires immediately at start-up rather than one interval later, and by default every job takes a turn on it. A job that only makes sense once the daemon has been up for a while opts out, and then waits a full cadence for its first turn.

### A job that fails costs only its own turn

#### User story

One sweep breaks. The rest of the background work must keep running, and the broken one must be identifiable.

#### Business logic

A job that fails is logged once, by name, and the remaining jobs in the same tick still take their turns. Naming it matters because a sweep that fails silently is indistinguishable from one that was never scheduled.

### Stopping waits out the turn in flight

#### User story

The user presses Ctrl-C while a sweep is mid-commit.

#### Business logic

Stopping the clock prevents further turns and then waits for the turn already in flight to finish. The turn stops at the next job boundary, but the job it is currently inside runs to the end rather than being abandoned mid-commit. Waiting on the stop is how the shutdown knows the background jobs have actually let go of the repo.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
