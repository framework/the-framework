# Bug analysis: packages/framework/dashboard/lib/event-times.ts

## Business logic (high-level)

Arrival times for the live feed (#948, event-times.SPEC.md) as a side table: a module-level
`WeakMap<FrameworkEvent, number>` keyed on event object identity, so the FrameworkEvent type
stays the framework's and replayed events (fresh objects deserialized from the record) simply
have no entry — "no times instead of wrong ones", exactly the SPEC.

Design-soundness audit:

- Identity keying is the load-bearing choice: it works because the live channel hands each event
  object to `stampReceived` once and the UI later asks about *the same object*. If any consumer
  cloned events (spread, structuredClone) before display, times would silently vanish — the
  live-state selectors pass events through by reference, so the invariant holds today. Reliance
  noted.
- WeakMap → no leak: entries die with the events when a feed is dropped. A plain Map would leak
  across long dashboard sessions; this is the right structure.
- Module-level singleton shared across all agents' feeds — fine, since keys are per-object.
- Concurrency: single-threaded JS; stamp-then-read ordering is guaranteed by the channel handler
  stamping before dispatching to state.
- `Date.now()` (wall clock) rather than a monotonic clock: a system clock jump mid-run would
  skew displayed arrival times — cosmetic and out of scope for a display-only table.

## Functions (low-level)

- `stampReceived(event)` — set; re-stamping the same object would overwrite (never happens: one
  arrival per object; and overwriting with a later "now" would be wrong only in that impossible
  case). Correct.
- `receivedAt(event)` — get-or-undefined; the undefined is the API ("was never live"). Correct.

## Bugs found

None found.
