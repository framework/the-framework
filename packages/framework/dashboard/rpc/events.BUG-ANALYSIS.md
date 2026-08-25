# Bug analysis: packages/framework/dashboard/rpc/events.ts

## Business logic (high-level)

Re-exports `openEvents` (from `lib/rpc.ts`) as `onEvents`, plus the `EventChannel` type — a
pure aliasing module so that everything server-backed lives in `rpc/` (the SPEC says exactly
this). No logic of its own; the stream client's behavior (SSE parse, clean-vs-errored close) is
`lib/rpc.ts`'s responsibility and analyzed with its consumers (`use-live-events`).

One consistency check: consumers import `{ onEvents }` and `type { EventChannel }` from here
(`use-live-events.ts` does), and the alias points at the real subscription endpoint
(`GET /_rpc/events?projectId=...&agentId=...`) whose server half is `RPC_EVENT_STREAM`. Names
line up; nothing else to hold.

## Functions (low-level)

- `export { openEvents as onEvents }` / `export type { EventChannel }` — aliases only. Verdict:
  correct.

## Bugs found

None found.
