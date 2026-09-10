Carries everything the browser asks of the daemon: every call goes out the same way, addressed by the daemon's own name for it, and one live stream per selected agent [1] delivers that agent's events [2] as they are written. Nothing here decides what a call means — this is the wire, plus the rules for what a caller is told when a call or a stream fails.

## Context

**User story**: the dashboard shows what the daemon and the agents [1] are doing, and every button on it is a request to the daemon. When the daemon stops answering, the user is told so rather than shown a page that has quietly stopped moving.

**Problem**: the browser must reach the daemon with no setup by the user — no address to enter, no key to paste on a normal install. Because the daemon serves the dashboard itself, every call goes back to the address the page was loaded from, and the browser attaches the daemon's own credential without being asked.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **One way to call the daemon** - a call is addressed by the daemon's own name for it, with its arguments and its answer as JSON, back to the address the dashboard was served from.
- **Authentication needs no setup** - the call is same-origin, so the browser attaches the daemon's credential itself; the daemon decides whether one is required.
- **A failed call carries the daemon's own reason** - a refused call fails with the reason the daemon gave, and with a plain statement of the call and the status when it gave none.
- **An answer that is not the daemon's** - a reply that is not the daemon's own is reported as such, instead of surfacing as a parsing error inside whatever screen made the call.
- **What a failed call shows the user** - the transport only reports; each screen decides whether the failure is shown as an error or absorbed.
- **The live event stream** - one subscription per selected agent, delivering each event the moment it is written.
- **A stream that ended is not a stream that died** - an ended stream and a dropped one are told apart, so only a dropped one is retried and reported as the daemon not answering.
- **A relayed agent streams like a local one** - an agent running on a device is subscribed to exactly as a local agent is.

## Business logic

### One way to call the daemon

#### Context

See `## Context`.

#### Business logic

Every call the dashboard makes goes to the daemon at the address the page itself was served from, addressed by the name the daemon exports the call under. The arguments travel as JSON and the answer comes back as JSON. Nothing about where a call's code sits in the dashboard affects how it travels, so moving or renaming a file in the browser cannot break a call.

### Authentication needs no setup

#### Context

**User story**: on the user's own machine, opening the dashboard just works. On a machine bound to the network, the user opened it once with the address the daemon printed, and every call since has been authenticated without the token appearing again.

#### Business logic

Calls go back to the daemon that served the page, so the browser attaches that daemon's credential on its own and nothing here has a token to manage. Whether a credential is required at all is the daemon's decision, in `src/dashboard/server.ts`: a daemon reachable from the network demands the shared token on every route and refuses a call without it, while a daemon bound to loopback demands nothing and relies on the check that only the dashboard's own origin may call.

### A failed call carries the daemon's own reason

#### Context

**Problem**: a refused call has a reason — an unknown project, a checkout that is gone, a missing tool — and the reason is the daemon's. Losing it and showing a status number instead leaves the user with nothing to act on.

#### Business logic

A call the daemon refuses fails with the reason the daemon gave. A refusal with no reason fails with the name of the call and the status it came back with, so there is always something specific to show.

### An answer that is not the daemon's

#### Context

**Problem**: a proxy, a captive portal or an error page can answer instead of the daemon. Its answer is not JSON, and reading it as if it were surfaces deep inside whatever screen made the call, as a parsing complaint that says nothing about what actually happened.

#### Business logic

A reply that cannot be read as the daemon's answer fails with a statement that this call got a reply that was not the daemon's, together with the status it arrived with. An empty reply counts as an answer with no value, which is what a call that returns nothing gives back.

### What a failed call shows the user

#### Context

**Business logic story**: the transport reports a failure to its caller and stops there. Whether it becomes a visible error is decided per screen: an action the user pressed shows the failure next to the control that failed (`use-action.ts`), while a panel that reads on a timer keeps the last answer it had rather than blanking (`use-async.ts`).

#### Business logic

This file surfaces nothing by itself. It only guarantees that every failure arrives with a sentence worth showing.

### The live event stream

#### Context

**User story**: watching an agent [1], the user sees what it does appear as it happens — no reloading, no polling.

#### Business logic

Selecting an agent [1] opens one subscription for that agent's events [2], identified by the project and the agent. A subscription that cannot be opened at all fails immediately, which is the caller's signal to retry.

Once open, each event is delivered the moment it arrives. Events are read as they stream in, so an event split across the network arrives whole rather than being dropped, and an event that arrives damaged is skipped as one lost event rather than killing the feed.

### A stream that ended is not a stream that died

#### Context

**Problem**: an agent [1] that goes quiet and a feed that has died look identical on screen, and the difference is what the user needs to know. Without it, a dashboard whose daemon has stopped answering looks like an agent thinking.

#### Business logic

A closed stream says which kind of close it was:

- The daemon ended it — an unknown project, or a relayed [4] agent whose stream is finished — which is a clean end and is not retried.
- The connection dropped, which is reported with the failure, so the surface can say the daemon is not answering and reconnect. The reconnection schedule is the caller's, in `use-live-events.ts`.
- The dashboard closed it itself, by moving to another agent or leaving the page, which is a clean end and never an outage.

A caller that starts listening for the close after the stream already ended is told immediately, so an end can never be missed.

### A relayed agent streams like a local one

#### Context

**User story**: the user starts an agent [1] on a device [3] and watches it in this dashboard exactly as if it were running on this machine.

#### Business logic

Subscribing to a relayed [4] agent's events [2] is the same subscription as for a local one: the browser names the project and the agent, and the daemon it is talking to decides whether to read the agent's events off this machine's disk or to stream them from the device that is running the agent. The browser is never told which, and the feed reads the same either way.
