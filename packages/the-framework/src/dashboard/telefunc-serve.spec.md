Mounts the dashboard's Telefunc surface (#405) on the daemon's HTTP server — RPCs plus the live-event Channel at `/_telefunc` — defining the `DashboardContext` every telefunction reads and the CSRF same-origin guard.

## TLDR

- `makeTelefuncMount(context, opts)`: rejects cross-origin POSTs and rebound `Host`s (403), lazily sets up the singleton `Telefunc` instance (registering the telefunctions from `dashboard-rpc/register.js`), and serves; returns whether the request was Telefunc's. `opts.host` is the address the server is bound to, which enables the `Host` check.
- `DashboardContext` is the per-host wiring seam: `startRun`, `addProject`, `preview` (#475), `projects` (#427), `eventsSource` (#426/#1067 — in-memory stream else `onEvents` tails the on-disk log), `remote` (#1067 slice 2: relayed-run lookup so run-scoped RPCs forward to the owning device), `preferences`, `quota`, `discord`, `autoPm`/`autoPmSweep` (#1161/#1210, daemon-only since the sweep loop lives in that process).
- `isSameOriginRequest`: absent Origin passes (curl/tests have no ambient session to abuse); matching host or loopback hostnames pass; anything else — including malformed Origins — is rejected, or a page on evil.com could `fetch()` localhost and spawn/steer a run.
- `isExpectedHost`: the DNS-rebinding half of the same guard. On a loopback bind, only a loopback `Host` — or the bound address itself — passes; an absent one does not. A non-loopback bind and a host that passes no bind address are not checked.

## Decisions

- The `Origin` check cannot stand alone: under DNS rebinding the browser resolves `evil.com` to `127.0.0.1` and treats the daemon as evil.com's own origin, so the attacker's `fetch()` is same-origin and passes. `Host` still carries the name the browser was asked for, so it is what the second check reads.
- The `Host` check is enforced only for a loopback bind. A `--host` bind (#1051) is reached by a hostname the daemon cannot predict — there is no allowlist to build — and already gates behind the shared token; the relay serves a public domain and passes no bind host at all, so it is unaffected.
- Telefunc shield generation and the naming convention are disabled: no Vite build runs over these functions (so no generated shields), the mount is localhost/same-origin guarded, every write funnels through appendControl or the busy-guarded startRun, and the names are `onX`/`sendX`, not telefunc's query/mutation hint.
- `tf.serve` is wrapped in try/catch: telefunc 0.2.22 throws on a bare `GET /_telefunc` (it passes the request as a body, which `new Request()` rejects for GET), and a browser tab hits that on reconnect — it must not become a daemon-killing unhandled rejection.
