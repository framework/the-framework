# Bug analysis: packages/framework/src/dashboard/rpc-serve.test.ts

## Business logic (high-level)

Pins the RPC transport itself (F3, ex-Telefunc) over a real `node:http` server on an ephemeral
loopback port, with real `fetch` calls — no mocked request objects — so the dispatch it asserts is
the dispatch the daemon runs. The header guards are deliberately left to `server.test.ts` (stated
at L10-12), which is why `mounted()` passes no `opts.host`: `isExpectedHost` is a no-op without a
bound host, and `fetch` sends no `Origin` on a same-process request, so both guards pass and the
tests exercise dispatch alone. Consistent with the test SPEC.

What the tests pin, against `rpc-serve.SPEC.md`:

- the registry is derived from module exports, not hand-listed (#866) — asserted by name for a
  representative sample across all five RPC modules;
- a call reaches its handler and the handler's own answer travels back as `{ ret }`;
- an unknown name is a 404 that names it;
- inherited `Object.prototype` members are not RPCs — the null-prototype table in
  `dashboard-rpc/index.ts` is what makes this pass, and this is the only test covering it;
- a throwing handler is a 500 carrying the message *and the server keeps serving* (the follow-up
  call at L118 is what makes this test about survival rather than just the status code);
- a path outside the prefix is declined;
- the stream ends cleanly with nothing to stream, and delivers one frame per event from an
  in-memory source (the relayed-agent branch, #1067).

Verification quality: every assertion is on a value the handler actually produced, every await is
present, and each test closes its server in `finally`. The `sendStart` argument order in the test
(`['p1', 'do a thing', 'build']`) matches `control.ts` L179-183 `(projectId, prompt, kind)`, so the
"reaches its handler" test really traverses the argument spread rather than accidentally passing.

Coverage gaps (not defects, but they explain what the source analysis found unpinned): no test
disconnects mid-stream, so `serveEventStream`'s teardown path — including the abort-during-setup
leak (bug 2 of the source analysis) — is unexercised; no test sends a malformed `Host`, so the
unhandled-rejection crash (bug 1 there) is unpinned; the body-size cap and the non-array-body 400
have no test either.

Test-environment note, not reported as a bug: the module-level `context` builds the *real*
`defaultQuotaSource()` at import time, which calls `poller.start()` and shells out to the Claude
driver in the background during the run. It does not hang the suite (the poller's timer is
unref'd, `quota-poller.ts` L142-150) and nothing here reads quota, but it is a live side effect
attached to a transport test; a stub `QuotaSource` would cost nothing.

## Functions (low-level)

- **`context`** (L14) — a full `DashboardContext`; every field is present, which is required since
  `context.ts`'s `fromContext` throws on an unwired one. The `startAgent`/`addProject` stubs answer
  `{ ok: false, error: 'not wired in this test' }`, and that exact string is what L71 asserts came
  back — so the assertion proves the round trip rather than matching a constant the mount could
  have invented. Correct.
- **`mounted(over)`** (L28) — builds a mount over `{ ...context, ...over }`, serves it from a real
  server on port 0, falls back to a bare 404 when the mount declines, and returns the URL plus a
  promise-wrapped `close`. `void mount(...).then(...)` has no `.catch`, mirroring `server.ts` —
  which means a mount rejection would surface here as an unhandled rejection too; harmless in the
  tests as written (no test sends a bad `Host`). Note `makeRpcMount` sets the *module-global*
  context, so a second concurrently-live mount would win; node:test runs a file's top-level tests
  sequentially and each one closes before the next, so this holds. Correct.
- **`call(url, name, args)`** (L47) — POSTs a JSON array and returns status + raw text (raw, so the
  404/500 tests can regex the message). Correct.
- **`'every RPC the modules export is dispatchable by its own name'`** (L56) — `typeof
  RPC_HANDLERS[name] === 'function'` for six names spanning reads/control/preferences/quota/devices.
  A sample rather than an exhaustive check, but it is a real assertion on the derived table and
  fails if a module stops exporting one. Correct.
- **`'a call reaches its handler and comes back as JSON'`** (L65) — deep-equals the full envelope,
  so both the `{ ret }` shape and the handler's answer are pinned. Note it traverses the real
  `sendStart`, which resolves `ticketForStart` against the global registry provider; `'p1'`
  resolves to nothing there, so the path is stable. Correct.
- **`'an unknown RPC is a 404 naming it'`** (L77) — status plus message. Correct.
- **`'an inherited Object member is not an RPC'`** (L88) — five names, each asserted 404 with the
  name in the message; the `name.replace(/\W/g, '.')` keeps `__proto__` a valid regex. The
  per-name message in the status assert makes a failure diagnosable. This is the security test of
  the file and it does its job. Correct.
- **`'an RPC that throws answers 500 and the daemon stays up'`** (L105) — overrides `startAgent` to
  throw *synchronously*; the mount's `await handler(...)` turns it into a rejection either way, so
  the test does cover the unhandled-rejection regression it names. The follow-up 404 proves the
  server survived. Correct.
- **`'a request outside the RPC prefix is declined, so the static handler gets it'`** (L124) —
  **asserts the wrong thing**: see bug 1.
- **`'the event stream ends cleanly when there is nothing to stream'`** (L134) — asserts 200, the
  SSE content-type, and an *empty* body. Strong: an errored close would reject `res.text()` and a
  hang would time the test out. Correct.
- **`'the event stream sends one SSE frame per event'`** (L149) — an in-memory generator source;
  splitting on `\n\n` and stripping `data: ` pins the framing, and `deepEqual` on the message list
  pins order and count. It also implicitly proves the response ends when the source drains, since
  `res.text()` only resolves then. Correct.

## Bugs found

1. `L124-132` (`'a request outside the RPC prefix is declined, so the static handler gets it'`):
   the test cannot detect the regression it names. It asserts only `res.status === 404`, but the
   mount's *own* answer for a path it wrongly claimed is also a 404 (`sendJson(res, 404, { error:
   'no such RPC: ...' })`, `rpc-serve.ts` L231) — so if the prefix check broke and the mount
   started swallowing `/assets/app.js`, the static bundle would never be reached in production and
   this test would still pass. The comment on L128 ("i.e. the mount said 'not mine'") states an
   inference the assertion does not support. Severity: minor (test-only). Fix: assert the fallback
   answered rather than the status alone — `assert.equal(await res.text(), '')`, or have the test
   server's fallback write a marker body and assert on it.
