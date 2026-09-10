The local daemon's half of the relay [1]: running an agent [2] on a saved device [3]. The local daemon holds the device's token, so it, and never the browser, drives the device's daemon: it checks that the device is reachable, forwards the start, streams the agent's events back into a local live stream the dashboard reads exactly as it reads a local agent's, forwards a relayed agent's reads and steering to the device, and keeps a local row for the agent so it shows in the list and reopens after a reload. The device's token lives in memory only, for the agent's lifetime.

## Context

**User story**: the user saves another machine's daemon by URL and token as a device [3], then picks it in the launcher [4]. The agent [2] runs on that machine while its events render in this dashboard like a local agent's; the device's status dot in Settings says whether it is reachable; and the agent's diff, push and pull request still work from here after it ends.

**Problem**: the browser must never call the device cross-origin, and the device's token must never leave the two daemons. So the local daemon makes every request, authenticating the way a daemon does: the token as the `fw_daemon` cookie with no `Origin` header, which the device's guard admits without the browser-only redirect, and which its same-origin check does not even see on these routes.

## Glossary

[1] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] launcher: the Start form on a project's own page.
[5] event stream: everything an agent does, one event per line; every surface (dashboard, terminal, archive, run) is a projection of it.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr`, `merge`.
[7] gate: a question with options at which an agent stops and waits for an answer.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **Checking that a device is reachable** - a ping with the token as the cookie, answered within 3 seconds with any success status, means reachable; anything else means not.
- **Starting the agent on the device** - the prompt, the kind and the options are posted to the device with a 15-second budget, and the device's own answer is the start's result, a refusal or an unreachable device included.
- **Streaming the agent's events back** - the device's events arrive one JSON line at a time and are forwarded as they complete; a rotated token or a dropped transport ends the stream cleanly as "done".
- **Forwarding an agent-scoped call to the device** - a read, diff, handoff, push or pull request for a relayed agent runs on the device, with a 60-second budget, and fails like a failed local read would.
- **The register of relayed agents** - one local live stream and one local list row per relayed agent, the row folded from the events so it mirrors the device, the device kept known past the stream's end until the daemon shuts down.

## Business logic

### Checking that a device is reachable

#### Context

**User story**: the devices in Settings each carry a status dot; the browser holds the tokens but cannot make the cross-origin request, so it asks the daemon.

#### Business logic

The daemon asks the device [3] for its relay [1] ping with the token as the `fw_daemon` cookie. Any success status within 3 seconds means reachable; a failure status, an unreachable host or the 3-second timeout means not reachable. The token is held in memory for the check and never written anywhere. The ping starts nothing on the device.

### Starting the agent on the device

#### Context

See `## Context`.

#### Business logic

The start posts the prompt, the kind of agent [2] and its start options to the device's [3] relay [1] start, with a 15-second budget. The device's answer, which carries the device's own id for the agent, becomes the start's result. When the device refuses, the result is a failure reading "the device refused the run (<status>)"; when it cannot be reached or does not answer in time, "could not reach the device: <reason>". Both have the same shape as a local refusal, so the dashboard shows them the same way and no caller treats a device failure specially. A saved URL with trailing slashes is accepted.

### Streaming the agent's events back

#### Context

**Problem**: the dashboard must tell a finished stream from a lost connection. A device that rotated its token will never stream anything more, so that is a finish, not a loss.

#### Business logic

The daemon fetches the device's [3] relay [1] events for the agent [2], authenticated with the cookie, as newline-delimited JSON: one event per line. Each event is forwarded as soon as its line is complete, a final line without a trailing newline included; a blank or malformed line is dropped rather than ending the stream. The stream ends when the device closes it, when the agent ends, or when the daemon cancels it, and once ended it is reported ended exactly once. A refusal, such as the 401 a rotated token earns, or an absent body ends the stream cleanly as "done", never as an error. A dropped transport ends it the same way.

### Forwarding an agent-scoped call to the device

#### Context

**User story**: after a relayed agent [2] ends, the user still opens its diff, pushes its branch or opens its pull request from this dashboard; the work is on the device [3], so that is where the call must run.

#### Business logic

An agent-scoped call for a relayed agent, whether a read, a diff, a handoff [6], a push or a pull request, is posted to the device's [3] relay [1] call endpoint with its name and arguments, authenticated with the cookie, with a 60-second budget because a push or a pull request runs over the network on the device. The device's result is returned as the call's result. A refused call ("the device refused the request (<status>)") or an unreachable device fails the call, so the caller falls back to its own empty or error shape, the same way it does for a failed local read. Which calls the device accepts is decided on the device (`relay-endpoints.ts`).

### The register of relayed agents

#### Context

**User story**: a relayed agent [2] appears in its project's agent list, opens like a local agent, keeps its status current as the device reports it, and is still there after the user reloads the dashboard.

**Problem**: a finished relayed agent's later reads, push and pull request must still reach the device [3] after its events have stopped flowing, so knowing where the agent runs has to outlive the event stream [5].

#### Business logic

Registering a relayed agent, under the id the device gave it, opens a local live stream the dashboard reads through its normal same-origin events channel, and starts the pump that feeds it from the device. Registering the same id again replaces the earlier pump. Each event pumped in is also folded into a local list row for the agent by the store's own rules (`../store/`), so the row mirrors the device: the terminal status when the agent ends, the waiting flag while it is parked on a gate [7], the driver [8] once its driver session starts; because a relayed event carries no write time, the row is stamped with the local time of arrival. A project's rows are listed newest first. When the stream ends, it is closed cleanly, which the browser reads as "done", and a row still marked running is marked stopped, because no terminal event arrived and the agent is no longer live. The device the agent runs on stays known past the stream's end, so later calls still reach it, until the daemon shuts down: shutdown cancels every pump, closes every stream and forgets every device and every row. Nothing here is ever written to disk: the device's URL and token live in memory for the agent's lifetime.
