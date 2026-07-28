The dashboard HTTP server: a tiny `node:http` host that serves the prerendered Vike SPA, mounts the Telefunc surface at `/_telefunc`, and routes the browser proxy, device relay, and browser bridge — all fronted by the #1051 token guard on non-loopback binds.

## TLDR

- `startDashboard(opts)`: binds 127.0.0.1:4200 by default; `DashboardOptions` is the seam every host wires differently — daemon (full set: onStart, registry projects, preview, quota poller, relay, bridge, remote), per-run foreground dashboard (single-project provider, no start), public relay (empty provider, events source only).
- Routing order per request: bridge (`/_bridge/*`, own bearer token, checked BEFORE the guard) → #1051 guard → relay (`/_relay/*`) → `/_telefunc` → browser proxy (`/browser/*`, falls through to bundle when unhandled) → static SPA bundle.
- No `clientBundleDir` (broken install) = a 503-everything server rather than a half-wired mount.
- `authorizeDaemonRequest` (#1051): a valid `?token=` sets the `fw_daemon` cookie (HttpOnly, SameSite=Lax) and 302s to the clean path; thereafter the cookie rides everything same-origin; else 401. Constant-time compares.

## Problems

- A bearer header cannot reach the events Channel or the MJPEG `<img>` screencast; a cookie rides all of them — hence cookie-based auth with a one-hop `?token=` bootstrap that leaves the URL bar, history, and Referer.
- SameSite=Lax, not Strict: the #1052 device-hop is a cross-origin top-level nav, and a Strict cookie set on it is withheld from the immediately following redirect, 401ing the clean path. Lax still rides top-level GET navs; CSRF stays covered by the same-origin check on `/_telefunc`.
- Proxy/handler rejections must never become unhandled rejections that kill the daemon (#938): browser-proxy dispatch catches and destroys the socket.
- `closeServer` calls `closeAllConnections()` first: keep-alive and streaming sockets (an open `/_relay/events` body) would otherwise keep `close()` waiting forever.

## Decisions

- The bridge skips the #1051 guard deliberately: that guard's affordance is a `?token=` 302 for a human following a link, meaningless to an extension posting JSON; the bridge presents its own bearer token (`bridgeToken` is deliberately not `token` — a loopback daemon has no #1051 guard at all, and the bridge is the one route meant to be cross-origin).
- Relay handlers are wired only when the daemon supplies both `onStart` and `relay`; bridge handlers only when `bridgeToken` is set (off = every `/_bridge/*` 404s).
- The quota source is created here and stopped with the server — it polls for the dashboard's whole life (#533) and nothing else would end it.
- `preview` is one `PreviewHandlers` field, not four callbacks: the four were once re-declared without `runId`, and per-session Preview (#797) worked only because each function was passed by reference — one wrapper would have dropped `runId` silently.
- `preferences`/`discord` default to the real registry stores; the relay serves its own mount and never wires them.

## Facts

- The guard admits daemon-to-daemon relay calls via the same cookie without the browser 302 (remote-run.ts sends `Cookie: fw_daemon=<token>`, no Origin).
- Bridge handler wiring binds the module-singleton `bridgeQuestions()` store (record/contact/events/hello/answer/answered).
- Telefunc runs in-process: `sendStart`/`sendAddProject` call the daemon's own closures through the request context; the server itself is a static-bundle + RPC host with no in-process event stream (the SPA reads `.the-framework/events.jsonl` over the Channel, steers via `control.jsonl`).
