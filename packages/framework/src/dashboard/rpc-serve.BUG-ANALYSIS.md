# Bug analysis: packages/framework/src/dashboard/rpc-serve.ts

## Business logic (high-level)

The daemon's whole dashboard request surface: `POST /_rpc/<name>` for every action the browser
takes and `GET /_rpc/events` for the live feed, plus the two guards that keep a page the user
merely visited from reaching either. `makeRpcMount` wires the process-wide `DashboardContext`
once (`setDashboardContext`) and returns a `(req, res) => Promise<boolean>` that answers `false`
for anything outside `/_rpc`, so `server.ts` can fall through to the static bundle.

Invariants the SPEC states, and how the code stands against each:

- **One surface, one host.** `DashboardContext` has no optional fields (D3); `context.ts`'s
  `fromContext` throws by name when something is unwired, so a missing capability is a 500 on
  that one call rather than a silently degraded answer. Held.
- **Cross-origin calls are refused.** `isSameOriginRequest` is applied to *every* method under the
  prefix, GET events included — correct, since the stream is also a capability leak. Absent
  `Origin` passes deliberately (non-browser caller, no ambient session); a malformed `Origin` is
  rejected. Note the deliberate widening: *any* loopback origin passes, so another localhost app's
  page can call the RPCs. That is the stated design (the loopback allowance is in the SPEC's
  "nor a loopback address"), not a defect.
- **Rebound names are refused.** `isExpectedHost` only engages for a loopback bind, exactly as the
  SPEC describes, and rejects an absent `Host` while enforcing. `hostnameFromHostHeader` keeps the
  bracketed IPv6 form, and `isLoopbackHost` matches `127.0.0.0/8` as an *address* (so `127.evil.com`
  — the rebound name this guard exists for — does not slip through). Held.
- **A clean end is not a lost connection.** `serveEventStream` writes the SSE head immediately, so
  even "nothing to stream" is a 200 that ends — the client's "done", not "lost". Held.
- **A failed call is answered, not fatal.** The dispatch body is inside one try/catch that answers
  500 (or ends an already-headered response). Held *for the dispatch*; the URL parse that precedes
  it is not covered — see bug 1.
- **Bounded input.** `readBody` caps at 4 MiB and throws; probed: the throw destroys the request
  but not the socket, so the outer catch still answers (a 500 rather than a 413 — cosmetic).

