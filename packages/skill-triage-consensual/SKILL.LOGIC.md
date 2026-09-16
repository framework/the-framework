The `triage-consensual` command skill: the prompt of the agent a runner starts for putting the significant, consensual tickets on the project's agent queue, as a skill file the coding agent's harness expands from `/triage-consensual`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage-consensual`. The agent reads every open ticket with its plan, picks the significant ones whose plan is consensual, puts each on the agent queue as a link to the ticket at the ticket's own priority, and stops. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **Consensual work** - a significant ticket, no quick win, whose plan has no open question, no variability, one fairly obvious plan.
- **Queueing** - each picked ticket goes on the agent queue as a link to the ticket labeled with its title, at the ticket's own priority, 5 when it has none; a ticket already on the queue or held by someone is skipped.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however clear its plan, so a human can still veto it on the queue.
- **Nothing qualifies** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
