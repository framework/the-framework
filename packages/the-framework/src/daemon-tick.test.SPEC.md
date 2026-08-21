Covers the daemon's clock: a job running every Nth tick with missed turns skipped rather than queued, opting out of the start-up tick, a throwing job costing only its own turn and being named in the log, jobs running one at a time in order, overlapping ticks joining the one in flight, a tick that came round mid-turn still counting towards every cadence, a stopped clock doing nothing further, and stopping resolving only once the turn already in flight has finished.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
