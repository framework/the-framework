Decides which checkout [1] an agent id [2] addresses, and which event stream [3] file a subscription to that agent [4] tails, for every surface addressed by agent — the daemon's serve targets and previews, each dashboard RPC, the event tails — so that the fallback rules cannot drift apart between them.

## Context

**User story**: the user opens an agent in the dashboard the moment it starts, or long after it ended, and sees that agent's own events and checkout state — never a previous agent's.

**Problem**: an agent's checkout directory under `.branches/` exists before the agent has written its status snapshot [5]: the daemon creates the directory and spawns the process, and only then does the agent write its snapshot. A lookup by agent state alone would miss an agent that certainly exists. And an event stream tail resolves its path once, when the browser opens it: a wrong fallback would not correct itself a moment later, and the tail would follow the wrong file for as long as that connection lived.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout". The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[3] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[5] status snapshot: `.the-framework/agent.json` in an agent's checkout: the agent's current state as one small JSON document, folded from its event stream, so that reading an agent's status never means replaying the stream.
[6] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[7] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[8] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.

## Business logic — TL;DR

- **The checkout an agent id resolves to** - the live agent's [4] own checkout [1], else the checkout directory named for the id when it exists, else the project root.
- **The event stream a tail follows** - the same order, except that where the checkout resolution would fall back to the project root, an ended agent's recorded event stream [3] wins; the root's own event stream is the last resort.

## Business logic

### The checkout an agent id resolves to

#### Context

See `## Context`.

#### Business logic

- No agent id [2], or an id that is not path-safe, resolves to the project root.
- A live agent [4] with that id resolves to the checkout [1] its status snapshot [5] records (the live agents as read by `agent-store.ts`).
- Otherwise the checkout directory named for the id under `.branches/` resolves when it exists as a directory, even before the agent inside it has written anything.
- Otherwise the project root: an unknown or finished agent's checkout may already be gone, and the project's own state is the sane thing to act on. Nothing here fails.

### The event stream a tail follows

#### Context

**Problem**: the project root's `.the-framework/events.jsonl` belongs to whatever agent ran at the root last; a tail of an ended agent [4] that fell back to it would show another agent's output.

#### Business logic

- No agent id [2], or an id that is not path-safe, resolves to the project root's event stream [3].
- A live agent's id resolves to the event stream in its own checkout [1]; failing that, the checkout directory named for the id, when it exists, resolves to the event stream inside it.
- Where the checkout resolution would fall back to the project root, an ended agent's recorded event stream wins: its run's [6] diary on the `agent-data` branch [7] when the branch has the run, else the archive's [8] `<id>.jsonl` (the lookup in `agent-store.ts`). The record existing proves the agent ended, and it is the agent's own.
- With no record either, the project root's event stream is the final fallback, so a just-starting agent at the root — no snapshot yet and no checkout to probe — streams as it always has. Only the event tails resolve this way; every other agent-addressed surface keeps the checkout resolution's root fallback.
