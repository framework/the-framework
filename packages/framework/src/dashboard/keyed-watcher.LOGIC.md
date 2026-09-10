The engine behind both notification feeds, the interventions [1] feed and the activity feed: a poll over the registered projects that remembers what it has already seen and hands out only what is new, so a Discord message fires once per item even when no dashboard is open. The two feeds differ only in what they read and how an item is identified, so those are parameters; the poll itself, the per-project baseline and the failure rules are written once here. Timing belongs to the daemon's clock, not to this engine.

## Context

**User story**: the user configures a Discord webhook and is told when something new needs them or when an agent [2] starts or finishes; what already existed when the daemon started is never announced, and a repository the daemon cannot reach neither floods Discord later with everything it already held nor silences the other projects.

**Problem**: the reads underneath a poll forgive their own failures, so a poll made while GitHub is unreachable succeeds with an empty list. Taken as a baseline, that empty list would make the next good poll announce every pre-existing item as new; taken as "seen", it would hide nothing, since it saw nothing. The engine therefore separates two facts: which items a poll saw, and which projects it read completely.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[4] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **Only what is new, per project** - an item is announced when its identity has not been seen before and its project has earned a baseline; every item seen is remembered either way.
- **A project's first whole read seeds, never announces** - a project earns its baseline the first time a poll reads it completely, and the items found in that read are what already existed, not news.
- **A failed poll earns nothing** - a poll whose project scan or projection fails announces nothing and seeds no baseline.
- **Driven by the daemon's clock, one poll at a time** - the engine owns no clock of its own; the daemon's clock asks for each poll, a poll requested while one is running is skipped, and a stopped watcher does nothing.

## Business logic

### Only what is new, per project

#### Context

See `## Context`.

#### Business logic

Each poll reads the current items of every registered project along with the list of projects read whole, the ones whose share of the items is all of it rather than all that could be reached. An item is new, and handed to the caller, only when two things hold: its identity (the caller's rule, for instance a pull request's URL) has never been seen by this watcher, and the project it belongs to already had a baseline before this poll. Every item the poll saw is then remembered as seen, whether or not it was announced and whether or not its project has a baseline: a partial read can only under-report, never invent, so anything it did see is something the user must not later hear about as new. The baseline is held per project, not once for the whole poll: a poll that reached three projects out of four knows what already existed on those three and nothing about the fourth, and announcing is a per-project decision anyway. Held globally, one project that can never be read (a registered repository with no remote is an ordinary case) would either silence every project's notifications or hand the whole set a baseline it had not earned.

### A project's first whole read seeds, never announces

#### Context

**Problem**: what is already open when the daemon starts is not news, and neither is what a project already held when it becomes reachable later.

#### Business logic

Only a project that a poll read whole earns a baseline, and it earns it after that poll's items have been judged: the items found in a project's first whole read are folded in as seen and none of them is announced. From the next poll on, the project's new items are announced. A project that a poll could not read whole stays without a baseline until a later poll reads it whole, and anything found for it in the meantime is remembered but never announced. So a readable project keeps announcing while another cannot be read, and the unreadable project's pre-existing items stay quiet when it comes back.

### A failed poll earns nothing

#### Context

**Problem**: a first poll that could not reach GitHub must not make the next good one announce everything pre-existing as new.

#### Business logic

When the scan of the registered projects or the projection over them fails, the poll yields no new items and no project earns a baseline: the baseline must come from a real read. The same holds for a poll that succeeds but reads no project whole, which is what a start-up without GitHub reach looks like from here.

### Driven by the daemon's clock, one poll at a time

#### Context

**Business logic story**: every sweep [3] declares its cadence in ticks [4] of the daemon's single background clock, in one place; the notification sweeps are no exception.

#### Business logic

The watcher owns no clock of its own: the daemon's clock asks it to poll, and the daemon and the tests can drive a poll on demand. A poll requested while one is still running is skipped, so slow reads never pile up. The caller is handed a poll's new items only when there is at least one; empty polls are silent. Once the watcher is stopped, polls do nothing, and a poll already in flight when the stop happens announces nothing.
