The daemon's one HTTP server on its port. It serves the built dashboard, mounts the dashboard's RPC surface with its live event stream [1], and hosts three more surfaces: the relay [2] endpoints another device [3] calls, the Claude web bridge [4] together with the web-start endpoints, and the proxy to an agent's [5] browser preview. On a non-loopback bind every route sits behind a shared token; on a loopback bind the same-origin and Host checks keep a web page the user merely visited from starting or steering an agent.

## Context

**User story**: the user runs `the-framework` and opens the printed URL. With `--host` set to a non-loopback address, the printed URL carries a token: a browser that follows it once is let in for good, and any request without the token gets 401.

**Problem**: the daemon spawns processes, so anything that can call it can start an agent [5] on the user's machine. On a loopback bind the only caller to fear is a browser, and a browser always says which origin and which host name it is calling for. On a network bind the caller can be anyone who finds the port, so a secret is required.

## Glossary

[1] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[2] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[9] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **A broken install answers 503 everywhere** - without a built dashboard, every request gets 503 "the dashboard bundle is not installed" and nothing else is mounted.
- **One route order for every request** - an unparseable request target is 400; the bridge and the web-start routes come first; then the shared-token guard; then the relay, the RPC mount, the browser preview proxy, and finally the built dashboard.
- **The shared token on a non-loopback bind** - a valid `?token=` sets the `fw_daemon` cookie and redirects to the clean URL, a valid cookie is admitted, anything else is 401, the comparison is constant-time, and with no token configured the guard does not exist.
- **The same-origin and Host guards on a loopback bind** - the relay and the browser preview proxy refuse a cross-origin or rebound-Host request with 403, exactly as the RPC mount does, because on loopback nothing else guards them.
- **The bridge and the web-start routes carry their own token** - both are 404 unless a bridge token is configured, both authenticate with it as a bearer token, and both are reached before the shared-token guard.
- **The relay endpoints, when the daemon wires them** - present only when the daemon supplies an events tail, starting agents through the daemon's own start closure.
- **The browser preview proxy** - an agent's Chrome reaches the dashboard same-origin through the daemon, an unrecognized path falls back to the dashboard shell, and a proxy failure tears the socket down instead of taking the daemon down.
- **Binding, the URL, and closing** - port 4200 and host 127.0.0.1 by default, a taken port fails the start, and closing stops the quota [7] polling and force-closes every open connection.

## Business logic

### A broken install answers 503 everywhere

#### Context

**Problem**: the published package always ships the built dashboard, so a missing bundle means a broken install. Standing up a half-wired server would hide that.

#### Business logic

When no bundle directory is supplied, the server answers every request with 503 and the text "the dashboard bundle is not installed". No RPC surface, relay, bridge or proxy is mounted.

### One route order for every request

#### Context

See `## Context`.

#### Business logic

Every request is dispatched in this order:

- A request whose target cannot be parsed as a path, such as a proxy-style absolute target, is answered 400 "bad request". The daemon stays up.
- A path at or under `/_bridge` goes to the bridge [4]; a path at or under `/_web-start` goes to the web-start endpoints (`web-start-endpoints.ts`). Both are dispatched before the shared-token guard below.
- When a shared token is configured, the request must pass the shared-token guard (next section).
- A path at or under `/_relay` must pass the browser-origin guard, then goes to the relay [2] endpoints (`relay-endpoints.ts`).
- A path at or under `/_rpc` goes to the RPC mount, which applies its own same-origin and Host guards (`rpc-serve.ts`).
- A path under `/browser/` must pass the browser-origin guard, then goes to the browser preview proxy (`browser-proxy.ts`); a path the proxy does not recognize is served as the built dashboard instead.
- Everything else is served from the built dashboard: the file when it exists, else the app shell (`static.ts`).

The RPC surface acts through what the daemon wires into it, all of it required: the daemon's own start and add-project closures, the events source and the lookup for agents [5] relayed from a device [3], the preferences [6] store, the Discord credentials store, the quota [7] source, what Auto PM [8] last decided and a way to run it now, each project's current errors, and the daemon's own bridge browser. The mount is also told the bound host, so it can reject a rebound `Host`.

### The shared token on a non-loopback bind

#### Context

**User story**: the user starts the daemon with `--host` set to an address on the network and opens the printed URL from a browser on another machine; the token in that URL is the only thing that lets the browser in.

**Problem**: a bearer header cannot ride an image tag, an event stream or a redirect, but a cookie rides every same-origin request. So the token becomes a cookie after one hop, and the hop scrubs it from the URL.

#### Business logic

