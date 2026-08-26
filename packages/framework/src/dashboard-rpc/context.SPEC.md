Holds the daemon's capabilities that every dashboard RPC acts through — starting agents, registering projects, reading preferences, quota, Auto PM's last decision, a project's recorded errors, Discord credentials, the daemon's own bridge browser, and the lookup that tells a locally running agent from one relayed from a device — and resolves a project id, and an agent id, to the directory on disk a call must act on.

## Business logic — TL;DR

- **Wired once, for the whole daemon** - the daemon supplies its capabilities at start-up; they never vary per browser request, and an RPC reaching for one that was never supplied fails loudly naming it, rather than answering as if nothing were configured.
- **A call about an agent resolves to that agent's worktree** - not to the project root, because an agent reads and writes its event log, its control channel and its files inside its own worktree.
- **Nothing is relayed from a device** - on the receiving side of the relay, the relayed-agent lookup answers "empty" so a forwarded call is handled locally instead of being forwarded onward forever.

## Business logic

### Wired once, for the whole daemon

#### User story

The user opens the dashboard and clicks Start, changes a preference, or looks at the usage panel. Every one of those goes through the daemon that is already running — the browser never talks to anything else.

#### Business logic

The daemon hands over its capabilities when it comes up, and every RPC reads them from there. They are the daemon's own, identical for every browser and every request. Asking for a capability the daemon never supplied is treated as a wiring mistake: the call fails and the message names the missing capability, instead of quietly behaving like a daemon that has that feature switched off.

### A call about an agent resolves to that agent's worktree

#### User story

The user presses Stop on one agent, or watches its live feed, while other agents are running in the same project.

#### Business logic

A call that names a project alone resolves to the project's workspace. A call that also names an agent resolves to that agent's own checkout under `.the-framework/branches/` when one exists, and to the project's workspace otherwise — for an agent with no worktree, and for one whose worktree has already been cleaned up.

#### Rationale

An agent tails its control channel and appends to its event log inside its own worktree. Addressed at the project root instead, Stop and chat messages would land in a file nobody is reading, and a live feed would tail an empty log or a previous agent's output.

### Nothing is relayed from a device

#### User story

The user starts an agent on another device from this dashboard, then steers it and watches it as if it were running here.

#### Business logic

Run-scoped calls consult a lookup that says whether the named agent is one this daemon is relaying from a connected device; when it is, the call is forwarded to that device instead of being resolved against a local checkout. On the device receiving such a forwarded call, that lookup is empty by design — the agent it names is local there — so the call is served locally instead of being relayed on again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
