The daemon's per-project error state: when a background job finds a project in a state only the user can fix, it records the error here, and clears it the moment the state is good again — the dashboard shows whatever is recorded.

## User Stories

- The user sees a project whose data cannot reach origin flagged in the dashboard, with the failing command's own words and how long it has been that way.
- The user fixes the cause and the flag clears itself on the next sync that converges.

## Flows

- One slot per project and kind of error, holding the detail and when it was first seen; a repeat report of the same kind refreshes the detail but keeps the first-seen time, so the dashboard can say how long the project has been in that state.
- The first emitter is the data-branch sync: a push that origin rejects, or a repository with no remote at all, is recorded every minute it persists and cleared on the first sync that converges.
- Held in memory only: every emitter re-evaluates on its own cadence, so a restarted daemon re-learns each error within a tick, and no stale record can outlive the condition that raised it.

## Rationales

- Errors surface in the dashboard rather than as console lines on the daemon's stdout, which nobody reads — swallowing an error is the worst way to handle it.
- This holds only what a background job finds while nothing is running; what an agent hits during a run is reported by the agent itself and lives in that run's log. The split is what each thing is: a condition that is true now and clears itself, against something that happened and cannot un-happen.
- A repository with no remote is not a supported mode but an error, since every other machine and cloud session converges through that remote.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
