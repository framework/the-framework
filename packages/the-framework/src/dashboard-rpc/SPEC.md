The dashboard's whole conversation with the daemon: everything the browser reads, everything it does, and the live feed it watches. The daemon serves it in its own process, so a click in the dashboard reaches the same daemon that spawns agents, owns the registry and runs the sweeps — the dashboard has no server of its own.

## User story

The dashboard is the product's only user interface. Whatever the user sees there — the project list, an agent's live output, its changed files and diffs, the Overview's pooled feeds, the usage panel — and whatever they do there — start an agent, stop it, chat with it, answer its gate, push its branch, open and merge its pull request, queue a ticket, change a setting — passes through this surface.

## Business logic — TL;DR

- **The browser calls the daemon by name** - each read and each action is one `POST /_rpc/<name>`; only the names actually registered answer, and anything else is not found.
- **Reads are projections, writes are files** - a read answers from what the daemon and its agents have written to disk; an action that steers a live agent is written into that agent's control channel, which the agent is tailing.
- **The live feed is a subscription, not a call** - one connection replays an agent's events and then follows them, announcing when the replay is done.
- **An agent running on a device is served by that device** - agent-scoped reads and actions are forwarded over the relay, and the answer comes back as if it had been local.
- **A cloud session is reached through the bridge instead** - an agent that handed its task to claude.ai has no local session, so its parked question and the user's answer travel through the Chrome extension.
- **Nothing here is a second implementation** - starting an agent, removing a checkout, committing and pushing, merging: each is the daemon's own operation, so the dashboard and the CLI cannot drift apart.

## Business logic

### The browser calls the daemon by name

#### User story

The user's browser talks to the daemon on their own machine, and — when the daemon is bound beyond loopback — possibly from elsewhere.

#### Business logic

Every read and every action is one call, addressed by its own name. Only names that are genuinely part of this surface answer; a name that merely looks like one — anything an object carries by inheritance — is not found, rather than being invoked or failing loudly. The set of answerable names is derived from what this surface actually offers, so an action that exists but was never registered cannot happen.

### Reads are projections, writes are files

#### User story

The user watches an agent and steers it, and expects the dashboard and the terminal to agree about what is happening.

#### Business logic

The read side answers from the files the framework already writes — the agents' event logs and agent metas, the tickets, the agent queue, the checkouts' git state — so the dashboard is a projection of the same truth every other surface shows, never a second record of it. A read never errors at the user: an unknown project, a repo that is not a git repo, or a failed read all answer empty.

The write side is the mirror image: steering a live agent is one entry appended to the control channel inside that agent's own worktree, which the agent tails between turns. Files are the seam — there is no direct channel between the daemon and a running agent.

### The live feed is a subscription, not a call

#### User story

The user opens an agent part-way through its work, sees everything that has happened, and then watches it continue — including after the agent finishes and its worktree is retired.

#### Business logic

The feed is a single subscription per agent. It replays the agent's whole event log, announces exactly once that the replay is complete — which is what lets a reconnecting tab swap its feed without blanking — and then delivers each new event. It follows the event log when it moves into the agent's archive, losing and repeating nothing, and goes quiet rather than falling back onto another agent's events.

### An agent running on a device is served by that device

#### User story

The user starts an agent on another machine and works with it in this dashboard exactly as with a local one.

#### Business logic

Every agent-scoped read and action first asks whether the named agent is one this daemon is relaying from a device; if it is, the call is performed on that device and its answer returned unchanged, so nothing above ever distinguishes the two cases. Its live events come from the relay instead of from disk, and the feed closes when the agent ends.

On the receiving side the relay accepts only a fixed list of agent-scoped reads and steering actions — starting, deleting and previewing are deliberately not on it — and the calling daemon's project id is discarded in favour of the device's own project, so a relayed call can never reach another project registered there.

### A cloud session is reached through the bridge instead

#### User story

An agent with the `web` run target hands its task to a cloud session on claude.ai. When that session parks on a question, the user should answer it in the dashboard like any other gate.

#### Business logic

A cloud session cannot be steered through a control channel, so its question, the answer the user picks, its delivery status and what the session has said are all carried through the Claude web bridge and keyed by cloud session id — what the extension can see from the page. Only an answer that is one of the options actually offered may be queued, and a queued answer can be withdrawn until the extension delivers it. Whether the extension is reaching the daemon at all is reported separately, because a misconfigured extension and an uninstalled one both look like silence.

### Nothing here is a second implementation

#### User story

The user does the same thing from the dashboard that they could do from the CLI, and gets the same behavior and the same guard rails.

#### Business logic

Starting an agent goes through the daemon's own start, busy guard included. Registering and installing a project, removing a retained worktree, deleting an agent, committing and pushing an agent's work, opening its pull request and merging it are each the framework's own operation, invoked from here. What this surface adds is only what belongs to the dashboard: resolving a project id to a workspace, resolving an agent id to the checkout it is working in, stopping a preview that is serving a checkout about to be removed, and holding the checkout's lock so a click landing at the same moment as the daemon's own teardown runs after it rather than against it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
