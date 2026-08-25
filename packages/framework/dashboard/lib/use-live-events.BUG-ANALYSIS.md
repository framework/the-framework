# Bug analysis: packages/framework/dashboard/lib/use-live-events.ts

## Business logic (high-level)

The shared live feed (#405/#749/#948/#1383): one SSE subscription per (projectId, agentId),
accumulating `FrameworkEvent`s into React state, plus two flags — `lost` (stream down, retrying
with 1/2/4/8s backoff) and `done` (server closed on purpose). Key invariants, checked one by one:

- **Addressing** — the main effect depends on `[projectId, agentId]`; changing either tears the
  channel down (cancelled flag + `channel?.close()` + timer clears) and resubscribes. A pending
  `onEvents` promise that resolves after cancellation closes the channel it got. Correct.
- **Loss vs done** — `retry()` is both the subscribe-rejection handler and the errored-close
  handler; a clean close sets `done` only when not cancelled. `attempt` resets to 0 on every
  successful open (the SPEC explicitly says the counter resets on success, so a flapping stream
  retrying at 1s forever is specified, not a bug). Correct.
- **Reconnect never shrinks (#1383)** — `first` distinguishes the initial subscribe (streams
  straight into a just-cleared pane) from a reconnect (buffers into `buffer`, swaps on
  `stream-sync` or the 1.5s grace timer). `stream-sync` is consumed (early return) so it never
  renders; on a first subscribe `swap()` no-ops because `buffer === undefined`. A close
  mid-replay drops the buffer and clears the grace timer before retrying. All verified against
  the tests. Correct.
- **Reset at an agent boundary** — a separate `[resetKey]` effect empties `events` without
  touching the subscription; the tail's rewrite detection then streams the new agent in.
- **Scoping** — with an `agentId` the feed is returned whole (a resumed agent's pre-resume
  transcript must survive, #762); the project-root fallback is sliced to the newest `session`
  via `currentAgentEvents`. Matches the SPEC's asymmetry exactly.

Concurrency review: only one channel/timer/graceTimer can be live at a time (retry is only
reachable from the current channel's close or the current subscribe's rejection); the cancelled
flag is checked in every async continuation; cleanup clears both timers and closes the channel.
`stampReceived` is called for every event that comes off the channel, buffered or not — note that
on a reconnect the swapped-in replay is therefore re-stamped with the reconnect time, so per-row
arrival times shift after a blip. That is inherent to the atomic-swap design and blessed by the
SPEC ("stamped with the moment it arrived"); cosmetic only, noted, not reported.

One genuine race found between the two effects — see Bugs.

## Functions (low-level)

- `retryDelay(attempt)` — clamps into `RETRY_DELAYS_MS`; safe for any non-negative attempt.
  Correct.
- `useLiveEvents(projectId, agentId, resetKey)`:
  - resetKey effect — `setEvents([])` on change (and harmlessly on mount). See bug 1 for its
    interaction with a buffered reconnect.
  - main effect — described above. `projectId === null` renders the empty/false/false state and
    subscribes to nothing; the effect returns no cleanup in that branch, which is fine because
    nothing was created. Errored-close → `retry()` sets `lost` and schedules; `timer` holds only
    the latest timeout. `setLost(false)` fires when the channel opens, before the buffered swap —
    the feed can be up to 1.5s behind while not marked lost; this is the documented #1383
    behavior (the banner clearing on resubscribe predates the fix and was kept). Correct.
  - `swap()` — guarded on `cancelled` and `buffer !== undefined`; idempotent (grace timer firing
    after a sync-triggered swap no-ops). Correct.
  - listen handler — `stream-sync` → swap; else stamp + buffer-or-append. Appends via functional
    `setEvents(prev => ...)`, so out-of-band pushes never lose events. Correct.
  - onClose — drops the buffer, clears the grace timer, then retries (err) / sets done (clean,
    not cancelled). The dashboard's `EventChannel.close()` invokes onClose with no error, but
    cleanup sets `cancelled` first, so unmount never sets `done`. Correct.
  - `scoped` memo — `agentId ? events : currentAgentEvents(events)`. Correct.

## Bugs found

1. `L104` (the `swap()` write, interacting with the `[resetKey]` effect at L54-56): a buffered
   reconnect can resurrect the finished run the reset just cleared. Scenario: the project-root
   fallback feed (no `agentId`) loses its stream and resubscribes; while the replay is buffering
   (up to the 1.5s grace, or until `stream-sync`), the user starts a new agent, which bumps
   `resetKey` and empties the pane; the swap then fires and `setEvents(replay)` puts the
   *previous* agent's full log back on screen — exactly the stale content #705/#resetKey exists
   to keep out of the jump-to-live view, until the new agent's truncation streams through.
   Contradicts the SPEC's "Starting a new agent empties the pane immediately". Requires a stream
   blip coinciding with a Start, so it is rare. Severity: minor. Fix sketch: have the resetKey
   effect also invalidate any pending buffer — e.g. keep the buffer/graceTimer in a ref the
   resetKey effect can clear, or include `resetKey` in the subscription's guard so `swap()`
   checks the resetKey generation it was created under before writing.

(Also noted, not a bug: re-stamping of replayed events on reconnect shifts arrival times — see
above.)