Lifecycle/ordering concerns. The context is module-global, set at mount-construction; two
concurrently live mounts would share the last one's context. One daemon, one mount, so this is a
relied-upon assumption rather than a defect (tests build several mounts, but node:test runs a
file's top-level tests sequentially). The event stream is the only long-lived resource here, and
its teardown depends entirely on `req`'s `close`/`error` firing — which is where bug 2 lives.

## Functions (low-level)

- **`isSameOriginRequest(req)`** (L82) — absent `Origin` → true; exact `http(s)://<host>` match →
  true; otherwise parse and accept only a loopback hostname; unparsable → false. `new URL(origin)`
  is guarded, and the opaque origin `"null"` (sandboxed iframe, `data:`) fails to parse and is
  rejected, which is the right answer. Header-injection is not a concern: Node rejects CR/LF in
  header values. **Correct.**
- **`isExpectedHost(req, boundHost)`** (L112) — a no-op unless `boundHost` is loopback; then an
  absent `Host` is rejected and the hostname must be loopback or the bind itself. The
  `hostname === boundHost` arm is unreachable in practice (a loopback `boundHost` already satisfies
  `isLoopbackHost`), harmless. **Correct.**
- **`readBody(req, limit)`** (L124) — accumulates chunks, throws past the cap. Byte-accurate
  (`buf.length` on Buffers), and `Buffer.concat(...).toString('utf8')` decodes multi-byte
  characters split across chunks correctly. Probed the over-limit path end-to-end: the client
  receives the 500, the process survives. **Correct.**
- **`sendJson(res, status, body)`** (L136) — stringifies *before* `writeHead`, so a value that
  cannot be serialized (circular, BigInt) throws with headers unsent and the outer catch can still
  answer 500. Deliberate ordering. **Correct.**
- **`serveEventStream(req, res, url)`** (L151) — heads the SSE response, subscribes via
  `RPC_EVENT_STREAM` (`streamAgentEvents`), writes one `data:` frame per value (JSON.stringify
  never emits a raw newline, so frames cannot be split), ends on source exhaustion, and ends
  cleanly with no subscription when the project is unknown. The `finished` flag covers a source
  that drains before the `await` resolves. Double teardown is safe: both `forwardStream`'s and
  `tailAgentEvents`' stop are idempotent, and a second `res.end()` is a no-op. What it does not
  cover is a client that goes away *during* the await — **bug 2**. Missing `projectId` becomes
  `''`, which resolves to no project and ends cleanly. No heartbeat, so an idle stream can be
  dropped by an intermediary; there is no intermediary on a loopback bind and `x-accel-buffering`
  covers the `--host` proxy case, so not a defect here.
- **`makeRpcMount(context, opts)`** (L204) — sets the context, returns the handler. Path handling:
  the prefix test uses `/_rpc` and `/_rpc/`, so `/_rpcfoo` is correctly declined; the name is the
  raw (un-percent-decoded) remainder, so `%6FnAgents` is a 404 rather than a smuggled `onAgents`;
  a nested path `foo/bar` is a 404. `RPC_HANDLERS` is null-prototype (verified in
  `dashboard-rpc/index.ts` L50), so `constructor`/`toString`/`__proto__` are genuinely absent and
  404, as the test asserts. Non-POST or unknown name → 404 naming it; a non-array body → 400;
  malformed JSON → 500 via the catch (the SPEC's "refused as a bad request" reads as a 400, but
  the call is still refused and the daemon survives — cosmetic, not reported). **Bug found** (the
  URL parse at L210 sits outside the try).

## Bugs found

1. `L210` (`makeRpcMount`'s handler, first statement): the request URL is parsed against
   `http://${req.headers.host}` **outside** the try/catch, and an empty or malformed `Host` header
   makes `new URL` throw — so the handler's promise rejects. `server.ts` L247 dispatches it as
   `void rpcMount(req, res)` with no `.catch` (unlike the browser proxy right below, which has one
   precisely because of #938), so this is an unhandled rejection, which Node's default
   `--unhandled-rejections=throw` turns into a dead daemon; the request also never gets a response.
   Scenario (probed, both halves): Node's HTTP parser accepts `Host:` with an empty value and
   `Host: foo bar`, delivering them as `''` (not nullish, so the `?? 'localhost'` fallback does not
   apply) and `'foo bar'`; `new URL('/_rpc/x', 'http://')` and `new URL('/_rpc/x', 'http://foo bar')`
   both throw `Invalid URL`. So
   `printf 'POST /_rpc/sendStop HTTP/1.1\r\nHost:\r\nContent-Length: 2\r\n\r\n[]' | nc 127.0.0.1 4200`
   from any local process kills the daemon. Contradicts the SPEC's "a failed call is answered, not
   fatal" and the file's own L242-243 comment. Note the mount only ever reads `url.pathname` and
   `url.searchParams`, so the authority is not used for anything. Severity: major (remote-ish DoS
   of the whole daemon). Fix: parse against a fixed base, `new URL(req.url ?? '/', 'http://localhost')`,
   the same thing `request-path.ts` L12 already does; the guards read `req.headers.host` themselves
   and are unaffected.

2. `L162-185` (`serveEventStream`): the `close`/`error` listeners that release the subscription are
   attached only *after* `await RPC_EVENT_STREAM(...)`, so a client that disconnects during that
   window never triggers teardown — Node does not replay an already-emitted `close` to a late
   listener (probed: the late-attached handlers never fire, and `res.write` on the dead response
   just returns `false`, so nothing else notices either). The window is real work, not a
   theoretical tick: `streamAgentEvents` awaits `resolveProjectPath` (a registry file read) and
   then `tailAgentEvents`' first resolve. Scenario: the user switches agents or reloads while a
   feed is opening; the dashboard aborts the in-flight `/_rpc/events` fetch; the tail that resolves
   a moment later is never stopped, leaving an `fs.watch` plus a 1s `setInterval` (`followFile`,
   `POLL_MS`) running for the daemon's whole life, one per aborted open, each re-reading the
   journal and writing into a destroyed socket. Contradicts the SPEC's "when the dashboard
   disconnects or errors, the underlying source is released". Severity: minor (unbounded only in
   aborted-open count). Fix: after the await, `if (req.destroyed) { stop(); return }` before
   registering the listeners — or attach the listeners before the await and have them set a flag
   the post-await code checks.
