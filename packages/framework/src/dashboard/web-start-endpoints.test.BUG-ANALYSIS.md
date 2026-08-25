# Bug analysis: packages/framework/src/dashboard/web-start-endpoints.test.ts

## Business logic (high-level)

Drives the real routes over a real `node:http` server with global `fetch`, backed by a real `BridgeStarts` queue — so the tests cover the route/queue integration, not mocks of it. Coverage matches `web-start-endpoints.test.SPEC.md`:

- **Happy path**: POST → 202 + id; GET → `{state:'queued'}` (deepEqual, so no stray fields); extension side simulated via direct `starts.claimNext()`/`starts.resolve(...)`; GET → created with sessionId and the derived claude.ai URL (deepEqual pins the URL construction).
- **Failure travel**: resolve(ok=false, note) → `{state:'failed', note}` — pins that the extension's note reaches the run and that no sessionId/url leak in.
- **409 fast-fail**: `extensionAlive` false → 409 with the "no browser extension" reason.
- **Guard table**: missing token → 401; wrong token → 401; bad repo slug → 400 (the queue's validation reaching the wire); non-object body → 400; GET on the collection → 405; unknown id → 404; `../x` → 404 (path-shape refusal); bridge off (`serve(undefined)`) → 404.

Do the tests verify what they claim? Yes. Each response's status is asserted, and the two state reads use `deepEqual`, which would catch e.g. a `claimed` state leaking as `queued` or extra fields. The serve() helper `void`-dispatches the handler exactly like server.ts does, so an unhandled rejection in the handler would also fail these tests loudly (process-level), mirroring production wiring.

Hygiene: every test closes its server(s) in `finally` with `closeAllConnections` first, so keep-alive fetch sockets cannot hang the runner. `post()` sets the bearer conditionally, letting the same helper produce the no-token case. The `TOKEN` is 43 chars like a real registry token.

Coverage gaps (noted, not defects): the claimed state is never observed over the wire (only queued/created/failed); `resolve(ok=true, undefined)` ("success without a session id" → failed) is a BridgeStarts behavior tested in bridge-starts' own suite, not re-tested here — right place for it; the 512KB body cap rejection path is unexercised.

## Functions (low-level)

- **`serve(handlers)`** — real listener on 127.0.0.1:0; pathname parsed with the same `new URL(...).pathname` shape the server uses; close force-closes connections. Correct.
- **`wired(starts, alive)`** — production-shaped handlers delegating to a real queue. Correct.
- **`post(url, body, token)`** — JSON POST with optional bearer; `token: null` drops the header (distinct from `'wrong'`). Correct.
- The four tests — all awaits present (each `fetch` and `.json()` awaited); assertions on observable wire behavior. Correct.

## Bugs found

None found.
