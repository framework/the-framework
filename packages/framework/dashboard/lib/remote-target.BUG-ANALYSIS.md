# Bug analysis: packages/framework/dashboard/lib/remote-target.ts

## Business logic (high-level)

The transient "run the next agent on this saved device" selection (#1067): module-scoped `selectedDeviceId` (a profile id = origin URL) with a subscribe/notify pair, read reactively by the Start form and imperatively at submit. Deliberately in-memory only — SPEC: the choice lasts only as long as the page, never persisted, because tokens are per-browser secrets and the destination is a per-agent decision. Null = ordinary driver target.

Invariants and edges:

- Snapshot is the primitive string/null itself — identity-stable, so `useSyncExternalStore` has no re-render-loop hazard and no cache is needed.
- `selectRemoteDevice` early-returns on same id, so redundant selections do not notify.
- Server snapshot `null` matches the SSR reality (no device pickable during prerender).
- A stale selection (device removed from `profiles.ts` after being selected) is not cleared here; the consumer that resolves id → profile at submit time must handle a miss. That coupling lives outside this file (noted; the Start form reads both stores and the id is only attached when a matching profile exists at submit). Reliance, not a bug in this module.
- Page reload clears the selection by design ("lasts only as long as the page").

## Functions (low-level)

- `selectRemoteDevice(id)` — set + notify, dedupe on equality. Correct.
- `getSelectedRemoteDeviceId()` — plain read for event-handler/submit time. Correct.
- `subscribe(listener)` — add/remove symmetric; returns the deleter. Correct.
- `useSelectedRemoteDeviceId()` — `useSyncExternalStore(subscribe, getSelectedRemoteDeviceId, () => null)`. Correct.

## Bugs found

None found.
