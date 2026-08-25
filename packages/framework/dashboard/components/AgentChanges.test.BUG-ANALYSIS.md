# Bug analysis: packages/framework/dashboard/components/AgentChanges.test.tsx

## Business logic (high-level)

Pins the panel's five SPEC'd behaviors with `../rpc/reads.js` mocked (both `onAgentChanges` and
`onFileDiff`, the latter consumed by the un-mocked `FilePreviewCard` rendered on expansion — so
the expand test exercises the real child component against the mocked transport):

1. **Listing** — files named (dir split off, so the assertion is on `a.ts`/`new.ts`), status
   labels `modified`/`new` (pinning the untracked→"new" mapping), and the read addressed with
   `('p1', 'run-1')`.
2. **Totals reported upward while collapsed** — `onSummary` called with `(2, 13, 1)` (the sums
   across both files) while `open={false}` renders no rows (`queryByText('a.ts')` null): this is
   the test that proves polling and reporting are not gated by visibility, the panel's central
   contract. The follow-on render of `ChangesSummary` pins the "2 files" + "+13" wording.
3. **Empty means nothing rendered** — `container.textContent === ''` after the read resolved.
4. **Diff laziness** — `onFileDiff` not called after the list rendered (ordering is right: the
   negative assertion sits after an awaited positive one, so it cannot pass merely because
   rendering has not happened yet), then a click fetches exactly `('p1', 'src/a.ts', 'run-1')`
   and the patch line appears — also pinning that the preview passes the agent id through, the
   worktree-scoping half of #817.
5. **Empty reports zero** — `(0, 0, 0)` and no `aria-label="Changed files"` section.
6. **Failed read stays silent** — rejection swallowed, empty render.

Test hygiene: `beforeEach` clears and re-primes both mocks (so per-test overrides like
`mockResolvedValue([])` never leak), `afterEach(cleanup)`; every async transition awaited via
`waitFor`; `toHaveBeenCalledWith(2, 13, 1)` tolerates the initial `(0,0,0)` report from the
empty first render — deliberate looseness that keeps the test stable without weakening the
claim. The 8s poll interval never ticks within a test's lifetime and unmount clears it, so no
timer leakage. No test can pass vacuously: each asserts either rendered text, a call signature,
or an exact empty container.

Coverage gaps (noted only): the deleted-file strikethrough and binary (no DiffStat) renderings,
collapse-after-expand, and the summary re-report when counts change across polls are untested —
all low-risk presentation paths.

## Functions (low-level)

- **mock setup (L4-8)** — module mock before dynamic import; the factory exports both names any
  rendered child needs. Correct.
- **`CHANGES` fixture (L10-13)** — two files exercising both statuses and the sum arithmetic
  (13 added / 1 removed). Correct.
- **`beforeEach`/`afterEach` (L15-29)** — reset + re-prime; the diff fixture is a realistic
  `FileDiff` shape (patch/truncated/binary), so `FilePreviewCard` renders the real path.
  Correct.
- **tests 1-6** — analyzed above; assertions match their names and the test SPEC's sentence.
  Correct.

## Bugs found

None found.
