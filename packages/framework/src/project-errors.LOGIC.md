Keeps, per project [1], the states a sweep [2] of the daemon finds that the user must fix and can only fix if told: one slot per project and kind of error, recorded by the sweep that finds it and cleared by the same sweep the moment the state is good again, so the dashboard can show a red dot on the project and a banner on its page. Beside the errors it keeps one note per project, "local only": the project's repository has no remote, which is nothing to fix. Two kinds of error: `data-sync`, the `agent-data` branch [3] cannot converge with the remote; `provider`, which package provides a kind of the project's data is unsettled, because two installed packages declare it and the project's `package.json` names none, or names one that does not declare it. The record lives in memory only: every sweep re-evaluates on its own cadence, so a restarted daemon re-learns each error within a tick [4] and no stale record outlives the condition that raised it.

## Context

**User story**: the user sees a red dot on a project in the project list, with the errors as its tooltip, and at the top of project home a banner reading "Not syncing with the remote · since <how long>" with the failing command's own words underneath. There is nothing to dismiss: fixing the remote makes the banner go away at the next sync.

**User story**: the user adds a new folder that was never pushed anywhere. Nothing is red: the project's entry in the project select reads "Local only, no remote" in grey, and everything works on this machine.

**Problem**: a push the remote rejects, reported as a line on the daemon's standard output and nowhere else, is the worst way to handle a state nobody can see. A repository with no remote at all is a different thing: a folder that was never shared is a normal project, and a red error on it tells the user to fix what is not broken.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs. Born as an orphan, written through one sync → commit → push cycle.
[4] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **One slot per project and kind** - recording an error keeps its kind, the failing command's message in the words the user would see running it by hand, and when it was first recorded; a repeat of the same kind refreshes the message and keeps the first time.
- **Cleared the moment it is good** - the sweep that found an error clears it as soon as the condition is gone; clearing what was never recorded does nothing; a report after a clear starts its own clock.
- **What the dashboard shows** - a project's errors, oldest first: a red dot in the project list, and on project home one banner per error.
- **The data-sync error** - set by the per-project data sync when the `agent-data` branch cannot converge with the remote, cleared unconditionally when a sync succeeds or finds no remote at all.
- **The local only note** - set by the same sync when the repository has no remote, unset the first sync after it has one; no error, no red dot, no banner.
- **The provider error** - set by the per-project provider check, on the data sync's clock, with one line per unsettled kind of data in the shared library's words; cleared when every kind is settled.

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

When that sync fails for any reason other than a repository with no remote, the `data-sync` error is recorded with the sync's own error text, and the same text goes to the daemon's log as "[framework] data sync: <error>". When the sync succeeds, or finds no remote, the error is cleared unconditionally, so it lives exactly as long as the condition: the next tick [4] after the user fixes the remote, it is gone. Its headline in the dashboard is "Not syncing with the remote".

### The local only note

#### Context

**Business logic story**: the same once-a-minute sync (`daemon-services.ts`) is what learns that a repository has no remote: the shared branch library marks that outcome. Only a remote named `origin` counts, as everywhere in that library.

#### Business logic

When the sync finds the project's [1] repository has no remote, the project is noted as local only, no error is recorded and nothing is logged as a failed sync. The note is unset by the first sync that finds a remote, whether that sync then converges or fails. The dashboard reads the note with the errors from the project list and shows it in one place: under the project's name in the project select, in grey, "Local only, no remote" (`dashboard/components/ProjectSelect.tsx`). The project's dot and page are those of a project with nothing wrong.

### The provider error

#### Context

**Business logic story**: a project installs both a GitHub package and a GitLab package, each declaring it provides the git host. Nothing in The Framework picks one by dependency order; the project must say.

#### Business logic

On the data sync's clock, for every kind of data The Framework reads through a provider, the daemon asks the shared library whether the provider is unsettled. When any kind is, the `provider` error is recorded with one line per such kind, as the library words it: "<n> packages provide <kind>: <names>; name one under \"framework\" in package.json", or "package.json names <name> for <kind>, which does not provide it; the providers are <names>". When every kind is settled the error is cleared. Its headline in the dashboard is "Unsettled: which package provides the data".
