# Bug analysis: packages/framework/src/dashboard-rpc/quota.ts

## Business logic (high-level)

The usage panel's three RPCs: where the account's quota stands, what Auto PM last decided, and the
"Run now" button. All three are adapters over closures the daemon wires into the dashboard context;
the meter, the loop and its report all live elsewhere and are deliberately *not* rebuilt here (one
poller, because the usage read is rate-limited upstream and a second one would double it).

Per `quota.SPEC.md`:

- **An unreadable quota shows as unavailable, never as unused.** `onQuota` maps any read failure to
  `{windows: [], unavailable: 'fetch-failed'}` rather than to zeroes — the panel's one hard rule,
  because an empty bar reads as "nothing used". Note the source itself already keeps the last good
  reading through a blip and flags it stale; this fallback only covers the source *throwing*.
- **Auto PM's last decision is reported, or nothing.** `onAutoPm` answers `undefined` when the loop
  has nothing to say, which the panel renders as "nothing to say" rather than "a sweep found
  nothing".
- **"Run now" sweeps even with the preference off**, awaits the sweep, and answers with the outcome
  lines that sweep produced — one per project — so the card can state them without a poll racing
  the sweep. A sweep that itself failed is `{ok:false}`.

**Ordering, which is the interesting part.** `sendAutoPmSweep` captures the reporter *before*
awaiting the sweep. The comment records why: the context used to be request-scoped and evaporated
across an await, so a post-await `contextAutoPm()` found nothing on every real request. Since F3 the
context is module-level and wired once, so the capture is no longer load-bearing — but it is still
what the RPC promises, and the sibling test models the loss deliberately. Capturing first is also
the correct choice on its own terms: a closure needs no context to be called later.

**Two failure modes are folded into one answer.** `{ok:true}` without `outcomes` means either "the
loop has no report yet" or "reading the report threw". The card renders both as "the sweep ran",
which the SPEC's rationale endorses ("rather than pretending nothing happened").

**What the daemon actually wires.** `daemon.ts` L214: `autoPmSweep: opts => services?.wakeAutoPm({
onDemand: true, ...opts })`, and `daemon-services.ts` L548: `wakeAutoPm: opts =>
autoPm.tick(opts).catch(() => {})`. Two consequences this module cannot see: (a) a tick that
rejects is swallowed one layer down, so `{ok:false}` is unreachable in production — the SPEC's "a
sweep that itself failed is reported as a failure" only ever holds in tests; (b) during the window
between the dashboard binding and `services` being assigned, the optional chain answers `undefined`,
`await undefined` resolves at once, and the click is reported as a successful sweep that never ran.
See bugs 1 and 2.

## Functions (low-level)

### `noReading()`
Constructs the honest-empty `QuotaView`. No boundary field at all (not a zeroed one), matching the
"never imply nothing used" rule. Correct.

### `onQuota()`
`contextQuota().read().catch(() => noReading())`. `contextQuota()` throws when unwired — outside the
`.catch`, deliberately (a wiring bug is not a degraded meter). The source's own `read` already
answers a `QuotaView` with `unavailable` set when the poller has no good reading, so this catch is
the belt on top of the braces. Correct.

### `onAutoPm()`
`contextAutoPm()()` inside a `try`, so both an unwired context and a throwing reporter answer
`undefined`. That is looser than the D3 stance the other accessors take (unwired should be a loud
wiring bug), but it lands on the same value the "nothing to report yet" case uses, and the panel
renders it identically. Correct.

### `sendAutoPmSweep(opts?)`
- Captures `contextAutoPmSweep()` and `contextAutoPm()` before any await; an unwired context throws
  out of the RPC (not caught), which is the intended wiring-bug signal.
- `await sweep(opts)` — `opts` is passed through **by reference, unrebuilt**, which is what lets a
  new narrowing reach the loop without touching this function; the sibling test pins exactly that.
  `opts` is browser-supplied and is not validated here: `only` may be any JSON value, `projectId`
  any string. `AutoPmOnly` is `'drain' | 'plan' | {lock: string}`, and the loop is what interprets
  it — a nonsense `only` reaches `autoPm.tick` unfiltered. Worth stating as a reliance; the loop
  treats an unrecognised value as "no narrowing", so nothing dangerous follows from it.
- A throwing sweep → `{ok:false}` with no detail (nothing logged daemon-side either).
- Then `reporter()`; a throw → `{ok:true}` with no outcomes; `undefined` → `{ok:true}` (the
  conditional spread avoids an explicit `outcomes: undefined` key, which `JSON.stringify` would drop
  anyway but which would change `deepEqual` semantics on this side).
- Race worth naming: the outcomes are read after the tick resolves, but the loop's report is shared
  mutable state — a *scheduled* sweep finishing between this tick and the read would hand the click
  the other sweep's lines. The daemon's loop serialises ticks ("Ticks never overlap"), so the window
  is not reachable today; noted, not reported.

Verdict: correct in itself; the two defects are in what the daemon wires behind it.

## Bugs found

1. **L69–72 (fix belongs in `packages/framework/src/daemon-services.ts` L548): `{ok:false}` is
   unreachable in production, so a sweep that fails is reported to the user as a sweep that ran.**
   `sendAutoPmSweep` reports failure by catching the sweep's rejection, but the daemon wires
   `wakeAutoPm: opts => autoPm.tick(opts).catch(() => {})` — the rejection is swallowed one layer
   below, so the RPC always sees a fulfilled promise. Scenario: `autoPm.tick` throws (a registry
   read blows up mid-sweep, say); the user presses "Run now" and the card says the sweep ran and had
   nothing to report, while the daemon logged nothing either. This contradicts `quota.SPEC.md`
   ("A sweep that itself failed is reported as a failure") and makes the tested `{ok:false}` branch
   a fiction that only `quota.test.ts`'s fake can reach. Severity: minor. Confidence: medium (it
   depends on `tick` being able to reject at all — it catches a great deal internally). Fix: let
   `wakeAutoPm` reject and move the `.catch(() => {})` to the two fire-and-forget call sites
   (`daemon.ts` L207's `void services?.wakeAutoPm()` and the preference-write hook), so the one
   caller that awaits it can see the failure.

2. **L69 (fix belongs in `packages/framework/src/daemon.ts` L214): a "Run now" that arrives before
   the background services exist is reported as a successful sweep.** The wiring is
   `opts => services?.wakeAutoPm({ onDemand: true, ...opts })`; `services` is assigned only after
   `startDashboard` resolves and the `onListening` block runs, but the mount is already answering
   RPCs by then. In that window the optional chain returns `undefined`, `await undefined` resolves
   immediately, `reporter()` (also `() => services?.autoPmReport()`) answers `undefined`, and the
   RPC returns `{ok:true}` — the card says the sweep ran when nothing was even asked to run.
   Severity: minor (a seconds-long window at daemon start, and the user can press again).
   Confidence: medium. Fix: make the closure answer a refusal when the services are not up, e.g.
   `autoPmSweep: opts => services ? services.wakeAutoPm({onDemand: true, ...opts}) : Promise.reject(new Error('the daemon is still starting'))`,
   which `sendAutoPmSweep` already renders as `{ok:false}`.
