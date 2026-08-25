# Bug analysis: packages/framework/src/daemon-tick.test.ts

## Business logic (high-level)

Tests for the shared background clock, driven deterministically through the awaitable `tick()` (the interval is set to an hour in the `clock()` helper so it never fires during a test — except in the one test that is *about* the interval, which sets 5ms). Coverage against `daemon-tick.test.SPEC.md`:

- **Cadence and skip-not-queue**: an `every: 3` job runs on ticks 0 and 3 across four driven ticks while the every-tick job runs on all four; the exact `ran` sequence (`deepEqual`) also pins job ordering within a tick.
- **Start-up opt-out**: `onStart: false` sits out tick 0 and takes tick 1 (`every` defaulting to 1 → seeded `lastTurn = 0`, due at `n >= 1`) — the asserted sequences match the seeding math exactly.
- **Failure isolation**: a throwing job logs once (`CI watch failed this tick: gh is down`) and the next job in the same tick still runs.
- **Serialization**: a slow job's `start`/`end` bracket the next job's run — order `deepEqual` proves awaited, in-order execution.
- **Joining**: three concurrent `tick()` calls produce one turn (`peak === 1`) and awaiting them means the turn finished (`running === 0`).
- **Stopped clock**: no further turns after `stop()`.
- **Stop waits out the in-flight turn**: `stop()` resolves only after the 20ms job set `finished = true` (asserted synchronously after the await — this is the boundedness the daemon's quiesce depends on, and daemon-services.test's cleanup relies on it).
- **#1607 (time passes while busy)**: with a 5ms interval, the first turn is held open by a blocked job while ~10 firings land; after release, one further `tick()` finds the `every: 5` job due (`rare === 2`) — proving the mid-turn firings counted — and the slow job took exactly one further turn (`slowTurns === 2`), proving missed turns were folded, not queued. The `finally` releases the blocker *before* `stop()` to avoid deadlocking the shutdown wait — correctly reasoned in the comment.

Do the tests verify their claims? Yes — exact sequences, counts, elapsed-time flags, and log contents; every promise is awaited and every test stops its clock in `finally` (no interval leaks even though the helper's interval is unref'd anyway).

These tests also settle the SPEC discrepancy recorded against `daemon-tick.ts` L124: they treat each driven `tick()` as advancing the clock by one (tick numbering in the comments and the `every: 3` expectations depend on it), directly contradicting the SPEC prose "a turn asked for directly does not advance it". The tests are internally consistent with the implementation; the mismatch is filed on the source/SPEC side.

Timing robustness of the #1607 test: 50ms of 5ms firings while blocked guarantees `elapsedWhileBusy` well past the cadence of 5 even under scheduler jitter (only ≥5 firings are needed; ~10 land); `rare === 1` before release is safe because the turn provably has not completed (the blocker is held). The final `tick()` after `await turn0` is a direct call, which per implementation adds `1 + elapsedWhileBusy` — the assertion does not depend on the exact tick number, only on being past 5. Sound.

## Functions (low-level)

- `clock(jobs)` — hour-long interval, captured logs, returns `{tick, logs}`. Correct.
- Each test — traced against the implementation above; expected values are what the code produces, and none can pass vacuously (counts and `deepEqual`s throughout). The stop-waits test's `await turn` at the end also surfaces any rejection from the in-flight turn. Correct.

## Bugs found

None found. (The tests contradict one `daemon-tick.SPEC.md` sentence about direct turns not advancing the clock; recorded as the spec-mismatch bug on `daemon-tick.ts`, where the reconciliation belongs.)
