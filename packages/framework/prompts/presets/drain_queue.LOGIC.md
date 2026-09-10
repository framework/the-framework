The "Spin up agents working on the AI queue" preset, the one preset no launcher button offers: the prompt of a drain [3] agent [1], fired by the daemon's Auto PM [4] whenever the agent queue [2] is not empty, and by the user's "Run now" on the drain row of the Overview. Its tooltip reads "Work the entries already on the queue (TODO_AGENTS.md)". The agent uses the `queue` skill [5]: it runs `queue`, works on the first open entry only, runs `queue done "<the entry>"` once the work is done and published, and does not start any other entry. It takes no parameter.

## Context

**User story**: with Auto PM switched on, the user's queue empties itself one entry per agent, top-down, each entry ending as a pull request; the Overview shows which ticket is being implemented right now, which it can only do because it recognizes a drain agent by its prompt.

**Business logic story**: an agent started by hand arrives as bare prompt text with nothing marking it as a drain, so The Framework recognizes a drain by the prompt being exactly this preset's text, whitespace aside (the rule in `src/preset-catalog.ts`): a prompt that merely mentions the queue is not a drain, and mistaking one for a drain would name a ticket as being implemented by an agent doing something else entirely. Several drain agents may run at once, each on its own first open entry, since claiming an entry is what keeps two agents off the same one.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] drain: starting an agent on the agent queue's first open entry; the half of Auto PM that spends existing work.
[4] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[5] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **The first open entry, and only it** - the agent runs `queue` and works on the first open entry, never another one.
- **Done means published** - only when the work is done and published does the agent run `queue done "<the entry>"`, which is what takes the entry off the queue.
- **One entry per agent** - the agent does not start any other entry; the next entry is the next agent's.
