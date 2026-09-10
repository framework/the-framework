The shape shared by the daemon's background passes over the registered projects [1] — the sweep [2] that reclaims checkouts, the CI watch, the branch-links sweep, the cloud scratch sweep and cloud work adoption: no clock of their own, one walk over every registered project per tick [3] of the daemon's single clock, visiting each project's path in turn. What a pass does to one project is its own; the walking, the overlap rule and the stop are defined here once.

## Glossary

[1] project: A repository the user registered in the dashboard, identified by an id derived from its path.
[2] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[3] tick: One beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **One walk per tick** - each tick walks every registered project once, in the order the registry lists them, visiting one project at a time.
- **Overlapping ticks join the walk in flight** - a tick arriving while a walk is running waits for that walk instead of being dropped, so waiting for a tick always means a walk finished, for a caller that runs a pass on demand as much as for the clock.
- **Stopping** - a stopped pass ticks as a no-op, and a stop during a walk takes effect before the next project rather than in the middle of one.
- **A registry that cannot be read** - yields nothing to walk this turn; that is this turn's problem, not the daemon's, and the next tick tries again.
