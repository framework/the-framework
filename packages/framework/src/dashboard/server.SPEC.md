Stands up the dashboard: the one HTTP server the daemon runs, serving the browser app and routing every other surface behind it — the dashboard's own calls and live event stream, the device relay, the browser preview proxy, and the Claude web bridge — each behind the guard that suits it.

## User story

The user runs the daemon and opens http://127.0.0.1:4200. Everything the product does is behind that one address: the app itself, the calls it makes, the agents' event streams, an agent's Chrome streamed into the page, another machine's daemon relaying an agent here, and the Chrome extension reporting what a cloud session is parked on. When the daemon is exposed beyond this machine, a token is what stands between it and the network.

## Business logic — TL;DR

- **One address, several surfaces** - the browser app is served for every path that is not claimed by the calls surface, the relay, the browser preview, or the bridge. Loopback and port 4200 by default.
- **A broken install says so** - with no built app to serve, every request answers that the dashboard bundle is not installed, rather than half-standing-up.
- **Token guard for a non-loopback bind** - when a token is set, every route needs it; the first visit may carry it in the address, after which it rides a cookie and disappears from the address bar.
- **Browser-borne routes are guarded even on loopback** - the relay and the browser preview apply the same cross-origin and rebound-name checks the calls surface applies, because both change state and the token guard does nothing on a loopback bind.
- **The bridge authenticates itself** - the bridge routes, and the routes a web run uses to ask for an extension-created session, are checked before the token guard and carry their own token; without one configured they do not exist at all.
- **Nothing takes the daemon down** - a failure inside the browser preview tears down that one request instead of crashing the process.
- **Closing means closing** - shutting the server down also stops the quota polling and force-closes streaming connections, so it actually finishes.

## Business logic

### One address, several surfaces

#### User story

The user only ever types one URL. Everything — the app, its calls, live events, a remote agent, an agent's browser — is reachable from it.

#### Business logic

The server binds loopback on port 4200 unless told otherwise, and reports the URL to open. A request is routed to the bridge, then the relay, then the calls surface, then the browser preview; anything else is served from the built browser app, which is also the fallback when the browser preview declines a request. The calls surface is told which address the server is bound to, so it can reject requests arriving under a rebound name.

### A broken install says so

#### User story

An installation that shipped without the built app should tell the user exactly that, instead of appearing to work.

#### Business logic

Without a built app to serve, the server answers every single request with "the dashboard bundle is not installed" and wires nothing else. The published package always includes the app, so this is a broken-install path only.

### Token guard for a non-loopback bind

#### User story

The user exposes their daemon beyond their own machine — for example so another device can reach it. Anyone who reaches that address without the token must get nowhere, and the user who follows a link carrying the token must not leave that token sitting in their address bar, history, or in the referrer sent to other sites.

#### Business logic

When a token is configured, every route — the app, the calls surface, the browser preview, the relay — requires it. A request presenting a matching token in the address is answered with a redirect to the same address minus the token, setting the token as a cookie that is not readable by page scripts; every later request rides that cookie. A request carrying a matching cookie is admitted. Anything else is refused as unauthorized. Tokens are compared in constant time.

On a loopback bind no token is configured and this guard does nothing at all, so local use is unchanged.

#### Rationale

The cookie is deliberately not restricted to same-site requests only: arriving at a device from another daemon's dashboard is a cross-site top-level navigation, and a strictly-scoped cookie set during it would be withheld from the redirect that immediately follows, leaving the user unauthorized on the clean address. Cross-site request forgery stays covered by the calls surface's own origin check.

A cookie is used rather than an authorization header because it also rides the live event stream and the browser preview's image stream, which a header cannot reach.

### Browser-borne routes are guarded even on loopback

#### User story

While the dashboard is open, the user visits some other website. That page must not be able to start an agent on this machine through the relay, nor drive the agent's Chrome through the browser preview.

#### Business logic

The relay and the browser preview both apply the same two checks the calls surface applies: the request's browser-declared origin must be this dashboard's, and — when bound to loopback — the name it arrived under must be a loopback name. A request failing either is refused. A genuine daemon-to-daemon relay call passes both, because it declares no origin and addresses a loopback name; only a browser's cross-origin or rebound request is turned away.

#### Rationale

Both routes change state — one spawns an agent, the other types into a live browser — and both are wired unconditionally on a loopback bind, where the shared token guard is a no-op. Without lifting these checks onto them, a page the user merely visited could reach them.

### The bridge authenticates itself

#### User story

The Chrome extension on claude.ai posts what a cloud session is parked on into the local daemon. It is the one caller that legitimately comes from another origin.

#### Business logic

The bridge routes are checked before the shared token guard and present their own token instead. When no bridge token is configured the bridge routes do not exist, which is the default. The bridge also gates on the extension's version, refusing a stale extension outright rather than letting it half-work. The session start-queue is wired behind both of its faces on the same token: the extension's, which claims requests and reports sessions, and the web run's, which queues a request and follows it, and which is told at once when no extension has called recently.

#### Rationale

The shared token guard's browser affordance is a redirect meant for a human following a link, which is meaningless to an extension posting data and which it could not follow. And the guard is absent on a normal loopback daemon anyway, where what keeps other origins out is the same-origin check — which the bridge, by design, cannot satisfy. So it carries its own authentication.

### Failure containment and shutdown

#### User story

Nothing the user does in the browser preview should be able to kill the daemon, and stopping the daemon should not hang on a stream that never ends.

#### Business logic

A request whose path cannot even be parsed is refused as a bad request. A failure inside the browser preview tears that one connection down rather than becoming an unhandled crash. Closing the server stops the quota polling — which by design outlives every agent, so nothing else would ever end it — and force-closes keep-alive and streaming connections, such as an open relay event stream, so the close actually completes.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
