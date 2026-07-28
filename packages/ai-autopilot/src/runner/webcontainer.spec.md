`WebContainerRunner` — browser-only adapter over StackBlitz's `@webcontainer/api`: agent-authored code runs in an in-browser Node runtime with an instant preview URL, nothing touching the host.

## TLDR

- `webContainerAvailable()`: true only when `globalThis.crossOriginIsolated === true` (WebContainer needs `SharedArrayBuffer`, which needs COOP/COEP); always false in plain Node — the analog of `dockerAvailable`.
- `@webcontainer/api` is an optional peer dep imported lazily (dynamic `import` inside `boot()`), so loading the package in Node never pulls the browser dep; the bundler of the hosting app must provide it.
- Only one WebContainer exists per page: a module-level `live` session is tracked, a second `boot()` while one is live throws a clear `RunnerError` (instead of the api crash), and `dispose()`/boot-failure free the slot.
- `WebContainerFs` wraps `wc.fs` with `safeSegments` guarding; recursive sorted `list` (missing dir → `[]`); `exists` tries `readdir` (directory) then `readFile` (file).
- `exec`/`start` spawn `jsh -c <command>` — mirroring `sh -c` on the other runners; `collect()` drains the output stream, enforces `timeoutMs` by killing → exit 124.
- `preview()` never probes TCP: it resolves from the container's `server-ready`/`port` events (a `ports` map + `lastReady`), polling every 100ms until the `waitMs` deadline; no port argument means "the most recently readied server".
- Options: `coep` (default `require-corp`; must match the header the hosting page is served with), cosmetic `workdirName`, `preview` toggle. Session id = last segment of `wc.workdir`.

## Problems

- The page cannot TCP-probe the sandbox, so preview readiness comes from WebContainer's `server-ready`/`port` events rather than a connect loop; closed ports are evicted from the map on `port`/`close`.
- The one-instance-per-page limit is a WebContainer constraint; the runner turns it into a deterministic error + slot bookkeeping.

## Facts

- Output shape differs from Local/Docker: the process output stream is a pseudoterminal that merges stdout and stderr, so everything lands in `stdout` and `stderr` stays `''` (except the timeout note) — a WebContainer trait, not a bug.
- Real boot-and-serve is proven end-to-end by the headless-Chromium harness under `harness/webcontainer/`; `src/runner/webcontainer.test.ts` only covers the Node-side guards.
