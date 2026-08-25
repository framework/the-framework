# Bug analysis: packages/framework/src/daemon-tick.ts

## Business logic (high-level)

The daemon's single background clock (E4): one 30s interval; each job declares `every: N` ticks between turns. Rules per `daemon-tick.SPEC.md`:

- **Cadences as integers off one clock** — exact ratios, no drifting timers; the timer is unref'd (background work never keeps the process up).
- **A tick is time passing, not a turn that ran (#1607)** — an interval firing that lands mid-turn increments `elapsedWhileBusy`, folded into the next turn's `tickNow += 1 + elapsedWhileBusy`, so one slow job cannot stretch every other cadence.
- **Missed turns are skipped, never queued** — dueness is `n - lastTurn[i] >= cadence`, measured from the job's *own* last turn (so a jumped-over job is due at the very next turn, not a whole further cadence later), and the turn is claimed *before* it runs (a throwing job has had its turn).
- **Start-up turn** — the constructor fires tick 0 immediately; `lastTurn` seeding (`onStart === false ? 0 : -cadence`) makes opt-in jobs due at tick 0 and opt-outs due exactly one full cadence later. Verified: tick 0 due iff `0 - (-c) >= c`; opt-out due first at `n - 0 >= c`.
- **A failing job costs only its own turn** — per-job try/catch, logged once with the job's name.
- **Stop waits out the turn in flight** — `stopped` flag checked at every job boundary (the current job runs to its end, later jobs in the tick are skipped), `clearInterval`, then `await inflight`. Matches "stops at the next job boundary".
- **Joining** — `tick()` during an in-flight turn returns the same `inflight` promise, so awaiting a tick means the tick finished; the interval's firing during a turn is counted, never queued.

Concurrency: single `inflight` promise, reset in `finally`; `runTick` is the only mutator of `lastTurn`; no overlap is possible since every entry point funnels through `tick()`. `tickNow` only grows; no overflow concern.

One SPEC-vs-code discrepancy found (see Bugs): the SPEC states a *directly asked-for* turn "does not advance" the clock, but every non-joined `tick()` call — the constructor's, the interval's, and a direct caller's alike — advances `tickNow` by `1 + elapsedWhileBusy`. The tests pin the advancing behavior explicitly (four `tick()` calls are ticks 0–3, making an `every: 3` job run twice), and a non-advancing direct turn would be inert (nothing would ever be due on it), so the code+tests are coherent and the SPEC sentence is the odd one out. In production nothing calls `DaemonTick.tick()` directly (verified: only the constructor and the interval; shutdown uses `stop()`), so no runtime misbehavior follows — it is a spec/documentation mismatch.

## Functions (low-level)

- `TickJob` / `DaemonTick` / `DaemonTickOptions` — shapes match daemon-services' usage (name/every/run; the `onStart` escape hatch is currently unused there but tested). Correct.
- `DAEMON_TICK_MS = 30_000` — the finest cadence any job asks for (data sync/CI/Discord use `every: 2` ≈ 1 min, per spec). Correct.
- `cadence(job)` — `max(1, every ?? 1)`; floors 0/negative to 1 rather than misbehaving. Correct.
- `runTick(n)` — in-order, awaited jobs; `stopped` checked before each; dueness from `lastTurn`; claim-before-run; catch logs `[framework] <name> failed this tick: <message>`. Correct.
- `tick()` — stopped → resolved promise; joined when inflight; otherwise advances `tickNow` by `1 + elapsedWhileBusy`, resets the counter, runs and clears `inflight` in `finally`. Correct mechanics (the direct-call advancement is the SPEC discrepancy above).
- interval callback — busy → `elapsedWhileBusy++`; idle → `void tick()`. Note a firing folded into `elapsedWhileBusy` only takes effect at the *next* trigger (interval or direct call), so after a long turn ends mid-interval, a due job waits up to one base interval — consistent with "folded into the next one". `timer.unref?.()`. Correct.
- `stop()` — `stopped = true`, `clearInterval`, `await inflight?.catch(() => {})` so a rejected turn cannot reject the shutdown (`runTick` never rejects anyway — every job error is caught). Correct.

## Bugs found

1. `L124` (with the corresponding prose in `daemon-tick.SPEC.md`, "A tick is time passing" section): the SPEC asserts "A turn asked for directly — by the shutdown sequence, or by a caller driving the clock — does not advance it, because neither of those is elapsed time", but `tick()` unconditionally advances `tickNow` by 1 for any non-joined caller — and the tests pin exactly that (driving `tick()` by hand advances ticks 0,1,2,3). The behaviors cannot both be right; since a non-advancing direct turn would run nothing (every job's `lastTurn` already equals `n`) and production has no direct callers, the code+tests carry the real intent and the SPEC sentence misdescribes the mechanism. Severity: minor (documentation/spec mismatch, no production-reachable misbehavior). Fix sketch: correct the SPEC sentence (a direct turn advances the clock by one tick like an interval firing, and joins rather than double-counts when one is in flight) — or, if the SPEC is meant literally, run direct turns at the current `tickNow` without incrementing and accept that they only re-run already-due jobs; the former matches the tests.
