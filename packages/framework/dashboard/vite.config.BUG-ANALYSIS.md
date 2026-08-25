# Bug analysis: packages/framework/dashboard/vite.config.ts

## Business logic (high-level)

Two responsibilities: (1) the plain SPA build config — root pinned to this directory, React +
Tailwind plugins, output straight into `../dist/dashboard-bundle` where the daemon serves it
(`emptyOutDir` safe because the path is inside the package's own dist); (2) the opt-in
`framework:dev-daemon` plugin (`FRAMEWORK_DEV_DAEMON=1`): boot the real daemon *in-process* on an
ephemeral port and proxy `/_rpc` (calls and the SSE stream) to it, so `pnpm dev:daemon` can start
runs.

Plugin flow, checked:
- The middleware is registered synchronously (before the async daemon boot resolves) so it sits
  ahead of Vite's own handlers; a request arriving early parks on `ready` and forwards once the
  daemon is up, or falls through to `next()` (a 404, per the comment) if the boot failed. The
  `ready` promise has a `.catch` that logs and leaves `target` null — no unhandled rejection, and
  the failure mode ("reads still work, starting a run stays disabled") is stated. Correct.
- Daemon boot: imports the *built* `../dist/daemon.js` by URL (this runs in the config's Node
  process, outside the transform pipeline — the reason is documented); `runDaemon(cwd, {port: 0,
  onListening})` resolves the promise with the bound URL; a daemon that exits before binding
  rejects. `runDaemon` itself blocks until shutdown so it is deliberately left running; Ctrl-C on
  the dev server takes it down (in-process, foreground-only per MEMORY.md). Correct.
- Note: if `dist/daemon.js` is stale or absent (`pnpm build` never run), the import rejects and
  the catch reports it — acceptable for a dev-only opt-in.
- Forwarding: `http.request` with the original method/path/headers; the Host header is left as
  the browser sent it so the daemon's same-origin guard passes (documented); `req.pipe(proxyReq)`
  carries POST bodies; `proxyRes.pipe(res)` carries the SSE stream. `proxyReq.on('error')`
  answers 502 when headers are not yet sent. Mostly correct — but see bug 1 for the missing
  client-disconnect teardown.
- `target.port || '4200'` — `new URL('http://127.0.0.1:4200').port` is `'4200'`; the fallback
  only matters for a URL on a default port (80/443), which the daemon never binds. Harmless.

## Functions (low-level)

- `frameworkDevDaemon()` — described above. Verdict: one leak (bug 1), otherwise correct.
- `forward(dest)` — per-request proxy. On upstream error after headers were sent (mid-SSE) it
  does nothing — the client sees its stream die and the dashboard's #948 retry handles it; fine.
  Verdict: see bug 1.
- default export — build/serve config; `root`/`outDir` computed via `fileURLToPath(new URL(...))`
  so cwd never matters (the scripts run one level up, per the comment). Port 4300 for the dev
  server avoids the daemon's 4200. Verdict: correct.

## Bugs found

1. `L60-77` (`forward`): the proxy never tears down the upstream request when the browser goes
   away. Scenario: `pnpm dev:daemon`, open the dashboard, then close the tab (or navigate) — the
   SSE response `res` closes, but nothing calls `proxyReq.destroy()`/aborts the upstream
   connection, so the in-process daemon keeps that events subscription (its JSONL tail/watcher)
   alive until the next write into a dead socket happens to error server-side, which for a quiet
   agent can be indefinitely; repeated open/close accumulates live subscriptions in a long dev
   session. It contradicts the plugin's own framing (the dev server should behave like the
   daemon's real static serving, where a closed SSE socket ends the channel). Severity: minor
   (dev-only tool, bounded by the dev session). Confidence: low-medium (Node may propagate an
   error through the pipe on the next SSE write, in which case the daemon-side close arrives at
   the first heartbeat instead of never — the leak window is then "until the next event", still a
   dangling subscription per closed tab in the quiet case). Fix sketch: in `forward`, add
   `res.on('close', () => proxyReq.destroy())` (and `proxyRes?.destroy()`), mirroring what a real
   reverse proxy does.
