Mounts the dashboard's Telefunc surface (#405) on the daemon's HTTP server — RPCs plus the live-event Channel at `/_telefunc` — defining the `DashboardContext` every telefunction reads and the CSRF same-origin guard.

## TLDR

- `makeTelefuncMount(context)`: rejects cross-origin POSTs (403), lazily sets up the singleton `Telefunc` instance (registering the telefunctions from `dashboard-rpc/register.js`), and serves; returns whether the request was Telefunc's.
- `DashboardContext` is the per-host wiring seam: `startRun`, `addProject`, `preview` (#475), `projects` (#427), `eventsSource` (#426/#1067 — in-memory stream else `onEvents` tails the on-disk log), `remote` (#1067 slice 2: relayed-run lookup so run-scoped RPCs forward to the owning device), `preferences`, `quota`, `discord`, `autoPm`/`autoPmSweep` (#1161/#1210, daemon-only since the sweep loop lives in that process).
- `isSameOriginRequest`: absent Origin passes (curl/tests have no ambient session to abuse); matching host or loopback hostnames pass; anything else — including malformed Origins — is rejected, or a page on evil.com could `fetch()` localhost and spawn/steer a run.

## Decisions

- Telefunc shield generation and the naming convention are disabled: no Vite build runs over these functions (so no generated shields), the mount is localhost/same-origin guarded, every write funnels through appendControl or the busy-guarded startRun, and the names are `onX`/`sendX`, not telefunc's query/mutation hint.
- `tf.serve` is wrapped in try/catch: telefunc 0.2.22 throws on a bare `GET /_telefunc` (it passes the request as a body, which `new Request()` rejects for GET), and a browser tab hits that on reconnect — it must not become a daemon-killing unhandled rejection.
