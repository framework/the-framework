Effort: 0
Uncertainty: 0

# [Plan] A boot that cannot reach GitHub arms a Discord flood: an empty first poll can't be told from a failed one

The bug is already fixed and merged: the "builders report failure" option the ticket names as the real fix shipped as the per-project `whole` baseline — this plan records where it landed, why it is complete, and recommends closing the ticket.

## TLDR

Nothing to implement. The seam the ticket identifies — an empty read and a failed read arriving at the watcher as the same `T[]` — was closed by threading a `whole: string[]` alongside the items from every builder up into the watcher's baseline. This is option 1 from the ticket's "What a fix has to decide" ("the honest fix … the information already exists at the `catch` that currently discards it"), not the milder `SeenTracker` shortcut. It is on the default branch via commits `a1952bf` (#1624) and `f7fc456` (#1627), with 34 passing tests. The ticket, its lock, and this plan should be removed.

## What actually shipped (versus the ticket's two options)

The ticket framed the fix as a choice:

- **Option 1 — the builders report failure.** Shipped. `ProjectionRead<T>` now carries `{ items, whole }` (`dashboard/projects.ts:49`). Each builder marks a project as `whole` only when *every* one of its sources answered:
  - `buildInterventions` (`dashboard/interventions.ts:86`) sets a per-project `sawEverything` flag, flipped false by an `unread()` sentinel wired into each `.catch(unread)` (PRs, live agents, unpushed work); the project id is pushed to `whole` only if `sawEverything` survives.
  - `buildActivity` (`dashboard/activity.ts:74`) uses `.catch(() => undefined)` to distinguish "read threw" (skip, not whole) from "read returned `[]`" (whole, nothing there).
  - `ghPrList` (`dashboard/gh.ts`) was made to report a `gh` that could not answer rather than returning an empty queue (tested at `dashboard/gh.test.ts:272`).
- **Option 2 — an empty first poll doesn't warm up.** Not needed and not taken; the ticket called it the fallback "if the first were too large".

The watcher consumes the richer read: `SeenTracker.observe(items, whole)` (`dashboard/keyed-watcher.ts:38`) keeps the baseline **per project** (`warmedUp: Set<string>` keyed by `scopeOf`), warming a project up only when it appears in `whole`, and — crucially — checking `warmedUp` *before* adding the current poll's projects to it. So a project's first whole read seeds its baseline silently and never announces the pre-existing backlog. Both watchers (the "needs you" queue and the New activity feed) share this engine, so both are covered. #1627 later gave the dashboard's browser notifications the same baseline discipline.

## Why this fully answers the ticket

Walking the ticket's exact failure — boot where the registry can't be read, `gh` isn't authenticated, or GitHub is unreachable:

- **Registry unreadable.** `listSummaries` returns `[]` (still `.catch(() => [])` at `daemon-services.ts:130`). `build([])` yields `{ items: [], whole: [] }`; `observe([], [])` warms up nothing. The next poll that reaches the registry reads the projects whole, but `observe` checks `warmedUp` before seeding, so that first good poll announces nothing and only sets the baseline. No flood.
- **`gh` unauthenticated / GitHub unreachable.** `ghPrList` now signals the failure; `buildInterventions` catches it as `unread`, drops the project from `whole`; the project earns no baseline until a poll actually reads its PRs. No flood.
- **One project permanently unreadable among many** (registered repo with no remote — an ordinary case). The per-project baseline means it never floods the others and never silences them (`keyed-watcher.test.ts:134`, `:165`).

The residual `.catch(() => [])` in `listSummaries` is now behaviorally inert: whether it returns `[]` or throws, the watcher earns no baseline that cycle (empty `whole`, or the watcher's own outer `catch`), and the outcomes are identical. It is worth neither a change nor a follow-up ticket.

## Verification

`node --test` over the three affected suites: **34 tests, 34 pass, 0 fail** (`dashboard/keyed-watcher.test.js`, `dashboard/interventions.test.js`, `dashboard/activity.test.js`). The #1623-tagged cases assert every branch above:

- `a first poll that read nothing whole is not a baseline: the backlog is not announced (#1623)`
- `one unreadable project neither floods nor silences the others (#1623)`
- `a project that is readable keeps announcing while another one cannot be read (#1623)`
- `buildInterventions` / `buildActivity` skip-vs-count-as-read pairs, and the `ghPrList` reporting cases.

## Recommendation

Close the ticket: delete `tickets/2026-08-21_empty-poll-vs-failed-poll-discord-flood.md`, its `.lock.md`, and this `.plan.md`, and note on GitHub issue #1623 that it was resolved by #1624 (daemon) and #1627 (dashboard). Closing is left as a separate step because this task was scoped to producing the plan; the deletion should ride the close, not this planning pass.
