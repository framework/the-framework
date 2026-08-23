What the tests cover: the daemon's shared background clock.

A job takes a turn every Nth tick and its missed turns are skipped rather than queued up. Every job takes a turn on the start-up tick unless it opts out, in which case it waits a full cadence for its first turn. A job that fails costs only its own turn — the rest of the tick still runs — and its name and reason appear in the log. Jobs run in order, one at a time, so a slow job holds up its tick instead of overlapping the next one. Asking for a turn while one is already in flight joins that turn rather than starting a second, so waiting on a turn always means the turn finished.

A stopped clock runs nothing further, and stopping waits out the turn already in flight rather than only preventing the next one.

An interval firing that lands while a turn is in flight still counts towards every job's cadence, so one slow job cannot stretch every other job's schedule by its own duration; when the clock catches up, each job takes exactly one further turn rather than one per firing it missed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
