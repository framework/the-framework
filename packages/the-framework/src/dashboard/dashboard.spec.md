Builds the Overview dashboard page payload (#471): the `buildOverview` rollup promoted to a full landing page, adding per-project run/TODO stats, terminal-status counts, and a 14-day activity chart.

## TLDR

- `buildDashboard(projects, deps)` returns `DashboardData`: totals (projects/active runs/open TODOs/archived runs), `runsByStatus`, `activity` (finished runs per local calendar day), `active` + `recent` (from `buildOverview`), `projects` (per-project `ProjectStat` rows, most-recently-active first), and `queue`.
- `ProjectStat` carries activation, running flag, archived-run count, open TODOs, and ticket presence (`hasTickets`, #958 — presence only, not a count).
- Still a pure projection of the same on-disk files (run.json + runs/ + LOGS.md + TODO); all readers injectable, everything forgiving of read failures.

## Decisions

- The queue is computed once and injected into `buildOverview` so the backlog is read a single time per build.
- Activity buckets are seeded with all 14 days at zero (oldest-first) so a quiet stretch shows empty bars instead of a collapsed axis; bucketing keys on the *local* date the user saw the run start.