The guard exists only when the daemon configures a token, which it does for a non-loopback bind (`../daemon.ts`); on a loopback bind there is no token and local behavior is byte-identical to a daemon without the guard. With a token configured, every request past the bridge and web-start routes goes through it:

- A request carrying `?token=` equal to the shared token is answered with a 302 to the same path, with the `token` parameter removed and the rest of the query kept. The response sets the cookie `fw_daemon=<token>` marked `HttpOnly`, `SameSite=Lax` and `Path=/`, so the token leaves the URL bar, the history and the Referer after one hop, and the cookie then rides the RPC calls, the live event stream [1] and the browser preview images alike.
- A request carrying a `fw_daemon` cookie equal to the shared token is admitted.
- Any other request is answered 401 "unauthorized".

The comparison is constant-time, and a value of a different length never matches. The cookie is `Lax` rather than `Strict` on purpose: opening this dashboard from another daemon's dashboard is a cross-origin top-level navigation, and a `Strict` cookie set on it would be withheld from the redirect that follows, so the clean URL would 401. Cross-site request forgery stays covered by the same-origin check on `/_rpc`.

### The same-origin and Host guards on a loopback bind

#### Context

**Problem**: on a loopback bind the shared-token guard does not exist, and the relay start and the browser preview input both change state: one spawns an agent [5], the other steers an agent's Chrome. Without a guard, a page the user merely visited could reach them.

#### Business logic

Before the relay [2] endpoints and the browser preview proxy, a request is admitted only when both of the RPC mount's rules hold (`rpc-serve.ts`): its `Origin` is absent, names this server, or names a loopback host; and, when the daemon is bound to a loopback address, its `Host` names a loopback host or the bound address. Any other request is answered 403 "forbidden". The real device [3] caller sends no `Origin` and a loopback `Host`, so it passes; only a browser's cross-origin or rebound request is turned away.

### The bridge and the web-start routes carry their own token

#### Context

**User story**: the user turns the bridge on in Settings, and the Chrome extension on claude.ai reports the question a cloud session [9] is parked on; a web agent's process asks the daemon to have the extension create its cloud session.

**Problem**: the bridge is the one route meant to be reached from another origin, so neither the same-origin check nor the shared-token guard can protect it. The shared-token guard's browser affordance, a redirect on `?token=`, is meaningless to an extension posting JSON; letting these routes past it costs nothing and skips a redirect they could not follow.

#### Business logic

Both surfaces exist only when the daemon configures a bridge token; without one, every `/_bridge/*` and `/_web-start/*` route is 404. Each authenticates the caller with that token presented as a bearer token. The bridge [4] is wired so that:

- a stale extension is refused loudly by its version rather than half-working;
- the questions, statuses, events and greetings the extension reports are recorded in the bridge store (`bridge-store.ts`);
- an answer waiting for a cloud session is claimed when it is read, so two Driver tabs asking never both type it;
- the next cloud session to create is claimed inside the start queue, so two polling tabs handed the same request never create two cloud sessions (`bridge-starts.ts`);
- the daemon may supply the list of cloud sessions the bridge should keep a tab open for.

The web-start routes are wired with the same token, with whether an extension has spoken recently, and with the start queue's request and read.

### The relay endpoints, when the daemon wires them

#### Context

**User story**: the user picks a saved device [3] in the launcher; the agent [5] runs on that machine and still renders in this dashboard.

#### Business logic

The relay [2] endpoints are mounted only when the daemon supplies a way to tail an agent's events. They start an agent through the daemon's own start closure and, when the daemon also supplies it, run one whitelisted agent-scoped call against this daemon's own checkout. The rules of each endpoint are in `relay-endpoints.ts`.

### The browser preview proxy

#### Context

**User story**: the user starts an agent [5] with a browser and watches the agent's Chrome in the agent view, clicking and typing into it.

**Problem**: the preview is an endless image stream and a raw input POST, neither of which is an RPC call, and the agent's Chrome listens on a port the dashboard's origin cannot reach directly.

#### Business logic

A request under `/browser/` is handed to the proxy after the browser-origin guard. When the proxy does not recognize the path, the request is served as the built dashboard. Whatever the proxy throws destroys the socket rather than becoming an unhandled failure that ends the daemon.

### Binding, the URL, and closing

#### Context

See `## Context`.

#### Business logic

The server binds port 4200 and host 127.0.0.1 unless told otherwise; port 0 asks for an ephemeral port. The dashboard's URL is `http://<host>:<port>`. A port already in use fails the start with the bind error. Closing is idempotent: it stops the quota [7] polling, which outlives every agent by design so nothing else would end it, force-closes every open connection including streaming bodies such as an open relay events response, and then closes the server.
