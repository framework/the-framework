# Bug analysis: packages/framework/src/dashboard/projects.ts

## Business logic (high-level)

The multi-project read side (#392): registry records → `ProjectSummary` for the sidebar, and id → path resolution for every per-project RPC. Also declares `ProjectionRead<T>` — the items+`whole` pair the notification watcher's per-project baseline rides on (#1623).

Invariants per SPEC:
- summary fields: name = path basename; `activated` = marker present; `lastActivityAt` = newest agent timestamp; `fileConfig` = committed `the-framework.yml`, re-read on every summarize (freshness after edits) and omitted when empty;
- every read is forgiving — a failing activation check, agent read, or yml read degrades (inactive / no activity / no config) rather than throwing, so the sidebar always renders;
- `whole` semantics: a project contributes items only when readable; `whole` is what distinguishes "nothing there" from "could not look" — only baseline-keeping callers read it.

Lifecycle/concurrency: `summarizeProject` runs the agent read and config read concurrently (`Promise.all`) after the activation check — no shared state, no ordering hazard. `defaultProjectsProvider` re-reads the registry per call (fresh, no cache): `list()` maps records through `summarizeProject`, which cannot reject (all inner awaits are `.catch`'d, `basename` is total), so the un-caught `Promise.all` is safe; `resolvePath` linear-scans and returns undefined for unknown ids, which the RPC layer treats as "unknown project".

## Functions (low-level)

- **`summarizeProject(record, deps)`** — activity derivation: `agents.map(r => r.updatedAt || r.startedAt)` (falls back to start time when a run never updated), `.filter(Boolean)` then a second type-guard filter (redundant but harmless), `.sort().at(-1)` — lexicographic max is chronological for the store's uniform ISO-Z timestamps. Empty agent list → key omitted entirely (tested via `'lastActivityAt' in summary`). `fileConfig` attached only when `Object.keys(...).length` — a malformed yml is already `{}` from `loadFrameworkConfig`, and a *read* failure is caught here. Edge cases: a path ending in `/` would give basename of the trimmed segment (Node `basename('/a/b/')` → `'b'`) — fine; registry paths are absolute and normalized at registration. Verdict: correct.
- **`defaultProjectsProvider()`** — `list()` catches a registry read failure to `[]` (empty sidebar rather than a crash); `resolvePath(id)` same, returns undefined. Two sequential callers each re-read the registry — no staleness. Verdict: correct.
- **`ProjectSummary` / `ProjectionRead` / `SummarizeDeps` / `ProjectsProvider`** — types only; `errors` documented as attached elsewhere (daemon error state), not populated here. Correct.

## Bugs found

None found.
