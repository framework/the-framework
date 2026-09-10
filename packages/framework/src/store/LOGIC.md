The persisted state of one agent [1] and every read of it. An agent's event stream [2] and status snapshot [3] live in its checkout [4], the archive [5] of ended agents under the project, and the lasting run [6] on the `agent-data` branch [7] in the `logs` skill's [8] shape; this directory owns the writing of the first two, the rescue of an agent whose process died, the reads that list live and ended agents together from every place they can be, the two-way mapping to the run, and the rule that resolves an agent id [9] to the checkout and event stream it addresses. The daemon tails these files and records the run from them, the agent process appends to them, and the dashboard RPCs read them.

## Context

**User story**: the user watches an agent live, restarts the daemon or reopens the dashboard and finds the same agent, continues an ended agent as one row, and sees every agent of a project — including those other machines and other people recorded — once in the history, with a crashed agent shown as `stopped` rather than running forever.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] status snapshot: `.the-framework/agent.json` in an agent's checkout: the agent's current state as one small JSON document, folded from its event stream, so that reading an agent's status never means replaying the stream.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout". The user's own working copy is "the project's checkout" or "the user's checkout".
[5] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[6] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[7] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[8] skill: One of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[9] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[10] surrogate end: the end event The Framework writes on behalf of an agent whose process died without reporting one, so the agent ends as `stopped` like any other.
[11] crash rescue: ending an agent whose status snapshot says `running` while the process that owned it is gone, so it stops showing as live and keeps its history; done on read for a provably dead process, and at daemon boot for every process the daemon cannot find.
[12] reclaim: Removing a finished agent's checkout once its work is on the remote.

## Business logic — TL;DR

- **The agent's files and their lifecycle** (`agent-store.ts`) - one append-only event stream [2] and one status snapshot [3] per agent [1] in its checkout [4], written torn-proof and best-effort; a fresh open, a continuation that reopens the same agent, the fold of every event kind into the snapshot, the archive [5] on close, the surrogate end [10] for a process that died, the crash rescue [11] on read and at boot, and the history that lists live agents, the runs [6] on the `agent-data` branch [7] and the archive together.
- **The run's two shapes** (`run-record.ts`) - which facts of the status snapshot are the `logs` skill's [8] card fields and which ride under its `caller` key, and which events become the skill's four diary kinds, both ways.
- **Addressing an agent's checkout and event stream** (`agent-checkout.ts`) - an agent id [9] resolves to the live agent's checkout, else the checkout directory named for it, else the project root; a tail of an ended agent follows its recorded event stream instead of the root's.
- **The entry point** (`index.ts`) - what the rest of the product imports from this directory; no logic of its own.
- **What the tests prove** (`agent-store.test.ts`, `run-record.test.ts`, `agent-checkout.test.ts`) - every rule above, pinned against an in-memory file system or a throwaway project directory.

## Business logic

### An agent's record, from its checkout to the branch and back

#### Context

See `## Context`.

#### Business logic

While an agent [1] runs, its process appends every event to the event stream [2] in its checkout [4] and rewrites the status snapshot [3] beside it (`agent-store.ts`). When the agent's process is gone, the daemon's teardown (`daemon-runtime.ts`) reads the snapshot and the events out of the checkout one last time — giving a snapshot still at `running` the surrogate end [10] and stamping the branch it observed — maps them to the `logs` skill's [8] card and diary (`run-record.ts`), and records the run [6] on the `agent-data` branch [7] through the skill; the checkout is then reclaimed [12]. Every later reader of that agent — the history list, the replay of its events, a tail of it, a continuation that puts its history back into a checkout — finds the run on the branch first and the transient archive [5] second, and maps the run back into the same snapshot and events (`agent-store.ts`, `run-record.ts`).
