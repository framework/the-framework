# Bug analysis: packages/framework/src/dashboard/browser-proxy.test.ts

## Business logic (high-level)

Covers the browser-preview relay (#813) exactly as its test SPEC lists: route parsing (project/agent/leg, query string tolerated, junk and wrong legs fall through, malformed escapes swallowed per #938), and the proxy behavior over *real* sockets — a `fakeBridge` HTTP server records hits while a `proxyServer` mounts the real handler, so piping (both directions), status propagation, the 404 no-preview answer and the 502 refused-connection answer are exercised end to end rather than with mocks.

The tests inject the port lookup, which is the designed seam (`BrowserPortLookup`); `defaultBrowserPortLookup` (registry + live-meta read) is consequently untested here — acceptable, it is a thin composition of readers tested elsewhere.

Resource handling is clean: every server is closed in `finally`; `await res.text()` drains the stream response before asserting on recorded hits, so there is no race on `bridge.hits`.

## Functions (low-level)

- 'parseBrowserRoute reads a project, a run, and a leg' — happy path for both legs, with a timestamp-shaped agent id. Correct.
- 'ignores anything that is not a browser route' — `/`, assets, too-few/too-many segments. Correct (falls-through-to-bundle is asserted separately below with the real server).
- 'rejects a leg it does not serve' — `evict` refused. Correct.
- 'keeps a query string out of the leg' — `?t=1` (the pane's cache-buster) still parses as `stream`. Correct.
- 'survives a malformed escape or target instead of throwing (#938)' — `%zz` (throws only at decode time) and `http://[` (throws at parse time) both yield `undefined`. This is the daemon-killing regression pin. Correct.
- `fakeBridge()` — accumulates body then records `{url, body}`; answers a multipart header + one frame for `/stream`, 204 otherwise. Correct as a stand-in.
- `proxyServer(lookup)` — mounts `handleBrowserProxy` void-dispatched, answering 'fell through' on false — mirrors how server.ts dispatches it, so the tests also prove the boolean contract. Correct.
- 'proxies the stream to the run bridge' — status, content-type (boundary-carrying multipart preserved through the header copy), and that the bridge saw `/stream`. Correct.
- 'forwards an input POST body through to the bridge' — 204 propagated and the JSON body arrives intact (pipe direction two). Correct.
- '404s a run with no preview rather than reaching for a port' — lookup → undefined → 404. Correct.
- '502s when the bridge is gone' — closes the bridge and dials its dead port; asserts 502 with a diagnostic message. The long comment documents a measured ~1/1500 flake (the proxy's `listen(0)` being handed the just-freed bridge port, whereupon the proxy dials itself and 404s); the test deliberately orders proxy-listen before bridge-close to avoid it. The residual race (another process grabbing the port and answering) is vanishingly rare and acknowledged. Correct; not a test that cannot fail.
- 'a non-browser url is left for the client bundle' — asserts the fall-through body. Correct.

## Bugs found

None found.
