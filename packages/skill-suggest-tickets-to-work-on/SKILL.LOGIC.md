The `suggest-tickets-to-work-on` command skill: a skill file the coding agent's harness expands from `/suggest-tickets-to-work-on`, the prompt of the agent a person starts for picking and ranking the tickets worth working on next, each with the priority it should get on the agent queue; it changes nothing. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/suggest-tickets-to-work-on`. The agent reads every open ticket and its plan, and ends on a written result: the tickets worth working on next, ranked, each with the priority it should get on the queue, a reason, and how confident it is. It queues nothing; the person queues the ones they approve.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The picks** - ranked by a mix of sensible criteria: what the work is worth, its effort and uncertainty, what it unblocks; a ticket already on the queue, held by someone, or in review is skipped.
- **Each pick** - its file, its title, the priority it should get on the queue (the ticket's own priority, 5 when it has none), one line saying why, and whether the agent is confident it should go next.
- **Changes nothing** - no file, no commit, no ticket, no queue entry: the written result is the agent's last message, which the run's record keeps, and a person decides what comes next.
- **Nothing worth picking** - it says so and stops.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
