Builds the cross-project interventions queue (#632, part of Queue #624): the always-on "needs you" list — open PRs, runs parked on a choice gate, and finished runs with unpushed work — plus its Discord formatting.

## TLDR

- `buildInterventions(projects)` yields three `kind`s per project, newest first: `pr` (open PRs via `ghPrList`), `awaiting` (a live `running` run with an unresolved `pendingChoice`, #636), and `unpushed` (a finished run whose branch holds real unpushed, unmerged commits, #860).
- Rom's design (#624): proposals and finished work are both just PRs, so the bulk of "needs a human" is the open-PR set — merge to confirm, close to reject; this rolls those up the way overview.ts rolls up running runs.
- `interventionLine`/`postInterventionsDiscord` render items for the Discord webhook; #627 notifications ride the whole set via the shared `SeenTracker`.
- Re-exports `interventionKey`/`pickNewInterventions` from `keys.ts`.

## Problems

- #860's gap: a run that committed real code and stopped produced neither an open PR nor a parked gate, so nothing surfaced it — the overview filters on `running` and the handoff panel hides behind clicking into the run. `unpushed` closes that gap, surfacing only (it says a decision waits; it never takes it).
- The same repo registered under two projects (monorepo root + subdir) would list each PR twice; items are deduped by `interventionKey` after sorting, keeping the newest.

## Decisions

- Hand-opened draft PRs are excluded (a draft is not asking for review) — but a draft on a session branch (`isSessionBranch(headRefName)`, #1102) is kept, because auto-handoff opens drafts precisely to avoid pinging reviewers, and dropping those too would re-open the #860 hole.
- The default `unpushed` handoff reader skips the per-branch `gh` PR lookup entirely: an open PR implies the branch was pushed (already excluded by `pushed`), and paying an 8s-timeout network call per run per poll to learn that would be the most expensive part of the queue.
- Only the most recent `HANDOFF_LIMIT` (5) finished runs per project are inspected: each costs several git reads, this runs on a poll, and work unpushed for dozens of runs is not news.
- `awaiting` items key on gate id + run id since a project can have several concurrent runs (#736).
- An `unpushed`/`awaiting` item's `url` is the dashboard's own URL, known only to the daemon (`deps.dashboardUrl`), empty otherwise.

## Flows

- build: per project — `ghPrList()` → filter drafts (session-branch exception) → `readLiveMetas()` → parked-gate items → `listRuns()` → last-5 finished → `runBranchFor()` → `readRunHandoff(pr: none)` → skip if !exists/empty/merged/pushed/!hasRemote → sort by createdAt → dedupe by key.
