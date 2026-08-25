# Bug analysis: packages/framework/src/dashboard-rpc/relay-agent.ts

## Business logic (high-level)

The one decision point for every run-scoped dashboard call: serve it locally, or forward it to the
device that owns the agent (#1067 slice 2). Per `relay-agent.SPEC.md`: an agent this daemon is
relaying has no checkout here, so the same call goes to the device over its saved URL/token and the
answer comes back unchanged; an unreachable device yields the caller's own empty/failed shape so no
caller ever special-cases a remote agent.

Edge cases considered:

- `agentId === undefined` (project-scoped call routed through `relayOr`, e.g. `onProjectFiles`
  without an agent): `contextRemote().target(undefined)` — the daemon's lookup answers `undefined`
  for a non-relayed id, so `local()` runs. Correct.
- Device side of the relay: `contextRemote()` defaults to `NO_RELAYED_RUNS` when unwired
  (`context.ts`), so a relayed call arriving on the device never forwards onward — the loop the
  SPEC forbids cannot form. Correct.
- Unreachable device / non-2xx / timeout: `relayRpc` throws (`remote-run.ts` uses
  `AbortSignal.timeout(60s)` and throws on `!res.ok`), the `catch` returns `unreachable`. Correct.
- Errors from `local()` are deliberately *not* caught here — each local closure in `reads.ts` /
  `control.ts` carries its own forgiveness, and the seams underneath (`resolveProjectPath`,
  `worktreeSize`, `readGitStatus`, …) swallow internally, so nothing reachable rejects out of
  `local()`. Verified for every current caller.
- Type honesty: `(await relayRpc(...)) as T` — JSON round-trip preserves `null`/`[]`/objects; a
  device fn that resolved `undefined` arrives as `undefined` (absent `result` key), which every
  caller's `T` tolerates (`void` sends, nullable reads). Correct.

## Functions (low-level)

- `relayOr<T>(agentId, fn, args, local, unreachable)` — the only export. Looks up the device
  target; no target → `local()`; target → `relayRpc(target, fn, args)` with a blanket catch
  returning `unreachable`. The blanket catch also hides a device-side *error* (500) as "empty",
  which is exactly the SPEC's stated contract ("a device that cannot be reached yields the same
  empty or failed answer the local path gives"). The `?.` on `contextRemote()` is vestigial (the
  accessor never returns undefined) — harmless. Verdict: correct.

## Bugs found

None found.
