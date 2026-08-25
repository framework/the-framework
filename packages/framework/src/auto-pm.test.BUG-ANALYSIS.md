# Bug analysis: packages/framework/src/auto-pm.test.ts

## Business logic (high-level)

The policy/loop suite for auto-pm.ts. It covers: `autoPmDecision` (preference, cap with named
runs, cooldown, on-demand, unreadable queue), `quotaHeadroom` (unreadable, under/at boundary,
offset wording to one decimal), the catalog invariants (rotation order, no `<AWAIT>` in prompts,
labels/prompts rendered, drain-only `drains`/`autoMerge`, plan-only `fansOut`, triage locks named
after their jobs, no branch-abort text), and the `startAutoPm` loop: idle start, off-preference,
on-demand semantics, cooldown re-arm on refusal, promotion (landed queue ends the tick, settled
runs asked once, in-flight held), drain-vs-refill cycle, rotation advance/retry, maintenance
precedence/stamping/opt-out/fall-through, stop semantics (#983), opt-outs (filtered rotation,
unreadable → none), fan-out (batch size, distinct pins, in-flight pins, top-up, short-batch
naming), drain claims (#1420: batch lock call, per-agent CLAIMED ids, ticketless entries skipped,
lost race drops the entry, all-lost stands down, no-seam unchanged), dead-claim release (#1583:
release on `no-commits`, mid-epilogue hold + bound, dry entries not re-offered, never-started
claims released, bounded release retry, other endings untouched), plan fan-out (#1327), plan-only
and lock-named clicks (#1204/#1643), and the report (#1161).

The harness is a fully injected `AutoPmDeps` with a fixed clock (`T0`) and concurrency pinned at
1 so pre-#1204 tests keep their meaning; quota fixtures go through the real
`quotaBoundaryStatus`, so the wording assertions test the real formatting chain.

Do the tests verify what they claim? I walked the trickier ones against the loop's code:

- "mid-epilogue hold is bounded": tick sequencing gives exactly 3 promotes of `run-1` (2 held
  sweeps + the settle-unread), which the assertion counts precisely; later ticks' rotation agents
  do not pollute the count because it filters by id. Sound.
- "a release that could not land is retried next sweep, bounded": attempts land at exactly 2
  (fail, then success); the 4th tick proves no further asks. Sound.
- "every other ending leaves the lock alone": the `promoted:true` case exercises the
  landed-continue path and the `already-open` case the settle path — both end with `released`
  empty for the intended reason (no `no-commits`). Sound.
- The lock tests (`fakeLock`) assert order (`lock → start`, stand-down naming the holder,
  release on settle, re-take in the same sweep), which pins the "before the start"/"when the run
  ends" contract, not just call counts. Sound.
- The fan-out tests assert per-prompt pins and CLAIMED ids against the very assignments the lock
  call received, so an id drift between lock file and prompt would fail. Sound.

Coverage gaps (matter because both correspond to real bugs found in the source, see
auto-pm.BUG-ANALYSIS.md):

1. No test combines a **named click (`only:'plan'` / `only:{lock}`) with a due maintenance
   sweep** — the case where `recordMaintenance` is wrongly stamped today. The existing "stamped
   only when the run actually started" test would have caught it if it had used a named click.
2. No test drains a **ticketless entry that settles `no-commits`** — the dry-set tests all use
   ticket-linked entries with claims, so the respawn-forever gap for plain TODO entries is
   unpinned.

Neither gap is a defect in an existing test — they are missing cases — so nothing is reported
below for them; the source-side bugs are reported in auto-pm.BUG-ANALYSIS.md.

## Functions (low-level)

- **`T0` / `status(weekPercent)`** — a real reading placed at a fixed instant; throws loudly if
  the fixture week is unplaceable. Correct.
- **`IDLE`** — the all-clear inputs; each test then perturbs one condition, keeping causes
  isolated. Correct.
- **`harness(overrides)`** — one idle project; `started`/`ran`/`logs` accumulators; default
  `promote` settles-without-promoting so ticks are independent; `now` frozen at T0 (so cooldown
  tests must pass `cooldownMs: 0` or rely on `sinceLastStartMs` never elapsing — they do,
  consistently: with the frozen clock the "does not start a second run" test holds via
  `since = 0 < cooldown`). Correct.
- **`presetKey(name)`** — reverse lookup, throws on a miss so a renamed preset fails the suite
  rather than skipping the assertion. Correct.
- **`fakeLock(order)`** — held-flag semantics with an order journal; `isHeld()` lets a test
  assert the lock survived a failed release. Correct.
- **Individual tests** — each asserts on observable outputs (started ids, ran job names, report
  messages, prompts, lock/release journals); none can pass vacuously: every `assert.match` has a
  companion that proves the path executed (counts or deepEqual on arrays). The `deepEqual(asked,
  [...new Set(asked)])` idiom in the settled-once test is a real double-ask guard. Verdict:
  correct throughout.

One stylistic nit (not a bug): the loop body at L1148 (`for (let i = 0; i < 5; i++) await
loop.tick()`) over-ticks past the bound on purpose; the id filter keeps it sound.

## Bugs found

None found.
