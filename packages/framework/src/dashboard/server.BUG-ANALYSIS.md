# Bug analysis: packages/framework/src/dashboard/server.ts

## Business logic (high-level)

The one HTTP server the daemon runs. Responsibilities, per `server.SPEC.md`:

- **Routing order** (request handler, L216-266): parse pathname defensively (400 when unparseable, #938) → bridge routes (`/_bridge`) → web-start routes (`/_web-start`) → shared token guard (#1051) → relay (`/_relay`, plus browser-origin guard) → RPC mount (`/_rpc`) → browser proxy (`/browser/…`, plus browser-origin guard, falling back to the static bundle) → static bundle.
- **Broken install** (L142-148): without `clientBundleDir`, every request answers 503 "not installed" and nothing else is wired. Matches SPEC ("A broken install says so").
- **Token guard** (L316-336): `?token=` → Set-Cookie (`HttpOnly; SameSite=Lax; Path=/`) + 302 to the clean path; cookie → admitted; else 401. Constant-time compare with a length pre-check (length leak accepted, standard).
- **Browser-borne guards on loopback**: relay and browser proxy re-apply `isSameOriginRequest` + `isExpectedHost` (`guardBrowserOrigin`), because both change state and the token guard is a no-op on loopback. A genuine daemon-to-daemon relay call sends no Origin and a loopback Host, so it passes.
- **Bridge authenticates itself**: bridge + web-start dispatch *before* the token guard and carry their own bearer token (`bridgeToken`); when no token configured, `bridgeHandlers`/`webStartHandlers` are undefined and the handlers answer 404 — the SPEC's "do not exist at all".
- **Shutdown** (L267-272, L287-291): `quota.stop()` then `closeAllConnections()` + `close()`, so streaming relay bodies do not hang the close.

Edge cases checked:

- **Unhandled rejections from void-dispatched handlers**: `handleBridgeRequest`, `handleWebStartRequest`, `handleRelayRequest`, and `rpcMount` are `void`-dispatched with no `.catch`. I verified the handlers catch internally: bridge routes wrap `readJsonBody` in try/catch, `handleAgents` does `handlers.sessions().catch(() => [])`, web-start validates before calling synchronous store methods, relay handlers carry their own try/catch blocks. The daemon's safety therefore *relies on those modules never rejecting*; only the browser proxy gets a `.catch(() => res.destroy())`. A future async handler that forgets its catch becomes a process-killing unhandled rejection. Reliance noted, no current bug.
- **Browser-proxy fallback**: `.then(handled => { if (!handled) void serveClientBundle(...) })` — the inner promise is voided, so the outer `.catch` does NOT cover `serveClientBundle`. Safe today only because `serveClientBundle` is written to never reject (all its awaits are caught; see static.ts analysis).
- **Broken-install branch never calls `quota.stop()`** on close. Not a bug: `daemon.ts` L268-270 explicitly stops the quota poller itself for exactly this case ("a broken install serves 503s without ever taking ownership of the source we handed in").
- **Re-parse in `authorizeDaemonRequest`** (L318): safe — the handler already proved `req.url` parses (pathname guard at L218).
- **Redirect target** (L326): rebuilt from `url.pathname` + remaining query; the token is deleted from `searchParams` (all occurrences). Fragments never reach the server. Cookie value is the raw token (base64url in practice) — no `;`/`=` hazards for the values the registry generates; a token containing `;` would corrupt the cookie header, but the token source is framework-generated.
- **Cookie without `Secure`/`Max-Age`**: session cookie over plain http — deliberate for a LAN daemon; SPEC discusses SameSite choice explicitly.
- **`listenDashboard`**: rejects on pre-listen `error`, removes the listener after success. Later server 'error' events are not expected from node:http post-listen.
- **Prefix overlap**: `BRIDGE_PREFIX='/_bridge'`, `WEB_START_PREFIX='/_web-start'` — no overlap, so the dispatch order cannot shadow a route.

## Functions (low-level)

- **`startDashboard(opts)`** — wires everything above. Broken-install early return loses nothing that daemon.ts does not compensate for. `relayHandlers` built only when `opts.relay` given; `rpc` spread conditionally. `bridgeHandlers`/`webStartHandlers` built only when `bridgeToken` set; both share `bridgeStarts()` and `bridgeQuestions()` singletons so the extension's claim and the run's poll meet in one store. The `start` handler claims inside `claimNext()` (comment: two polling tabs must not both get the request) — correct, the claim mutation is atomic within the synchronous call. Verdict: correct.
- **`listenDashboard(server, host, port, close)`** — resolves `{url, close}`; URL uses the *bound* host string, not `address.address` — for host `0.0.0.0` the reported URL is `http://0.0.0.0:port`, which is what the daemon prints; cosmetic. Verdict: correct.
- **`closeServer(server)`** — `closeAllConnections()` before `close()`; resolves when closed. Idempotence of `Dashboard.close` holds because a second `server.close()` calls back with an error argument that is ignored. Verdict: correct.
- **`guardBrowserOrigin(req, res, host)`** — same-origin AND expected-host, else 403. On a non-loopback bind `isExpectedHost` returns true by design (token guards instead). Verdict: correct.
- **`authorizeDaemonRequest(req, res, token)`** — described above. A POST carrying `?token=` also gets the 302 (meant for human GET navigation) — harmless in practice since programmatic callers use the cookie. Verdict: correct.
- **`tokensMatch(a, b)`** — length check then `timingSafeEqual`. Verdict: correct.
- **`readCookie(header, name)`** — splits on `;`, trims name and value, first match wins. Does not handle quoted values — never produced by our own Set-Cookie. Verdict: correct.

## Bugs found

None found. (One robustness reliance recorded above: every void-dispatched route handler must keep catching its own rejections; the browser proxy is the only one guarded here.)
