# Bug analysis: packages/framework/src/maintenance.test.ts

## Business logic (high-level)

Covers both features of `maintenance.ts` end to end off-disk: assessment outcomes (baseline / skip / review / error / rewritten-history), state IO forgiveness and round-trip, registry-id tagging, sweep orchestration (success-only recording, retry semantics, `maxRepos` with pending), and the #882 pacing (`maintenanceDue` boundary conditions, week constant, corrupted timestamp, schedule-separation via `mergeMaintenanceState` in both directions, first-write-with-no-file).

Verification of test honesty:

- `memFs` read rejects on missing key like ENOENT — matches the seam contract; `mkdir` no-op is fine (nothing lists dirs).
- `fakeGit` distinguishes `rev-parse` and `rev-list`, throws on unknown repos and *unexpected args* — the latter makes the fake fail loudly if `assessRepo` ever issued a different git call, a nice drift tripwire.
- The orchestration test pins the exact `ran` order, the exact `recorded` list (baseline records HEAD; success records HEAD; failure records nothing — the retry semantics), and the full five-field summary via `deepEqual`. Falsifiable and complete for the happy/failed mix.
- The `maxRepos` test uses all-succeeding agents, so it passes with the implementation's count-successes cap. It would *also* pass if the cap counted attempts — meaning it does not pin down which of the two the cap counts, and the failing-agents-bypass-the-cap flaw (see `maintenance.BUG-ANALYSIS.md` bug 3) is invisible to this suite. Recorded as a coverage gap tied to a real suspected bug, not as a test bug (the test's own claim, "honors maxRepos, leaving the rest pending", is true for what it tests).
- `maintenanceDue` boundary: one day after → false; one second before the week ends → false; *exactly* the interval → true (pins the non-drifting `>=`). Deterministic epoch arithmetic, no clock use.
- The schedule-separation test exercises both write directions and asserts full state each time — this is the test that makes a wholesale-write regression impossible to miss.
- Line 92 reaches `maintenanceStatePath` via a dynamic import (it is not in the static import list) — awkward but correct, and keeps the path computation the module's own rather than duplicating the join.
- All async tests await everything; no floating promises; no test can pass vacuously.

Note: the comment at L199 ("the path `framework maintain` takes") names a CLI verb that no longer exists — evidence for the unwired-#298 finding in the source file's analysis; as a comment it is stale documentation, not a test defect.

## Functions (low-level)

- **`memFs()`** — minimal seam fake. Correct.
- **`fakeGit(repos)`** — scripted runner with loud-failure default. Correct.
- **`recordingDeps(outcome)`** — records agent runs and recorded states; fixed `now()` keeps assertions deterministic. Correct.
- **Twelve test bodies** — each maps to a SPEC clause; assertions are exact (`deepEqual` on shapes and orders) or anchored matches. Correct, with the `maxRepos` sensitivity gap noted above.

## Bugs found

None found. (Coverage gap: no test drives `maintainSweep` with `maxRepos` plus *failing* agents, which is exactly where the cap's count-successes flaw hides.)
