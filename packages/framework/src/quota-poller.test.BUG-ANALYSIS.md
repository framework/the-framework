# Bug analysis: packages/framework/src/quota-poller.test.ts

## Business logic (high-level)

Covers every clause of `quota-poller.test.SPEC.md`, driving `poll()` directly (never `start()`), which keeps the suite deterministic — no real timers, no sleeps:

- **Blip never blanks** — good then fetch-failed: `latest` is the failure, `lastGood`/`lastGoodAt` stand (T0), `lastFailureAt` = T0+1000 via the manual `advance`, `isStopped` false. All via exact `deepEqual`/`equal` — a regression that blanked `lastGood` or stamped the wrong clock fails.
- **Backoff** — starts at `DEFAULT_POLL_MS`, doubles per failed poll (×2, ×4), and a 20-failure loop pins the `MAX_POLL_MS` ceiling; a success after failures restores the default (with an `intervalMs > DEFAULT` sanity check first, so the test proves it actually backed off before recovering).
- **Authoritative give-up** — `no-subscription` after a good reading: stopped, `lastGood` and `lastGoodAt` both cleared. `agent-not-found` on the first poll: stopped. Matches `isTransientQuotaReason`'s split exactly.
- **`unrecognized` is transient (#960)** — keeps polling and keeps `lastGood`; and the recovery test pins the historical bug (one bad first read used to stop the poller forever): after `unrecognized` then good(42), not stopped, week window reads 42, interval back to default.
- **Throwing driver** — `poll()` resolves (never rejects) with `{available:false, reason:'fetch-failed'}` and does not stop — the awaited `poller.poll()` would fail the test on a rejection, so the no-throw contract is genuinely asserted.
- **Lifecycle** — double `stop()` harmless; `start()` after `stop()` does not revive (`isStopped` stays true). Note `start()` here is the only `start()` call in the suite and it exercises only the stopped-guard branch; the immediate-first-poll behavior of `start()` is asserted nowhere (it would need a tick of async waiting). Gap noted — the SPEC's "first reading immediately" clause rests on code inspection — but nothing asserted is wrong.

The scripted `pollerOf` repeats the last script entry once exhausted (`Math.min(i++, length-1)`), which the backoff/ceiling tests rely on. The fake clock only advances when a test calls `advance`, so `lastGoodAt`/`lastFailureAt` expectations are exact.

The concurrency corner found in the source (`onGood` after an authoritative stop — see `quota-poller.BUG-ANALYSIS.md` bug 1) is untested here; all polls are awaited sequentially, so overlapping in-flight reads never occur in this suite. That is why the race survived.

## Functions (low-level)

- **`goodAt(weeklyPercent, agentPercent?)`** — builds a realistic three-window reading (session + week + week-model), so the recovery test's `.find(w => w.kind === 'week')` is meaningful. Correct.
- **`pollerOf(script, startAt?)`** — injected `read` and `now`; returns `advance`. Correct.
- All tests await every `poll()`; assertions follow the awaited calls. No unawaited promises, no assertions that cannot fail.

## Bugs found

None found.
