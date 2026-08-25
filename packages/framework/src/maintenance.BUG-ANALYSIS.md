# Bug analysis: packages/framework/src/maintenance.ts

## Business logic (high-level)

Two features share this module and its state file (`.the-framework/maintenance.json`):

1. **The commit-delta sweep (#298)** — assess registered repos (`assessRepo`/`planMaintenanceSweep`), run the maintenance loop on repos with new commits (`maintainSweep`), recording `reviewedSha`/`reviewedAt` only on success so failures retry.
2. **The calendar-paced codebase-wide pass (#882)** — `maintenanceDue`/`sweptAt` with a fixed one-week interval, wired into Auto PM via `daemon-services.ts:220-221`.

Checked against `maintenance.SPEC.md`, the logic implements every clause: baseline-not-back-review for first-seen repos; skip when unchanged; review counts from `rev-list --count reviewedSha..HEAD`; non-repo → reported error that never stops the sweep; rewritten history → re-review with a note; success-only recording; `maxRepos` cap with `pending` tally where baselines/skips don't consume the cap; the two schedules kept in separate keys with `mergeMaintenanceState` preventing mutual resets; never-swept → due immediately; unparseable `sweptAt` → due; interval not configurable.

**Wiring finding**: only feature 2 is reachable in production. `readMaintenanceState`/`maintenanceDue`/`mergeMaintenanceState` are used by `daemon-services.ts`; but `assessRepo`, `planMaintenanceSweep`, `maintainSweep`, `writeMaintenanceState`, `short`, and the `RepoReview`/`SweepDeps`/`SweepSummary`/`MaintenanceAction` types have **no production caller** — `cli.ts:57-62` imports `planMaintenanceSweep`, `maintainSweep`, `mergeMaintenanceState`, `short`, `RepoReview` and never uses any of them (verified by exhaustive grep of `cli.ts`; the test file's comment "the path `framework maintain` takes" points at a since-removed CLI verb — MEMORY.md's "CLI options are minimal, no verbs" decision). So the #298 sweep the module header and `maintenance.SPEC.md` describe as "a background job that walks the registered repos" does not run anywhere; `reviewedSha` is never written outside tests. Per AGENTS.md (prefer clean code; a removed thing leaves nothing behind), this is leftover machinery plus dead imports.

Other edge analysis:

- `maintenanceDue` with a *future* `sweptAt` → not due until the future date + interval; only reachable by hand-editing; the SPEC only demands the unparseable case count as due. Noted, not reported.
- `mergeMaintenanceState` is read-modify-write, not atomic — two concurrent writers could drop one patch. Both writers (#298 delta sweep, #882 pass) run on the daemon's single background clock, sequentially, and #298 is currently unwired; reliance noted.
- `readMaintenanceState` filters to the three known string keys, so junk shapes (arrays, numbers) degrade to `{}` — matches "malformed reads as never reviewed".
- `assessRepo`: `rev-list` returning unparseable output maps to 0 → `skip` (unreachable: git prints a number or errors); HEAD moved *behind* `reviewedSha` (reset/checkout older) → count 0 → `skip`, reasonable; diverged branch → positive count → review. First git failure returns `error` without touching state. All fine.
- `planMaintenanceSweep` assesses all repos in parallel (`Promise.all`) — one git process per repo, bounded by registry size; no rejection can escape (`assessRepo` never throws).

## Functions (low-level)

- **`MAINTENANCE_FILE` / `maintenanceStatePath`** — path under `FRAMEWORK_DIR` (same `.the-framework` as everywhere; verified `store/agent-store.ts:24`). Correct.
- **`MaintenanceState`** — three optional fields, `sweptAt` deliberately separate. Correct.
- **`DEFAULT_MAINTENANCE_INTERVAL_MS`** — 7 days; matches SPEC + test. Correct.
- **`maintenanceDue(state, now, intervalMs)`** — absent → true; NaN parse → true; `now - last >= intervalMs` (inclusive boundary, so a weekly schedule doesn't drift — tested). Correct.
- **`nodeMaintenanceFs`** — destructures the shared adapter; methods are closure-bound (arrow-function properties, no `this`), so the destructuring is safe. Correct.
- **`readMaintenanceState` / `writeMaintenanceState` / `mergeMaintenanceState`** — forgiving read, wholesale write (mkdir first), spread-merge. Correct (concurrency reliance noted above).
- **`assessRepo`** — walked above. Correct.
- **`planMaintenanceSweep`** — parallel map, id tagged when present. Correct.
- **`maintainSweep`** — orchestration per SPEC. One deviation found: the `maxRepos` cap compares against `summary.reviewed`, which increments only on *successful* reviews (L237/L245). A sweep where agents fail keeps launching agents past the cap — with `maxRepos: 2` and ten repos of failing agents, all ten run. The cap exists to bound one sweep's spending, and a failed agent run still spends (it can fail *because* it hit its own budget cap), so attempts, not successes, are what the cap should count. Currently unreachable (function unwired), but pinned by tests and one wiring away from shipping. Verdict: suspicious — bug 3.
- **`short(sha)`** — 7-char slice, `'(unknown)'` for undefined. Correct.

## Bugs found

1. `packages/framework/src/cli.ts` L57-L62 (noticed here): `planMaintenanceSweep`, `maintainSweep`, `mergeMaintenanceState`, `short`, and `type RepoReview` are imported from `./maintenance.js` and never used anywhere in `cli.ts` — dead imports left behind by the removed `framework maintain` verb. Contradicts AGENTS.md's clean-code rule and MEMORY.md's "a renamed or deleted thing leaves nothing behind". Severity: minor. Fix: delete the import block (lines 56-62).
2. `L152`-`L253`: the whole #298 commit-delta sweep (`assessRepo`, `planMaintenanceSweep`, `maintainSweep`, `writeMaintenanceState`, `short`, associated types) has no production caller — `reviewedSha` is never written by any live path — while `maintenance.SPEC.md` and the module header still describe it as a running background job. Either the wiring was lost with the CLI verb (feature silently not running: spec mismatch) or the code should be removed with its SPEC trimmed. Severity: minor. Confidence: medium. Fix sketch: remove the unwired half plus its SPEC sections and tests, or re-wire it where the daemon's sweeps run.
3. `L237`: `maintainSweep`'s `maxRepos` cap counts successful reviews (`summary.reviewed >= limit`), not attempts, so failing agent runs are unbounded: with `maxRepos: n`, every assessed repo gets an agent launched as long as agents keep failing, defeating the cap's spend-bounding purpose (a run can fail after real spend, e.g. its own budget cap). Severity: minor. Confidence: medium (logic verified; currently unreachable because of bug 2). Fix sketch: count attempts — check `attempted >= limit` where `attempted` increments before `deps.agent()`.
