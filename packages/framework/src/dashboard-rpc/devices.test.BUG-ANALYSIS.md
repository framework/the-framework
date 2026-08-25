# Bug analysis: packages/framework/src/dashboard-rpc/devices.test.ts

## Business logic (high-level)

Pins `checkDevices` (#1072) against real HTTP: a throwaway `node:http` server per "device" answering a fixed status, so the reachability verdict is exercised through the real `pingRemote` fetch path (cookie'd request, timeout, catch-to-false) rather than a stub.

- **Test 1** — three devices: a 200 server → `true`; a 401 server → `false` (a device that *answers* but rejects the token is unreachable to the user, the distinction the SPEC calls out); `http://127.0.0.1:1` with nothing listening → connection refused → `false`. Asserts the exact map `{up: true, down: false, gone: false}`, so a missing/extra key or wrong verdict fails. Servers are closed in `finally`. Verifies the claim. (Port 1 requires no privileges to *connect* to and is essentially never bound; ECONNREFUSED is immediate, so no timeout flake.)
- **Test 2** — `[]` → `{}`, and malformed entries (`{id: 1}`, `null`) → `{}`: dropped, not pinged, never in the result. The "not pinged" half is implied rather than observed (no counter server), but since the entries lack a URL there is nothing they could ping; the observable contract (absent from the map) is asserted. Verifies the claim.

Both tests await everything they start; the `device()` helper resolves only once `listen` has bound (no port race) and reads the real ephemeral port from `address()`.

Edge cases the suite leans on implicitly: `pingRemote`'s `AbortSignal.timeout` bounds a hung server — untested here, acceptable since the down cases used are deterministic; the relay `/_relay/ping` path constant is not asserted (the stub answers any path), so a path typo in `pingRemote` would not be caught here — that contract belongs to `remote-run`'s own tests. Noted, not a bug.

## Functions (low-level)

- **`device(status)`** — one-shot HTTP server on `127.0.0.1:0`, `writeHead(status)` + `end()` per request; returns url + promisified close. Correct.
- **Test bodies** — as above; assertions are `deepEqual` on the full result map, so they cannot pass vacuously. Correct.

## Bugs found

None found.
