Gives every call the dashboard makes the daemon's own capabilities, wired once when the daemon starts, and fixes the two resolutions every call shares: which project a project id names, and which checkout [1] an agent [2] id names.

## Context

**Business logic story**: the daemon answers the dashboard's calls inside its own process, so a call that starts an agent reaches the daemon's own start, and a call that reads preferences [3] reads the same registry the daemon writes. Every call resolves the project it is about through that registry, and a call about one agent resolves the checkout that agent works in, so that steering and reads land where the agent actually is rather than at the project's root.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[5] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[6] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[7] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[8] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[9] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[10] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[11] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.

## Business logic — TL;DR

- **One wiring, set once** - the daemon hands the call layer every capability at start-up; a capability found missing at call time is a bug that fails the call, never a degraded answer.
- **A project id resolves through the registry** - every call resolves a project id against the registry, counting only projects whose directory is still on disk; an unknown id resolves to nothing.
- **An agent id resolves to the checkout the agent works in** - the agent's own checkout while it exists, else the project's root; no agent id means the project's root.
- **What is known about relayed agents** - the in-memory event source and the relayed-agent lookup answer only for an agent this daemon relays to a device, and the lookup defaults to "nothing is relayed from here".

## Business logic

### One wiring, set once

#### Context

**Problem**: the calls need things only the daemon has: its start (with the guard against starting the same work twice), the ability to install and register a repository, the live quota [4] reading, Auto PM's [5] state, the errors its sweeps [6] found, its bridge browser [7]. There is exactly one host serving the dashboard and it has all of them, so a call never has to cope with "this capability is not available here".

#### Business logic

The capabilities the daemon wires, once, when it comes up: starting an agent, adding a project, the preferences [3] store over the registry, the Discord credentials store (which also reconnects the daemon's Discord services on a save, so the bot connects without a restart), the quota source behind the usage panel, Auto PM's last report and its sweep fired on demand, what each project currently suffers from as the daemon's sweeps last recorded it, the daemon's own bridge browser, and the two facts about relayed [8] agents described below. A call that reads a capability nobody wired fails with an error naming it ("the dashboard's RPC context has no …") instead of silently answering as if nothing were configured: an unwired capability is a wiring bug, not a legitimate state of the product.

### A project id resolves through the registry

#### Context

See `## Context`.

#### Business logic

Every call names the project it is about by the project's id, and resolves it against the registry [3]: the project's path is the registered path, and only a project whose directory still exists on disk counts (the rule is `dashboard/projects.ts`'s). An id that names no such project resolves to nothing, and each call then answers its own empty shape rather than failing.

### An agent id resolves to the checkout the agent works in

#### Context

**Problem**: an agent reads and writes inside its own checkout [1]: its events, its control file, its working tree. Anything addressed at an agent has to resolve to that checkout, or it reads an empty log and steers an agent that is not listening. And an agent has a checkout before it has written any state of its own, because the daemon creates the directory before it spawns the process; a resolution that only looked at recorded state would miss an agent in its first seconds, and the live event stream [10], which resolves its file once when the browser opens it, would then follow the wrong file for the life of that connection.

#### Business logic

With an agent id [11], the call acts on the agent's own checkout: the working directory a live agent recorded, else the checkout directory named after the agent when that directory exists, even before the agent has written its state. An agent id that is unknown, unsafe for a path, or whose checkout is gone falls back to the project's root, which is still the sane thing to act on. Without an agent id the project's root is addressed, which is right for an agent that has no checkout of its own (a project that is not a git repository). The resolution itself is the store's (`store/agent-checkout.ts`), shared with the daemon so the fallback rules cannot drift apart; this adds only the project lookup.

### What is known about relayed agents

#### Context

**Problem**: an agent relayed [8] to a device [9] has no checkout and no events file on this machine; what this daemon knows about it lives in memory: the events it streamed back, and the device it runs on.

#### Business logic

Two capabilities exist only for relayed agents. The in-memory event source answers with a live stream only for an agent this daemon is relaying from a device; for an ordinary local agent it answers nothing, so that agent's stream is tailed off disk. The relayed-agent lookup tells a call about one agent whether that agent runs on a device (and which), so the call is forwarded there instead of resolving a checkout that does not exist here. The lookup is the one capability with a default rather than a failure when unwired: a call arriving on the device side of a relay is about an agent local to that device, and forwarding it onward would loop, so the honest default is that nothing is relayed from here.
