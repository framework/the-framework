# Bug analysis: packages/framework/dashboard/lib/use-live-events.test.tsx

## Business logic (high-level)

Tests for `useLiveEvents`, covering the four areas the test SPEC names: addressing (#770),
loss/recovery (#948), run scoping (#762/#749), and the reconnect-without-shrinking contract
(#1383). The `fakeChannel()` stub records `listen`/`onClose` callbacks and exposes `push`/
`dropWith`, which is exactly the `EventChannel` surface the hook consumes.

Do the tests verify what they claim?

- Addressing: asserts the exact `(projectId, agentId)` pair `onEvents` was called with, including
  the `undefined` fallback and the resubscribe on a changed run id. Real assertions, they can fail.
- Loss: an errored drop must render `lost`, then the retry (first delay 1s, real timers) must
  resubscribe and render `live` — `timeout: 3000` gives the 1s backoff room. The clean-close test
  waits 1200ms (past the would-be first retry at 1s) before asserting `onEvents` was called once,
  so the negative has teeth. The failed-subscribe test uses `mockRejectedValueOnce` then a good
  channel; correct.
- Scoping: an agent-addressed feed keeps `a,session,b`; the fallback slices to `session,b`.
  Pins the #762 asymmetry precisely.
- Reconnect: the four tests walk the swap protocol — sync marker swallowed on first subscribe;
  populated feed held while the second channel's shorter prefix streams (`expect(feed()).toBe('a,b')`
  asserted synchronously between pushes — this is the load-bearing "never shows less" check);
  atomic swap on `stream-sync`; grace-deadline swap when no marker comes (1.5s < the 3s waitFor);
  and a mid-replay death keeping the old content through a third attempt (retry delays 1s + 2s
  < the 4s waitFor). All assert observable feed content, not internals.

Timing-race review: after `waitFor(onEvents called N times)` the test immediately `push`es into
the new channel. `onEvents` is invoked synchronously inside `subscribe()`, and the `.then`
handler that registers `listen` runs one microtask later; `waitFor`'s polling means its own
continuation runs at least a macrotask after the call count flipped, by which time the microtask
that registered the listener has run. So the pushes cannot outrun listener registration in
practice. Pushes happen outside `act()`, but every assertion goes through `waitFor`/`getByText`
which flushes; at worst this produces act() warnings, not flakes.

`afterEach` calls `vi.useRealTimers()` although no test installs fake timers — harmless
belt-and-braces. `cleanup()` unmounts, and the hook's effect cleanup clears its retry timers, so
a test's pending 1s retry cannot fire into the next test.

## Functions (low-level)

- `fakeChannel()` — broadcasts to all registered listeners/close callbacks; `close` is a no-op,
  which is fine (the hook's own `cancelled` flag is what matters). Correct.
- `Probe` / `FeedProbe` — render `lost` and the joined feed respectively; `feed()` reads
  `textContent`. The join maps a `log` to its message and anything else to its kind, so a
  `stream-sync` leaking through would show up as `stream-sync` in the string — the "marker is
  swallowed" assertion genuinely covers it. Correct.
- Each test analyzed above; all can fail if the behavior regresses. No test asserts on a value it
  just wrote, none forgets to await.

## Bugs found

None found.
