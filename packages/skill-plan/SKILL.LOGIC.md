The `plan` command skill: the prompt of the agent a person starts with `/plan <task>`, as a skill file the coding agent's harness expands. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/plan` followed by a task in words. The agent writes a ticket for the task and, under it, a plan: the ways it sees to do the work and the one it recommends, with why. It stops there. The person reads the plan and queues the ticket when the plan is right; the queued work does the work.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **The task** - what follows the command, in words; when nothing follows it, the agent says so and stops.
- **Nobody answers** - the agent never asks and decides by itself; a question it would have asked becomes an option in the plan.
- **One ticket** - the agent reads the open tickets first; when one already covers the task, it plans under that ticket; otherwise it writes one ticket for the task.
- **The plan** - under the ticket: the ways the agent sees to do the work and the one it recommends, with why.
- **Only write** - it queues nothing and changes no code.
- **The last message** - names the ticket and the recommended way, for the person who reads it and queues the ticket.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
