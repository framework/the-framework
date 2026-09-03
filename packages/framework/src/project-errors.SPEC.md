Holds the daemon's per-project error state: when a background job finds a project stuck in a condition only the user can fix, it records the condition here so the dashboard can show it, and clears it the moment the condition is gone.

## Business logic — TL;DR

- **One slot per project and error kind** - each project holds at most one live error per kind; today the only kind is `data-sync`, raised when a project's branches — the `agent-data` branch and the `agents-logs` branch — cannot be synced (the push to origin is rejected, or the repo has no origin at all).
- **The age of a problem is preserved** - re-reporting the same error kind refreshes its detail message but keeps the timestamp it was first seen, so the dashboard can say how long the condition has lasted instead of restarting the clock on every re-check.
- **Errors live only as long as the daemon does** - nothing is written to disk; a restarted daemon starts clean and re-learns each error on the next check by the job that raised it.

## Business logic

### One slot per project and error kind

#### User story

A project's branches stop syncing — origin rejects the push, or the repo was never given an origin. The user cannot know this unless told, and the fix is theirs to make. The dashboard shows the project's current problems, worded from the error kind, with the failing command's own output as the detail.

#### Business logic

An error is recorded against a project under a kind. Recording the same kind again for the same project overwrites the detail message rather than accumulating a second entry, so a condition re-checked every minute produces one standing problem, not a growing list. Clearing an error that was never recorded does nothing. A project's errors are reported oldest first.

### The age of a problem is preserved

#### User story

The user wants to distinguish a blip from a condition that has been failing all afternoon.

#### Business logic

The timestamp on an error is the moment that error kind was first recorded for that project. Repeated reports of the same kind keep that original timestamp; only a clear resets it, so the next occurrence counts as a new problem.

### Errors live only as long as the daemon does

#### Rationale

Every job that records an error re-evaluates its own condition on its own schedule — the branch sync every minute. Keeping the record in memory guarantees no stale error outlives the condition that raised it across a daemon restart, at the cost of a short blind window after startup.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
