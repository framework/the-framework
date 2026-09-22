The `triage` command skill: the prompt of the agent a runner starts for putting the tickets whose plan says they are ready on the project's agent queue, as a skill file the coding agent's harness expands from `/triage`, `/triage quick` or `/triage consensual`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage quick` every few hours and `/triage consensual` once a week, each only while a ticket meets its rule and is not queued. The agent reads every open ticket with its plan's effort and uncertainty, picks the ones the mode's rule names, puts each on the agent queue as a link to the ticket with the mode's priority, and stops. A person types `/triage` and gets both modes in one pass. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, in numbers, which an unattended agent cannot infer from the skills alone and two runs read the same way. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The mode** - the word after the command: `quick`, `consensual`, or nothing for both.
- **Only planned tickets** - a ticket without a plan never qualifies, in either mode.
- **A quick win** - effort 2 or less and uncertainty 2 or less.
- **Consensual work** - uncertainty 3 or less and not a quick win.
- **Skipped** - a ticket already on the queue, held by someone, in review (a pull request named on it), or whose plan records a decision not to do the work.
- **Queueing** - each picked ticket goes on the agent queue as a link to the ticket labeled with its title; a quick win one above the ticket's priority (6 when it has none, never above 10), so it is worked before equal work; consensual work at the ticket's priority, 5 when it has none.
- **A rejected write** - a write to the queue rejected because someone else wrote first is tried once more after reading again; a ticket the new reading shows queued is left alone.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however small or clear its plan, so a human can still veto it on the queue.
- **Nothing qualifies** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
