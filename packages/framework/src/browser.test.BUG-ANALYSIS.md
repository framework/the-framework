# Bug analysis: packages/framework/src/browser.test.ts

## Business logic (high-level)

Tests for launching the agent's Chrome and wiring the MCP tool server to it, matching
`browser.test.SPEC.md`: launch args (debug port, throwaway profile, headless default / headful
option), Chrome discovery (override wins; a nonexistent override falls through to a real install;
`PATH` fallback; nothing installed → `undefined`), the debug-endpoint poll (answers → `true`;
never answers → `false` within the budget), a launch that never opens its port → `undefined`, and
the MCP wiring (`--browserUrl` present exactly when a shared browser exists; `withBrowser` folds it
in only when the flag is set).

The central testing idea is sound and explicitly reasoned: filesystem existence is injected
(`fsWith(...present)`) so discovery assertions mean the same thing on a laptop and on CI runners
that really have Chrome at the well-known paths, and there is a deliberate comment explaining why
no Windows PATH-lookup test exists (`join`/`delimiter` follow the host). The endpoint tests use a
real HTTP server on an ephemeral port and a `freePort()` port for the negative case; the
`launchSharedBrowser` negative test spawns a guaranteed-nonexistent binary path and bounds the poll
at 400ms — this doubles as a regression test for the `error`-handler-missing crash (an unhandled
spawn `error` would fail the test process).

Coverage gaps (recorded as notes; the corresponding source defect is filed against `browser.ts`):
no test observes `close()` — neither that Chrome is killed nor that the profile dir is removed
(would need a real Chrome or a process seam), so the kill-vs-rm race leaking profile dirs is
invisible here. The positive `launchSharedBrowser` path (Chrome answers, handle returned) is also
untested for the same reason; `waitForDebugEndpoint`'s success test stands in for it.

## Functions (low-level)

- **`fsWith(...present)`**: returns an `ExistsFn` true only for the listed paths. Exact-match
  semantics fit how `resolveChromePath`/`onPath` probe. Correct.
- **launch args tests (L9-19)**: assert the debug port, the profile dir, `--headless=new`
  presence/absence, and `about:blank` last. Pin exactly the flags the feature depends on. Correct.
- **override tests (L28-41)**: both env variables accepted; a nonexistent override with an empty
  `PATH` resolves `undefined`, and with `/usr/bin/chromium` present resolves that — the assertion
  message states the intent ("a bad override must not hide a browser that is actually installed").
  Correct.
- **PATH test (L43-45)**: `/opt/bin` + existing `/opt/bin/chromium` → found. Uses the host's
  `join`, safe on POSIX CI. Correct.
- **`freePort` test (L50-53)**: only range-checks the port — weak, but any stronger claim
  ("nothing is listening") would be the TOCTOU race itself; acceptable. Correct.
- **endpoint answers (L55-68)**: real server returning 200 JSON; asserts `true`; server closed in
  `finally`. Correct.
- **endpoint never answers (L70-73)**: polls a just-freed port, 250ms budget — relies on the freed
  port staying unbound for 250ms, which is near-certain; asserts `false`. Correct.
- **nothing installed (L75-77)**: empty fs + `PATH=/usr/bin` → `undefined`. Correct.
- **launch gives up (L79-84)**: nonexistent binary + 400ms budget → `undefined`. Also exercises
  the `error`-event self-close path (the temp profile it creates is removed by `close()`).
  Correct.
- **MCP wiring tests (L86-105)**: `--browserUrl` + URL present when pointed at our Chrome; absent
  (and deep-equal to `BROWSER_MCP_SERVERS`) without one; `withBrowser` folds the URL through with
  the flag and is a deep-equal no-op without it. All assert observable specs. Correct.

## Bugs found

None found. (The untested `close()` teardown is where `browser.ts`'s profile-deletion race hides;
filed against `packages/framework/src/browser.ts`.)
