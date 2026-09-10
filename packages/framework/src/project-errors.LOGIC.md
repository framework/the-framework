Keeps, per project [1], the states a sweep [2] of the daemon finds that the user must fix and can only fix if told: one slot per project and kind of error, recorded by the sweep that finds it and cleared by the same sweep the moment the state is good again, so the dashboard can show a red dot on the project and a banner on its page. The only kind today is `data-sync`: the `agent-data` branch [3] cannot converge with the remote. The record lives in memory only: every sweep re-evaluates on its own cadence, so a restarted daemon re-learns each error within a tick [4] and no stale record outlives the condition that raised it.

## Context

**User story**: the user sees a red dot on a project in the project list, with the errors as its tooltip, and at the top of project home a banner reading "Not syncing with the remote · since <how long>" with the failing command's own words underneath. There is nothing to dismiss: fixing the remote makes the banner go away at the next sync.

**Problem**: a push the remote rejects, or a repository with no remote at all, reported as a line on the daemon's standard output and nowhere else is the worst way to handle a state nobody can see.

## Glossary

[1] project: A repository the user registered in the dashboard, identified by an id derived from its path.
[2] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[3] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[4] tick: One beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **One slot per project and kind** - recording an error keeps its kind, the failing command's message in the words the user would see running it by hand, and when it was first recorded; a repeat of the same kind refreshes the message and keeps the first time.
- **Cleared the moment it is good** - the sweep that found an error clears it as soon as the condition is gone; clearing what was never recorded does nothing; a report after a clear starts its own clock.
- **What the dashboard shows** - a project's errors, oldest first: a red dot in the project list, and on project home one banner per error.
- **The data-sync error** - set by the per-project data sync when the `agent-data` branch cannot converge with the remote, cleared unconditionally when a sync succeeds.

## Business logic

### One slot per project and kind

#### Context

**Problem**: the sync re-reports every minute, so a banner that reset its clock on every report would say "since 1 minute ago" forever and hide how long the project has actually been stranded.

#### Business logic

An error is recorded against a project's [1] path under its kind, with the message and the time of the first report. A second report of the same kind on the same project replaces the message and keeps the original time. Different projects never share a slot.

### Cleared the moment it is good

#### Context

See `## Context`.

#### Business logic

Clearing removes the slot for that project and kind; a project with no slots left drops out entirely. Clearing a kind that was never recorded does nothing. Cleared means gone for good: a later report of the same kind is recorded fresh, with its own first-seen time.

### What the dashboard shows

#### Context

See `## Context`.

#### Business logic

A project's errors are listed oldest first. The dashboard reads them from the project list (`daemon.ts` wires the reader) and renders them in two places: in the project list, the project's dot is red when it has errors, blue when it is activated without errors, and gray when not activated, with the errors as the tooltip, each as "<headline>: <message>"; on project home, one banner per error (`dashboard/components/ProjectErrorBanner.tsx`) with the headline for its kind, "since <age>" and the message. The banner has no state of its own and nothing to dismiss.

### The data-sync error

#### Context

**Business logic story**: once a minute, per project [1], the daemon converges the `agent-data` branch [3] with the remote for the `tickets` and `queue` skills (`daemon-services.ts`).

#### Business logic

When that sync fails, the `data-sync` error is recorded with the sync's own error text, and the same text goes to the daemon's log as "[framework] data sync: <error>". When the sync succeeds, the error is cleared unconditionally, so it lives exactly as long as the condition: the next tick [4] after the user fixes the remote, it is gone. Its headline in the dashboard is "Not syncing with the remote".
