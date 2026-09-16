The `triage-quick` command skill: the prompt of the agent a runner starts for putting the quick-win tickets on the project's agent queue, as a skill file the coding agent's harness expands from `/triage-quick`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage-quick`. The agent reads every open ticket with its plan's effort and uncertainty, picks the ones whose plan shows a quick win, puts each on the agent queue as a link to the ticket with a sensible priority, and stops. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **A quick win** - a planned ticket with a low effort and no uncertainty.
- **Queueing** - each picked ticket goes on the agent queue as a link to the ticket labeled with its title, with a sensible priority, the lowest-effort tickets bumped so agents work them first; a ticket already on the queue, held by someone or in review (with a pull request named on it) is skipped, and so is a ticket whose plan records a decision not to do the work.
- **A rejected write** - a write to the queue rejected because someone else wrote first is tried once more after reading again.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however small its plan, so a human can still veto it on the queue.
- **Nothing qualifies** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
