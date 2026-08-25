# Bug analysis: packages/framework/src/dashboard/dashboard.ts

## Business logic (high-level)

Builds the Overview page payload (#471): totals (project count, open queue entries), the working-now list (delegated to `buildOverview`), per-project ticket presence (#958, presence only — the onboarding checklist's need), and each project's queue. Pure projection over files the daemon/agents write; nothing mutates.

Design constraints honored:

- **The queue is read once** — `collectQueue` (or the injected reader) runs a single time and is handed to `buildOverview` as `queue: async () => queue`, so `overview.queueOpen` (the reduce over `q.open` — verified in overview.ts L332) and the returned `queue` come from one read per refresh. Matches the SPEC's "read once and reused".
- **Order is an output** — projects are sorted most-recently-active first (`lastActivityAt` descending via reversed `localeCompare`, missing timestamps as `''` so never-active projects sink to the end; ISO strings compare chronologically). The checklist takes `projects[0]`, so this ordering is contract, and the sort copies (`[...projects]`) rather than mutating the caller's array.
- **Forgiving** — the *default* ticket reader wraps `hasTickets` in `.catch(() => false)`, so an unreadable project reads as "no tickets" rather than failing the page. An *injected* `deps.tickets` is used raw; every real caller either injects a non-throwing test double or uses the default, so the page cannot fail from this in practice — reliance noted. `buildOverview` and `collectQueue` carry their own forgiveness.
- **The payload is pinned** (#1139) — exactly `totals/active/projects/queue`, nothing that would require the retired `listAgents` fan-out; the test locks the shape so a field creeping back is a decision.

Ordering/concurrency: ticket presence is awaited sequentially per project in a loop — order-preserving and boring; a slow project's ticket check delays the payload but every read here is a local file stat. No shared state, no races.

Edge cases: empty `projects` → totals `{projects: 0, openTodos: <whatever the injected queue reports>}`, empty lists throughout — safe. Duplicate project ids would produce duplicate rows, but registry ids are unique by construction.

## Functions (low-level)

- `buildDashboard(projects, deps)` — described above. Inputs: the registry's summaries plus optional readers (`OverviewDeps` extended with `tickets`). Output: `DashboardData`. Failure modes: only an injected thrower could reject; defaults never do. The `queueOpen` total counts *open* items across all projects, which is what "openTodos" promises. Verdict: correct.
- `ProjectStat` / `DashboardData` / `DashboardDeps` interfaces — shapes match what rpc-serve exposes and what the test pins; `hasTickets` is deliberately presence-not-count (SPEC rationale: nobody reads a count). Correct.

## Bugs found

None found.
