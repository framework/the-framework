# Bug analysis: packages/framework/dashboard/lib/use-working.ts

## Business logic (high-level)

"Is any agent working right now?" (#875), deliberately cross-project (SPEC). Implementation:
`usePolled(onOverview, IDLE, 5000, [])` and `value.active.length > 0`.

- **Until the first answer, nothing is treated as working** — the initial is `IDLE`
  (`active: []`), so the hook reports false until a successful read. Matches the SPEC sentence.
- **Stable initial** — `IDLE` is a module constant, so `usePolled`'s captured `initialRef` and
  the deps `[]` mean no churn; the poll runs once on mount and every 5s, stopping on unmount
  (interval cleared by useAsyncValue's cleanup).
- **Failure behavior** — a failed poll keeps the last value (useAsyncValue catches), so a daemon
  blip does not flap the working mark; a daemon restart with agents gone corrects on the next
  successful tick. Reasonable and consistent with the shared read pattern.
- `onOverview` is passed by reference; it closes over nothing, honoring the "load must close over
  exactly deps" contract with deps `[]`.

Edge: `value.active` — `Overview.active` is typed as an array and IDLE provides one, so `.length`
is always safe; the RPC returning a malformed payload would throw in the transport (non-JSON) and
be swallowed by the keep-last-value catch, never here.

## Functions (low-level)

- `useWorking(): boolean` — described above. Verdict: correct.
- `IDLE` — `{ active: [], queueOpen: 0, recent: [] }` satisfies `Overview`; only `active` is
  read. Verdict: correct.

## Bugs found

None found.
