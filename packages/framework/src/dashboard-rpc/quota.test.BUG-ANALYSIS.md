# Bug analysis: packages/framework/src/dashboard-rpc/quota.test.ts

## Business logic (high-level)

Four cases, all over `sendAutoPmSweep` — nothing here tests `onQuota` or `onAutoPm`, which is
consistent with `quota.test.SPEC.md` (it claims only the "Run now" behaviours). What the suite pins,
matching that SPEC line for line:

1. The RPC **awaits** the sweep rather than firing and forgetting, and answers with the outcome
   lines the loop's report holds afterwards (#1433).
2. The reporter is **captured before** the await, so a context that changes mid-flight cannot cost
   the click its outcomes.
3. A sweep that throws is `{ok:false}`; a sweep that ran but whose report cannot be read is still
   `{ok:true}` (without outcomes).
4. The narrowing (`only`, `projectId`, and the `{lock}` variant) reaches the loop **exactly as
   given**, including the `undefined` case.

All four use `provideTestContext` fakes, are synchronous-ish (one microtask), and assert with
`assert.deepEqual` on the whole result object, so an extra or missing field fails. No timers, no
filesystem, no ordering assumptions beyond the awaits — deterministic.

**Case 2 deserves a second look, because "models a loss that no longer happens" is the shape of a
test that cannot fail.** It does fail for the right reason: the fake sweep calls
`provideTestContext({autoPm: ...})` — i.e. it *replaces the whole module-level context* — with a
reporter that answers `undefined`, mid-await. The RPC under test uses the reporter it captured
before the await, so the outcomes survive; a refactor that moved the `contextAutoPm()` read after
the `await sweep(opts)` would read the replaced context and answer `{ok:true}` with no outcomes,
failing the assertion. So the case has real power over exactly the regression it names.

**Case 4's `undefined` entry is the sharp one.** `sendAutoPmSweep()` with no argument must call
`sweep(undefined)`, not `sweep({})`: the loop distinguishes "no narrowing" from "an empty
narrowing object" in its own defaulting. `assert.deepEqual` with `strict` treats a trailing
`undefined` element as a real element, so the assertion pins it.

**What is not covered**, and arguably should be given the SPEC's wording: that the sweep runs *with
the auto-PM preference off* ("Run now sweeps even with unattended work switched off"). That rule
lives entirely in the daemon's `wakeAutoPm({onDemand: true})` wiring, which no test in this file can
see — the fake `autoPmSweep` never receives the `onDemand` flag, because the RPC does not add it.
A missing test is not a bug per this review's ground rules; recorded as a coverage note.

## Functions (low-level)

### `OUTCOME`
A single `AutoPmOutcome` fixture (`started: false` with a stand-down message) reused by three cases,
compared by value. Correct.

### Case 1 — awaits the sweep, then answers with the outcomes
The `resolved` flag flipped after an `await Promise.resolve()` inside the fake sweep is what proves
the RPC awaited: a fire-and-forget implementation would return before the microtask ran and
`assert.equal(resolved, true)` would fail. The second assertion pins the outcome lines. Both halves
can fail. Correct.

### Case 2 — the reporter is captured before the await
Analysed above: real power over the post-await-read regression. One subtlety worth noting: the
mid-flight `provideTestContext({autoPm: () => undefined})` also resets *every other* capability to
`test-context.ts`'s defaults — including a fresh `defaultQuotaSource()`, i.e. a second real `claude`
spawn inside this one test. That is the `test-context.ts` defect (bug 1), not a flaw in the case's
logic. Correct.

### Case 3 — a throwing sweep vs an unreadable report
Two contexts in one case. First half: `autoPmSweep` throws → `{ok:false}` exactly. Second half:
`autoPmSweep` is a **synchronous** `() => {}` (so `await sweep(opts)` awaits `undefined` — the same
shape the daemon's `services?.wakeAutoPm(...)` produces when the services are not up yet) and
`autoPm` throws → `{ok:true}`. Both assertions are exact `deepEqual`s. Correct.

### Case 4 — the narrowing travels untouched
Pushes the received `opts` into `seen` and compares all four calls at once. Because the fake pushes
the object *by reference*, a mutation of `opts` inside the RPC would show up here too — the
assertion is stronger than it looks. Correct.

## Bugs found

1. **L20/L39/L42/L50/L59/L70 (fix belongs in `packages/framework/src/dashboard-rpc/test-context.ts`
   L25): every `provideTestContext()` call — six in this file, one of them inside a fake sweep —
   spawns a real `claude -p /usage` child process.** `provideTestContext`'s default context builds
   `defaultQuotaSource()` (`dashboard/quota.ts` L103–114), which constructs a `QuotaPoller` and
   calls `start()`, and `start()` polls immediately (`quota-poller.ts` L108–113) → `readQuota()` →
   `spawn('claude', ['-p','/usage','--output-format','json'])` with a deliberately non-unref'd 20 s
   timeout (`driver/claude-code-quota.ts` L128–131). No test calls `quota.stop()`, and none of these
   cases touches the quota at all. Running this one file therefore fires six real usage reads at the
   developer's rate-limited account — whose own documentation warns the refusal window is "minutes
   long", so the suite actively degrades the daemon's live quota panel — and leaves up to six
   non-unref'd timers holding the test process's event loop. Severity: minor (test-suite side
   effect). Confidence: high. Fix: default `quota` in `provideTestContext` to an inert stub
   (`read: async () => ({windows: [], unavailable: 'fetch-failed'})`, `boundaryFor: async () =>
   undefined`, `stop: () => {}`) instead of `defaultQuotaSource()`.
