# Bug analysis: packages/framework/src/dashboard/browser-proxy.ts

## Business logic (high-level)

The daemon-side relay for an agent's browser preview (#813): the dashboard pane (same origin as the daemon) posts to `/browser/<projectId>/<agentId>/stream|input`; the daemon resolves the agent's own recorded bridge port (never a caller-named one — the anti-open-relay property the SPEC calls "critical") and pipes the request/response between pane and the agent's loopback bridge.

Invariants verified:

- **Port comes from the agent's meta, only while `running`** — `defaultBrowserPortLookup` resolves the project path from the registry, reads live metas, and returns `browserStreamPort` only for a `running` agent with a matching id. A finished agent's number is refused (the OS may have re-handed it). Any failure in the chain reads as `undefined` → 404, the "ordinary miss" the SPEC wants (the pane polls while an agent starts).
- **Unrecognized shapes fall through** — `parseBrowserRoute` returns `undefined` for anything that is not exactly three segments with a known leg, so the server carries on to the client bundle. The whole parse is wrapped in try/catch because a malformed escape (`%zz`) throws only at `decodeURIComponent` time and this handler is void-dispatched — an escaping throw would kill the daemon (#938). Both halves are pinned by tests.
- **Streaming, not buffering** — `/stream` is endless `multipart/x-mixed-replace`; the response is piped as it arrives. `res.on('close')` destroys the upstream request so the agent never serves a dead viewer (no watcher/socket leak). `upstream.on('error')` answers 502 when headers are not yet sent, else just ends — an agent dying mid-stream cannot crash the daemon or hang the pane.
- **Header pass-through** — `writeHead(status, {...proxied.headers, 'cache-control': 'no-store'})` copies upstream headers (the multipart content-type with its boundary must survive) and forces no-store (live keystrokes must not be cached). Probed: copying `transfer-encoding: chunked` into a Node response that then pipes de-chunked data is safe — Node re-chunks (verified with a live two-server probe), so the copy does not corrupt framing.

Edge/asymmetry noted (not a bug): the client (`BrowserPanel.tsx` L40) encodes both ids with `encodeURIComponent`, but the server decodes only `agentId`, not `projectId`. Registry ids are by construction URL-safe ("sanitized basename plus a short hash", registry.ts), so encoding is a no-op for them and the asymmetry cannot bite; agent ids are timestamps, equally safe, and the decode there is belt-and-braces. Reliance recorded.

Also noted: the input leg forwards only a fixed `content-type: application/json` header and streams the body with `req.pipe(upstream)` — no length header, so Node sends chunked; the agent bridge reads to end, which the tests exercise through real sockets. `IncomingMessage` stays paused until piped, so awaiting the lookup first loses no body bytes.

## Functions (low-level)

- `parseBrowserRoute(url)` — `new URL(url, 'http://localhost')` isolates the pathname (query strings stay out of the leg — tested), prefix check, exact 3-way split, leg whitelist (`stream`/`input`), non-empty ids, `decodeURIComponent` on agentId; try/catch collapses malformed URLs/escapes to `undefined`. Trailing slash yields 4 parts → undefined → falls through. Verdict: correct.
- `defaultBrowserPortLookup(projectId, agentId)` — registry resolve → `readLiveMetas(cwd).catch(() => [])` → id match → `running` gate → port or undefined. Every failure path is a clean `undefined`. Verdict: correct.
- `handleBrowserProxy(req, res, lookup)` — returns `false` (unhandled) only for non-routes; otherwise always answers: 404 on no port (lookup errors coerced via `.catch(() => undefined)`), else proxies. GET `/stream` vs POST `/input` mapping; `upstream.end()` for the GET, `req.pipe(upstream)` for the POST. Double-write protection on error path via `headersSent`. The 502 status also covers a missing upstream `statusCode` (`?? 502`). Verdict: correct.

## Bugs found

None found.
