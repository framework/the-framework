The device's [1] side of the relay [2]: the endpoints a daemon exposes under `/_relay` so another daemon holding this device's token can start an agent [3] here, watch its events, check that this device is reachable, and run one agent-scoped call against this device's own checkout [4]. They sit behind the shared-token guard (`server.ts`), so a caller without the token is refused before reaching any of them.

## Context

**User story**: the user saved this machine as a device [1] in another machine's dashboard and starts agents [3] here from there; the other dashboard shows whether this machine is reachable, renders the agent's events as they happen, and after the agent ends still reads its diff and pushes or opens its pull request from there.

**Problem**: a daemon that starts processes on request must accept only what a local start accepts, must never let a relayed agent relay onward to a third machine, and must never let the caller name which project is worked: the agent runs in this device's own home checkout [4].

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[5] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr`, `merge`.

## Business logic — TL;DR

- **The ping** - answers 200 with an empty body, starts nothing, and works even on a daemon that enabled no relay: reaching it proves this daemon is reachable and the caller's token valid.
- **A daemon that enabled no relay** - answers 404 "relay not enabled" to every other relay route.
- **The start** - takes a prompt, a kind and start options as JSON, strips any further device from the options, starts an ordinary local agent in this device's own home checkout, and answers with the start's result.
- **The events** - streams one agent's events as newline-delimited JSON until the agent ends or the caller goes away.
- **The agent-scoped call** - runs one whitelisted read, diff, steer, handoff, push or pull-request call against this device's own checkout and answers with its result.

## Business logic

### The ping

#### Context

**User story**: each saved device [1] in Settings carries a status dot; the dot is the user's own daemon pinging this endpoint on each device with its token.

#### Business logic

A GET answers 200 with an empty body; any other method is refused. It starts nothing and reads nothing. Because the shared-token guard has already admitted the request, answering at all proves both that this daemon is reachable and that the caller's token is valid. It answers even when the daemon wired no relay [2] handlers.

### A daemon that enabled no relay

#### Context

See `## Context`.

#### Business logic

When the daemon supplied nothing to start agents [3] or tail events with, every relay [2] route other than the ping is answered 404 "relay not enabled". A relay path that names no known endpoint is 404 "not found".

### The start

#### Context

See `## Context`.

#### Business logic

Only a POST is accepted; another method is 405 "method not allowed". The body is JSON of at most 256 KB; a body that cannot be read or parsed is 400 "invalid request body". The prompt is taken when it is a string and is empty otherwise. The kind is `research` or `prompt` when the body names one of those, and `build` in every other case [5]. The start options are taken when they are an object and are empty otherwise; whatever device [1] target they name is removed before the start, so a relayed agent [3] never relays onward. The agent is then started exactly as a local start would start it, through the daemon's own start closure, with no project named: it runs in this device's own home checkout [4], whatever the caller says. The start's result is answered as JSON; a start that fails outright is answered as a failed result carrying the failure's message rather than as an HTTP error.

### The events

#### Context

**User story**: the agent's [3] events render in the other machine's dashboard as they are written here.

#### Business logic

Only a GET is accepted. The agent's id is required as the `run` query parameter; without it the answer is 400 "missing run id". The response is a never-cached stream of newline-delimited JSON, one event per line, fed by the daemon's tail of that agent's events, replay and follow alike (`../dashboard-rpc/stream-forward.ts`). The stream lasts until the agent ends or the caller disconnects, and either closing stops the tail. A write that fails because the caller went away mid-line is ignored; the close tears the tail down.

### The agent-scoped call

#### Context

**User story**: after a relayed agent [3] ends, the other machine's dashboard still opens its diff, pushes its branch and opens its pull request: the work is here, so the call runs here.

#### Business logic

Only a POST is accepted; another method is 405. When the daemon wired no such call, the answer is 404 "relay rpc not enabled". The body is JSON of at most 256 KB naming the call and its arguments; an unreadable body is 400 "invalid request body", a missing name 400 "missing rpc name", and missing arguments mean none. The daemon runs the one call, provided it is on the whitelist of agent-scoped reads, diffs, steering, handoff [6], push and pull-request calls, against this device's [1] own checkout [4], never against a project the caller names; which calls are whitelisted and how the caller's project id is replaced is decided in `../dashboard-rpc/relay-dispatch.ts`. The result is answered as JSON under `result`; a call that fails is 500 with the failure's message.
