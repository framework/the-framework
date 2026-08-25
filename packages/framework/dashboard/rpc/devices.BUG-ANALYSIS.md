# Bug analysis: packages/framework/dashboard/rpc/devices.ts

## Business logic (high-level)

Typed client stub for the saved-device health check (#1072): `checkDevices` is declared against
`src/dashboard-rpc/devices.ts`'s own export and addressed by that exact name — verified present
in the server module and in `RPC_HANDLERS` (index.ts re-exports `checkDevices`). The type-only
`export type *` re-export keeps the browser bundle free of server code.

Security note (verified consistent with the design): the browser sends each device's token in
the POST body to its own same-origin daemon, which is the documented #1052 model (tokens are a
per-browser secret, the daemon does the cookie'd ping) — no token appears in a URL.

## Functions (low-level)

- `checkDevices` — one stub; name and signature pinned to the implementation. Verdict: correct.

## Bugs found

None found.
