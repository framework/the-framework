# Bug analysis: packages/framework/src/browser.ts

## Business logic (high-level)

The agent's browser (#793, first slice of #609): launch Chrome with `--remote-debugging-port` on a
throwaway profile so both the agent's MCP tool server (`chrome-devtools-mcp --browserUrl ...`) and
the preview screencast can attach to the same pages. Invariants per `browser.SPEC.md`:

- **The Framework launches the browser, not the tool server** — the open debug port is what lets a
  second client watch.
- **Throwaway profile** — a fresh `mkdtemp` dir per agent, "deleted when the agent's browser closes".
- **Headless by default**, headful on request (debugging).
- **Found wherever Chrome lives** — `CHROME_PATH`/`PUPPETEER_EXECUTABLE_PATH` override (only when it
  exists — a bad override falls through), then platform well-known paths, then names on `PATH`.
- **A missing browser costs the preview, never the tools** — every failure path resolves `undefined`
  so the caller leaves `--browser` on the launch-its-own path; a Chrome that dies on its own must not
  fail the agent.
- **Never handed a port that isn't listening** — `/json/version` is polled until it answers; a
  browser that never answers within the timeout is torn down and treated as absent.

Lifecycle: `launchSharedBrowser` → free port → mkdtemp profile → spawn → (`exit`/`error` handlers
that self-close) → poll the endpoint → hand back `{browserUrl, close}`. `close()` is idempotent,
kills the child and removes the profile. The caller (`cli.ts` `settleAgent` finally) awaits
`close()` after closing the preview stream.

Failure/edge analysis: spawn's async `error` event (bad path, no exec bit) is handled — without it
the emitter would throw and take the agent down, exactly what the comment warns about. A Chrome that
exits on its own triggers `close()` via the `exit` handler, so the profile is cleaned even without
the caller. Two accepted races are noted in the code's own design: `freePort`'s classic
close-then-rebind TOCTOU (another process could grab the port before Chrome does; Chrome then fails
to listen and the poll times out → treated as absent — degraded, not wrong), and a crashed-at-birth
Chrome still costs the full default 15s poll before the agent proceeds (bounded stall, not a hang;
noted, not reported). One real flaw: `close()` deletes the profile while Chrome is still dying —
Bugs #1.

## Functions (low-level)

- **`CHROME_PATHS` / `CHROME_BINARIES`**: well-known install paths per platform and `PATH` names.
  Data only. Correct.
- **`onPath(name, env, platform, exists)`**: walks `PATH` split on the host delimiter, tries
  `.exe`/`.cmd`/bare on win32, bare elsewhere. Empty/undefined `PATH` → no dirs → `undefined`.
  Doesn't consult `PATHEXT` — fine for the two fixed extensions Chrome ships as. Correct.
- **`resolveChromePath(env, platform, exists)`**: override (existence-checked) → well-known →
  `PATH`. Unknown platform → `?? []` → PATH scan only. Matches tests, including the
  bad-override-falls-through case. Correct.
- **`chromeLaunchArgs(port, dir, headless)`**: `--headless=new` conditional, debug port, profile
  dir, no-first-run/default-browser-check, window size, `about:blank`. Args passed as an array to
  `spawn`, so spaces in the tmpdir path are safe. Correct.
- **`freePort()`**: OS-assigned ephemeral port on loopback; rejects on server error or a
  non-object address. TOCTOU accepted (see above). Correct.
- **`waitForDebugEndpoint(url, opts)`**: polls `fetch(url + '/json/version')` swallowing network
  errors until `res.ok` or the deadline; 100ms interval. Response bodies are never consumed —
  undici keeps those connections around briefly, but against loopback Chrome this is noise, not a
  leak that accumulates (one success response per launch). `timeoutMs: 0` → loop never entered →
  `false`; only tests pass small values. Correct.
- **`launchSharedBrowser(opts)`**: resolve path (or given), port, profile, spawn with
  `stdio: 'ignore'`; sync-throw path cleans the profile; `exit`/`error` → `close()`; poll; on
  timeout `close()` + `undefined`. `closed` flag makes `close()` idempotent. The
  `timeoutOpt` dance avoids passing `timeoutMs: undefined`. **`close()` does not wait for the
  child to actually exit before `rm`-ing the profile** — Bugs #1. Otherwise correct.
- **`BROWSER_MCP_SERVERS` / `browserMcpServers(url)`**: the `npx -y chrome-devtools-mcp@latest`
  spec, with `--browserUrl` appended only when a shared browser exists; without a URL it returns
  the original constant (aliasing `BROWSER_MCP_SERVERS` — callers only read it; harmless).
  Correct.
- **`withBrowser(base, browser, url)`**: no-op without the flag; otherwise merges
  `browserMcpServers(url)` over `base.mcpServers` (spread of `undefined` is fine). Correct.

## Bugs found

1. **L160-165 (`close` in `launchSharedBrowser`)** — profile deletion races Chrome's shutdown:
   `child.kill()` sends SIGTERM and `rm(userDataDir, {recursive, force})` runs immediately, while
   Chrome spends its last few hundred ms writing profile state (`Local State`, prefs, singleton
   cleanup). Files created after `rm`'s readdir make the final `rmdir` fail `ENOTEMPTY` (`force`
   only suppresses ENOENT; `maxRetries` defaults to 0), the `.catch(() => {})` swallows it, and a
   partially-deleted `framework-chrome-*` dir is leaked in the OS tmpdir — one per agent run on the
   common path (`settleAgent` always calls `close()` on a live Chrome). On Windows the race is
   worse: unlinking files a live process holds open fails outright. Contradicts `browser.SPEC.md`:
   "the profile is deleted when the agent's browser closes". Severity: **minor** (temp-dir litter,
   no data loss). Fix sketch: await the child's `exit` (e.g. `child.kill(); await new Promise(r =>
   (child.exitCode !== null ? r() : child.once('exit', r)))`, capped by a short timeout) before the
   `rm`; the `exit`-handler-initiated close already runs post-mortem and is unaffected.
