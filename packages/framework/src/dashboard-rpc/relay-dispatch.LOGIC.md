The device [1] side of the relay [2]: the fixed set of calls a daemon that relayed an agent [3] here may make against this device's own home checkout [4], and the dispatch that runs one of them.

## Context

**User story**: the user starts an agent on a saved device from this dashboard and then reads its files, answers its question [5], messages it and publishes its work as if it ran locally; the device carries out each of those on its own checkout of the agent.

**Problem**: a relayed call arrives at the device with no browser behind it and with the relaying daemon's own project id, which means nothing here. The device must limit what such a call can reach — its own home project, and only the actions steering an agent needs — because anyone holding the device's token can send one.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout". The user's own working copy is "the project's checkout" or "the user's checkout".
[5] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it.
[6] handoff: what became of an ended agent's work: whether its branch exists, is pushed, and has a pull request.
[7] stop: ending an agent before it finishes: the Stop button, a signal to the process the agent's card names.
[8] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[9] registry: `~/.the-framework.json`: where the user's preferences are kept, and which also lists the projects.

## Business logic — TL;DR

- **A whitelist, nothing else** - only the reads about an agent [3] and the steering of it can be relayed; starting an agent, deleting one, removing a checkout [4] and the browser preview cannot.
- **Only the device's home project** - the caller's project id is replaced with this device's [1] home project id, so a relayed call can never address another registered project.
- **An unknown name is refused** - a call not on the list fails as an unknown relay call, and the list inherits nothing, so names every object carries are unknown too.
- **No onward relay** - a relayed call runs as local on the device: the agent is local here, and forwarding it again would loop.

## Business logic

### A whitelist, nothing else

#### Context

See `## Context`.

#### Business logic

The calls a relaying daemon may make here are exactly the reads about one agent [3] — the project's files and their statuses, a file's diff and content, the agent's changes, the git status, the agent's checkout [4], its handoff [6] state and the agent itself (`reads.ts`) — and the steering of it: stopping [7], answering its question [5], sending a message, opening the pull request and merging it (`control.ts`). Starting an agent, deleting one, removing a retained checkout are not on the list: a Start reaches a device through its own relay endpoint, where the device runs its own project's start hook, and destroying history or checkouts is not something a relaying daemon may reach.

### Only the device's home project

#### Context

See `## Context`.

#### Business logic

The first argument of every relayed call is the relaying daemon's project id, meaningless on this device [1]; it is replaced with the device's own home project id — the project the device's daemon registered at start — and the remaining arguments (a path, an agent id [8], and so on) carry through unchanged. A relayed call therefore only ever addresses the device's home checkout [4], never another project registered there, and resolves its path through the same registry [9] the device's own browser calls do.

### An unknown name is refused

#### Context

See `## Context`.

#### Business logic

A call whose name is not on the list fails with "unknown relay rpc" and runs nothing. The list inherits nothing, so a name every JavaScript object carries (`constructor`, `toString`, `valueOf` and the like) is unknown like any other.

### No onward relay

#### Context

See `## Context`.

#### Business logic

A relayed call runs on the device [1] with no browser request behind it. The one thing such a call would ask the daemon's wiring — whether the agent [3] is relayed onward to yet another device — defaults to no, and on the device that is the truth: the agent is local here, and forwarding it again would loop.
