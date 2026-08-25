# Bug analysis: packages/framework/src/dashboard/server.test.ts

## Business logic (high-level)

Exercises the real HTTP server over real sockets (port 0), covering exactly what `server.test.SPEC.md` claims:

- **Serving**: 503 without a bundle; shell at `/`; hashed asset with a JS content type; SPA fallback for unknown routes.
- **#938 survival**: malformed percent path (`/%zz`), malformed escape inside a proxy path (`/browser/p/%zz/stream`), and an unparseable absolute-form request target (raw socket `GET http://[`) — each answers sanely and a follow-up request proves the process survived. These are genuine regression pins (each used to kill the daemon).
- **CSRF + DNS rebinding**: cross-origin POST → 403; rebound Host (matching Origin, evil Host) → 403 while the genuine Host passes. The two guard functions are additionally unit-tested with synthetic `IncomingMessage`s covering absent Origin, loopback origins, bracketed IPv6, `127.evil.com`-style rebound names, missing Host, non-loopback binds (check stands aside), and the bound-name-itself case.
- **Token guard (#1051)**: all four route families 401 without credentials; valid `?token=` → 302 to clean path + `HttpOnly`/`SameSite=Lax`/`Path=/` cookie; wrong token (same-length and shorter) → 401; cookie admits bundle//_rpc//browser; no token → byte-identical local behavior.
- **Relay (#1067/#1072)**: `/_relay/start` 401 without cookie / starts with it; nested `remote` target stripped while other options survive; `/_relay/events` 401 / streams ndjson; `/_relay/ping` 401 / 200 empty and never spawns; loopback relay (no token) still refuses cross-origin and rebound POSTs while the origin-less device call passes.

Do the tests verify what they claim? Yes — every assertion is observable behavior over the wire, and the negative assertions (`starts.length === 0`) pin that refused requests did not reach the spawn. The guard-on-loopback-with-token compromise (not a true non-loopback bind) is disclosed in a comment, matching the SPEC's framing.

Test hygiene points examined:

- `fetchText`/`fetchAuth`/`postAuth`/`postCrossOrigin`/`postRebound` all wire `error` → reject, collect the body, and resolve on `end`. No missing awaits; every test closes its dashboard and removes its bundle dir in `finally`.
- `readNdjson` resolves after `count` lines then destroys the socket; the subsequent 'error' from `destroy()` is deliberately swallowed; a 4s unref'd timer rejects on hang. Sound.
- `rawRequest` writes a raw request line with `Connection: close` and resolves on socket close; 5s socket timeout destroys. Sound.
- The `dashboard()` helper uses `defaultQuotaSource()` — this starts a real `QuotaPoller` per test (which may invoke the local `claude` binary's quota read). The poller's timer is unref'd and `dash.close()` stops it (except in the 503 test, where daemon-side compensation does not exist — the poller keeps its unref'd timer until process exit). Harmless for tests, worth knowing: unit tests can shell out to `claude` if installed.
- Type-cast fixtures (`{ kind: 'log', message } as FrameworkEvent`) bypass the event union — fine for transport tests, which only assert `message` round-trips.

## Functions (low-level)

- **`dashboard(over)`** — full production-shaped options with stub handlers; port 0. Correct.
- **`fetchText` / `fetchAuth`** — GET helpers; `fetchAuth` also surfaces `set-cookie[0]` and `location`. Correct.
- **`rawRequest(url, requestLine)`** — for request targets `http.get` refuses. Correct.
- **`postCrossOrigin` / `postRebound`** — the attack shapes; `postRebound` overrides `host` + matching `origin`, which is exactly the DNS-rebinding signature. Correct.
- **`fakeBundle()`** — index.html + `assets/app.js`. Correct.
- **`guardedDashboard()` / `relayDashboard()`** — compose the above; `relayDashboard` records starts and serves a fixed 2-event tail. Its `tailEvents` ignores the agent id — fine for these assertions.
- **`postAuth` / `readNdjson`** — described above. Correct.
- Final two tests unit-test `isSameOriginRequest`/`isExpectedHost` directly with cast objects — they pin the same table the SPEC lists. Correct.

## Bugs found

None found.
