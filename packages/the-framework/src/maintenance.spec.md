The maintenance sweep (#298): background job that walks registered repos, finds commits grown since the last maintenance review, and runs the maintainability loop on them, tracking per-repo state in `.the-framework/maintenance.json`.

## TLDR

- `MaintenanceState`: `reviewedSha`/`reviewedAt` (how far the commit-delta sweep #298 has read) and `sweptAt` (paces the weekly whole-codebase sweep #882) — deliberately separate keys so neither feature resets the other's schedule.
- `assessRepo` classifies one repo: `baseline` (never reviewed — record HEAD, never review pre-existing history), `skip` (unchanged), `review` (new commits in `reviewedSha..HEAD`), `error` (not a repo / no git).
- `maintainSweep` orchestrates pre-assessed reviews via injected `SweepDeps` (run/record/log/now/maxRepos), returning a `SweepSummary` tally.
- `maintenanceDue` decides the automatic codebase-wide sweep (#882): due when never swept or swept longer ago than the interval.
- State IO (`read`/`write`/`mergeMaintenanceState`) goes through a minimal `MaintenanceFs` seam for disk-free tests.

## Problems

- Two writers, one file: `writeMaintenanceState` replaces the file wholesale and two features write it — `mergeMaintenanceState` (load-bearing since #882) patches only the mentioned keys so the commit-delta sweep and the automatic sweep cannot silently reset each other's schedule.
- Rewritten history: a `reviewedSha` git no longer knows (rebased away) makes `rev-list` fail — falls back to `review` with a note, re-reviewing to be safe.

## Decisions

- `DEFAULT_MAINTENANCE_INTERVAL_MS` is a week and deliberately not configurable: per #879 a setting must earn itself; the sweep only queues backlog entries on an idle machine under quota, so over-eagerness costs a backlog entry, not a bill.
- A never-swept repo is due immediately — the case #882 exists for, closing the gap left by #298's baselining (which never reviews a first-seen repo's pre-existing history).
- An unparseable `sweptAt` timestamp counts as due: a hand-edited-into-nonsense state file gets swept instead of falling out of the schedule forever.
- The reviewed SHA is recorded only when the run succeeds, so a failure is retried next sweep; baselines record without running.
- `maxRepos` caps reviews per sweep (baselines/skips don't count); the remainder is reported as `pending`.
- Capacity gating is the existing `--max-cost` budget; quota-based gating is explicitly deferred to #519.

## Flows

- plan: `planMaintenanceSweep(repos)` → `assessRepo(path)` per repo (git rev-parse HEAD → read state → rev-list count) → tagged `RepoReview[]`
- sweep: `maintainSweep(reviews, deps)` → per review: skip/error tally, baseline → `deps.record(HEAD)`, review → `deps.run()` → on success `deps.record(HEAD)` else failed (retried next sweep)
