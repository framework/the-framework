What the tests cover, driving the clock by hand:

- **Cadence** - a job with a cadence of three takes ticks 0 and 3 while a job with the default cadence takes every tick; a job that opts out of the start-up tick first runs one tick later, while every other job takes the start-up tick.
- **Failure isolation** - a job that throws is named in the log ("CI watch failed this tick: gh is down") and the jobs after it in the same tick still run.
- **One turn at a time** - jobs run in declaration order, a slow job holding the tick until it finishes; ticks asked for while one is running join it instead of overlapping, and awaiting them means the tick finished.
- **Stopping** - a stopped clock runs nothing further; a stop resolves only once the turn already in flight has finished.
- **Firings that land mid-turn count** - interval firings that arrive while a slow job holds the tick count towards every cadence, so a rare job is due as soon as the turn ends instead of a full cadence later, and each job then takes exactly one further turn instead of one per missed firing.
