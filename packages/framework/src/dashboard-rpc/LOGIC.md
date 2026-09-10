Every call the dashboard makes to the daemon [1], as one table the daemon answers by name, plus the live event stream [2] the browser subscribes to. Nothing here computes an answer of its own: a read is handed to the projections [3] in the sibling `dashboard/` directory, and an action to the daemon's own capabilities. What lives here is the surface itself — which calls exist, what each one validates or refuses, which agent [4] or project it is about, and how a call about an agent running on a device [5] is carried there and its stream carried back. The browser's typed stubs for this surface are `dashboard/rpc/` at the package root; a call renamed here is a type error there rather than a broken page.

## Context

**User story**: everything the user does in the dashboard beyond scrolling is one of these calls — answering an agent's [4] question, chatting with it, stopping it, starting a new one, queueing a ticket, changing a setting, saving a device [5] — and every one of them must either happen or say why it did not.

**Problem**: an agent may be running on this machine or on a device the user saved. The same call must work either way, so a call names the agent and the surface decides where it goes; the browser never talks to another machine itself, and a device's token never reaches it.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, starts agents, runs the sweeps.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface is a projection of it.
[3] projection: an answer computed on demand from the files the daemon and its agents write, never from state kept in memory.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[6] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **The table of calls** (`index.ts`, `context.ts`, `test-context.ts`) - every call the daemon [1] answers, assembled once when it starts, together with what each call may reach and the two resolutions they all share: which project a project id names, and which checkout [4] an agent id names.
- **Reading** (`reads.ts`, `reads.test.ts`) - everything the pages show about a project or an agent: its history, one agent's replay, the surfaced documents, the tickets, the cross-project rollups, the changed files and their diffs, the branch's state and the handoff.
- **Acting** (`control.ts`, `control.test.ts`, `agent-addressing.test.ts`) - every action on an agent or a project: stop, answer a gate, send a chat message, move the handoff, start an agent with its full set of options, push, open a pull request, merge, remove a checkout, delete an agent, open something on this machine, and the ticket and agent-queue actions.
- **Following an agent live** (`events.ts`, `events-tail.ts`, `events-tail.test.ts`) - one selected agent's event stream [2] served to the browser: what is already logged is replayed, the end of the replay is marked once, and everything new follows as it is written.
- **Settings** (`preferences.ts`, `preferences.test.ts`, `projects.ts`, `projects.test.ts`, `quota.ts`, `quota.test.ts`, `devices.ts`, `devices.test.ts`) - reading and saving the user's preferences without a stale tab reverting what it never touched, adding and removing projects, the quota reading behind the usage panel, and the health check behind each saved device's [5] status dot.
- **Calls about an agent elsewhere** (`relay-agent.ts`, `relay-dispatch.ts`, `relay-dispatch.test.ts`, `stream-forward.ts`, `stream-forward.test.ts`) - both ends of the relay [6]: the fixed set of calls a device will run on another daemon's behalf, and the forwarding that makes a remote agent's stream arrive like a local one.
