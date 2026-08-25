# Bug analysis: packages/framework/dashboard/rpc/control.ts

## Business logic (high-level)

Typed client stubs for the `control` RPCs (F3): each export is `rpc<typeof impl.X>('X')`, so the
call signature is checked against the daemon's implementation at build time, and the string is
the wire name `POST /_rpc/<name>` resolves against `RPC_HANDLERS` (built from the server module's
own export names in `src/dashboard-rpc/index.ts`).

The single correctness property of this file is name fidelity: the string passed to `rpc()` must
equal the implementation's export name — the type parameter cannot catch a mismatched string.
Verified export-by-export against `src/dashboard-rpc/control.ts` / `index.ts`: sendStop,
sendSetHandoff, sendChoice, sendBridgeAnswer, sendBridgeAnswerCancel, sendMessage,
sendRemoveWorktree, sendDeleteAgent, sendStart, sendOpenInApp, sendPushBranch,
sendOpenPullRequest, sendMerge, sendReleaseTicketLock, sendQueueTicket, sendQueueTicketPlan —
all 16 present server-side under exactly these names, and every `send*` the server module exports
has a stub here (nothing reachable is missing). The `export type *` re-export is type-only
(erased), so no server code can leak into the browser bundle.

## Functions (low-level)

- 16 `rpc(...)` consts — each a thin fetch wrapper produced by `lib/rpc.ts`; arguments and
  results ride JSON (none of these signatures carries Date/Map, per the transport's note).
  Verdict for each: correct (name matches implementation; type parameter pins the signature).

## Bugs found

None found.
