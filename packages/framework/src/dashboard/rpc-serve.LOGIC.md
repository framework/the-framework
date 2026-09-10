Serves the dashboard's RPC surface at `/_rpc`: a call is a `POST /_rpc/<name>` with a JSON array of arguments answered as JSON, and the live event stream [1] of one agent [2] is a `GET /_rpc/events`. Two guards keep a web page on another origin, or one whose DNS name was rebound to this machine, from calling any of it.

## Context

**User story**: the dashboard reads projects, agents and tickets, starts and steers agents, and follows an agent's events live, all through this one surface on the daemon's own port.

**Problem**: every RPC runs in the daemon's process, and one of them starts an agent [2] on the user's machine. A browser sends a cross-site request with an `Origin` header, which gives away a page on another site; a page whose DNS name points at 127.0.0.1 looks same-origin to the browser, and only the `Host` header still names it.

## Glossary

[1] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[5] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[7] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.

## Business logic — TL;DR

- **Only this server's own pages may call** - a request with an `Origin` that is neither this server nor a loopback host is refused with 403, while a request with no `Origin` is a non-browser caller and passes.
- **A rebound Host is refused** - bound to a loopback address, the daemon answers only a `Host` that names a loopback host or the bound address; anything else, or no `Host` at all, is 403.
- **A call by name** - `POST /_rpc/<name>` with a JSON array of arguments is looked up in the registry built from the RPC modules' exports, its result comes back as `{ ret }`, a failure as `{ error }`, and the daemon stays up either way.
- **The live event stream** - `GET /_rpc/events` streams one agent's events as Server-Sent Events, from the in-memory stream of an agent relayed [3] from a device [4] when there is one and else by tailing the agent's log, and ends cleanly when there is nothing to stream.
- **What every RPC acts through** - one wired context with every capability required, so no RPC carries a branch for a missing one.

## Business logic

### Only this server's own pages may call

#### Context

See `## Context`.

#### Business logic

A request is same-origin when its `Origin` header is absent, equals `http://` or `https://` followed by the request's own `Host`, or names a loopback host (`localhost`, an address in `127.0.0.0/8`, `::1`). An absent `Origin` means a non-browser caller such as a command-line tool or another daemon, which has no ambient browser session to abuse. A malformed `Origin` counts as cross-origin. A cross-origin request is answered 403 "cross-origin request forbidden". The loopback rule is by address, not by prefix: a registrable name such as `127.evil.com` is not loopback.

### A rebound Host is refused

#### Context

**Problem**: a page on `evil.com` whose DNS answer is 127.0.0.1 is same-origin as far as the browser is concerned, so its request passes the check above. The `Host` header still carries the name the browser was asked for, not the address it resolved to.

#### Business logic

When the daemon is bound to a loopback address, the `Host` header must name a loopback host or the bound address itself; the port is ignored, and a bracketed IPv6 host keeps its colons. A missing `Host` is refused too: HTTP/1.1 requires it and every browser sends it. A refused request is answered 403 "unexpected Host header". On a non-loopback bind the daemon is reached by a name it cannot predict, so there is nothing to check against and every `Host` passes; that case is gated by the shared token instead (`server.ts`). A server that names no bound host at all is unaffected.

### A call by name

#### Context

See `## Context`.

#### Business logic

- A request outside `/_rpc` is declined, so the static handler gets it.
- The name is the path after `/_rpc/`. It is looked up in the registry of RPCs, which is built from the RPC modules' own exports so that an exported call can never be left out of the table, and which has no inherited members: `constructor`, `__proto__`, `toString` and the like are not RPCs (`../dashboard-rpc/index.ts`).
- Anything but a `POST` to a registered name is answered 404 `no such RPC: <name>`.
- The body is read up to 4 MB; a larger body fails the call with "request body too large". An empty body means no arguments; a body that is not valid JSON fails the call. A body that parses to anything but an array is answered 400 "the request body must be a JSON array of arguments".
- The handler's return value is answered 200 as `{ ret: <value> }`, never cached.
- A handler that throws is a failed call, not a dead daemon: it is answered 500 with `{ error: <message> }` when nothing has been sent yet, else the response is simply ended.
- A request whose `Host` is empty or malformed is still answered rather than crashing the daemon: only the path and the query of the request are read.

### The live event stream

#### Context

**User story**: the user opens an agent [2] and watches its events arrive as they are written.

**Problem**: a client must be able to tell a finished stream from a dropped connection. The response ending is the clean close, so a stream with nothing to send ends rather than errors.

#### Business logic

`GET /_rpc/events?projectId=<id>&agentId=<id>` answers a Server-Sent Events response, never cached, with proxy buffering disabled so a proxy in front of a network bind does not hold frames back. Each event is one `data:` frame carrying the event as JSON. The source is chosen by what is wired: the in-memory stream of an agent this daemon is relaying [3] from a device [4] wins; otherwise the agent's own events file is tailed, replayed then followed, with the end-of-replay marker and the follow across the agent's teardown described in `../dashboard-rpc/events.ts`. When there is nothing to stream, such as an unknown project, the response ends at once, which the browser reads as "done" rather than "lost". When the source ends, the response ends. When the client disconnects, the follow is stopped.

### What every RPC acts through

#### Context

**Problem**: an RPC that must handle a missing capability grows a branch per capability, and the browser a matrix of degraded states; one host, the daemon, wiring everything removes both.

#### Business logic

Mounting the surface installs one context every RPC reads: the daemon's start closure (a prompt, the kind, the start options and the project), its add-project closure, the events source for relayed [3] agents, the relayed-agent lookup (which device [4] an agent runs on, and a project's relayed agents), the preferences [5] store, the quota [6] source, the Discord credentials store, which also reloads the Discord services on a save, what Auto PM [7] last decided, a way to run Auto PM now that resolves when it has finished so the caller can report what it decided, each project's current errors, and the daemon's bridge browser with its show, hide and restart.
