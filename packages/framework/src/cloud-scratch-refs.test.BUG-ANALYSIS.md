# Bug analysis: packages/framework/src/cloud-scratch-refs.test.ts

## Business logic (high-level)

Pins the sweep's whole contract off disk/network via injected seams (`fakeGit`, `memFs`, canned
`prs`, fixed `now`): the tight `cloud-*` shape; deletion of an aged, landed run branch (current
and legacy spelling); the young/busy/holds-work/open-PR keeps (with the "no PR lookup spent on a
holds-work ref" economy pinned via a counting stub); first-sight recording for `cloud-*` refs and
deletion once watched past the safe age (record removed with it); pruning of records for refs
someone else deleted; the #1601 anchor rule both ways (empty tip on landed parent deletes,
tree-changing tip keeps); non-candidates never listed at all; the no-remote path returning the
empty result without touching the state file; a refused deletion reported with its first-seen
entry kept (retry does not restart the day); the symref-named non-main default branch; and the
service semantics (per-project iteration, logs only for deletions/failures, stopped service ticks
as a no-op).

Every test asserts against both the returned result and the observable side effects (the fake
git's recorded deletions, the in-memory state file), so none can pass vacuously. The fixed `NOW`
plus injected `now`/`ageMs`-free boundary values make the age assertions exact: `NOW -
SCRATCH_REF_SAFE_AGE_MS` is pinned as *deletable* (the `>=` side) and `NOW - DAY/2` as kept —
matching the implementation's `< ageMs` keep-condition boundary.

Fidelity of the fakes checked against the real commands:

- `fakeGit` renders `ls-remote --symref` output exactly as git does (symref line, bare `HEAD`
  line — which the parser must ignore, and does — then `sha\trefs/heads/<branch>` lines).
- The `rev-parse` stub distinguishes `sha^{tree}`, `sha^`, and `sha^^{tree}` by `endsWith` after
  a shape regex; the suffix checks are ordered so `^{tree}` cannot shadow `^^{tree}`. Correct.
- `fetch` always fails ("the canned origin serves no objects"), which forces the anchor tests to
  run off locally-present commit objects — matching the real conservative path.
- `merge-base --is-ancestor` succeeds/fails off the `landed` set, 'all' default. Correct.

Coverage gaps (none hiding a wrong behavior): the fetch-succeeds-and-object-arrives branch of
`emptyTipOnLandedParent` is never exercised (the stub fetch always throws); a malformed
state-file read falling back to empty is untested; the state-write failure path
(`writeState(...).catch`) is untested; overlapping-tick joining (`inflight`) is untested. All are
conservative paths whose failure direction is "keep the ref / delay deletion".

## Functions (low-level)

- **Constants** (`NOW`, `DAY`, `SHA`, `MAIN_SHA`, `OLD_RUN`/`OLD_RUN_ID` at 26h, `YOUNG_RUN` at
  1h, `LEGACY_OLD_RUN`, `CLOUD_REF`) — ages computed against the fixed clock; the run-branch ids
  parse through the real `startedAtFromAgentId` shapes. Correct.
- **`fakeGit(opts)`** — described above; also records deletions in order and supports
  `refuseDeletes`/`noRemote`. The unexpected-command throw makes any new git call in the
  implementation fail the suite loudly rather than silently succeed. Correct.
- **`memFs()` / `seenState()`** — minimal `ScratchFs`; `seenState` writes the exact
  `cloudRefsStatePath('/repo')` key the sweep reads. Correct.
- **`pr(state)` / `noPrs`** — `LinkedPr` literals; only the `state` field matters to the gate.
  Correct.
- **Each test** — one fact per test, both result and side effects asserted; the
  "every other branch" test uses `assert.deepEqual(result, {deleted:[],kept:[],failed:[]})`,
  which also pins that unparseable run-ids are *silently* kept (not listed). Correct.
- **Service tests** — a stubbed per-project sweep records order `['/one','/two']`, exactly two
  log lines (deletion + failure, kept quiet), and the stop test proves a post-stop tick runs no
  sweep. Correct.

## Bugs found

None found.
