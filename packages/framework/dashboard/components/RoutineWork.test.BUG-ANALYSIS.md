# Bug analysis: packages/framework/dashboard/components/RoutineWork.test.tsx

## Business logic (high-level)

A 30-test suite covering everything the test SPEC lists: rows off `AUTO_PM_ROUTINES`, the three
Run now paths (plain start with navigate/adopt-fallback/failure handling; drain-only sweep with
no project id and no navigation; plan and per-lock sweeps scoped to the picked project), the cost
tooltips (own sentence, settings line incl. "CLI's own default" and other-driver model exclusion,
three count forms, singular at one), Configure-first (stash + navigate, no start, busy-immune,
fan-out wording), the picked-project preference (#1647 read-back, write, missing-project
fallback, honoured by starts), the two checkbox tiers (#1209 opt-out semantics preserving
siblings, Run now ignoring ticks, empty-schedule warning), Trigger-now (#1210/#1433 reporting in
all forms), and the concurrency box (#1204 default shown, no max, floor at one, empty writes
nothing, consequence sentence).

Seams: rpc stubs (`onProjects`, `sendAutoPmSweep`), lib stubs (`usePreferences`/
`updatePreferences`, `useAutoPm`, `useStartAgent`) — each at the module boundary the component
imports, with mutable `prefs`/`autoPm`/`busy`/`startError` fixtures reset in `beforeEach`.
`draft-handoff` is real, so the Configure-first test asserts the actual stash round-trip
(`takePendingDraft()` returns the prompt — and, being a take, also leaves the stash clean for
later tests). The real `AUTO_PM_ROUTINES` catalog drives the fixtures, so the tests track the
daemon's own list rather than a copy (e.g. the locked-routine test derives the set from
`job.lock !== undefined` and asserts there is at least one — it fails loudly if the catalog
changes shape).

Verification quality — spot-checked the riskier assertions:

- `runNowOf` maps a routine to its button via `AUTO_PM_ROUTINES.indexOf`, the same array the
  component maps over — index-safe.
- The verbatim-prompt test clicks index 1 with `ROTATION_JOB = AUTO_PM_ROUTINES[1]` and asserts
  prompt/kind/options and the `(projectId, prompt, agentId)` navigation triple.
- Failure test waits for "Starting…" to clear (pins the `finally`-like reset) and for the alert.
- The mocked `updatePreferences` never mutates `prefs`, so read-back tests set `prefs` up front —
  correct for a controlled fixture; the concurrency test consequently fires each change against
  the same rendered value, which still exercises the handler per change event.
- All async paths are awaited (`waitFor`/`findBy*`/`hoverTooltip`); no assertion runs before its
  state can exist, and none can pass vacuously (every getBy throws on absence).

Coverage gaps (noted, not test bugs) — matching the two bugs filed against RoutineWork.tsx: no
double-click test on a sweep-backed Run now (the missing in-flight guard), and the empty-input
test asserts only that nothing is written, not that the box can visually stay cleared (the
controlled snap-back). Also unpinned: `describeOutcomes`'s "considered no projects" and
"The sweep ran." fallbacks (minor).

## Functions (low-level)

### Helpers (`renderCard`, `project`, `routineName`, `routineBox`, `runNowOf`, `openRunMenu`)

`routineBox` scopes the checkbox query through the row's own label so the master checkbox can
never be picked up — deliberate and correct. `openRunMenu` clicks the chevron by its
aria-label and awaits the menu item. Correct.

### The suite

Each test matches a test-SPEC sentence; no test asserts something the component does not do, and
the assertions are concrete (exact call payloads like `{ only: 'plan', projectId: 'p1' }`,
`{ autoPmOptOut: [other] }`, exact status-line texts). Verdict: correct.

## Bugs found

None found.
