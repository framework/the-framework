The `triage` command skill: the prompt of the agent a runner starts for putting the tickets whose plan says they are ready on the project's agent queue, as a skill file the coding agent's harness expands from `/triage`, `/triage quick` or `/triage consensual`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage quick` every few hours and `/triage consensual` once a week, each only while a ticket meets its rule and is not queued. The agent reads every open ticket with its plan's effort and uncertainty, picks the ones the mode's rule names, puts each on the agent queue as a link to the ticket with the mode's priority, and stops. A person types `/triage` and gets both modes in one pass. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, in numbers, which an unattended agent cannot infer from the skills alone and two runs read the same way. Where the job is broken without a capability, the skill says so in capability words and stops. The schedule's check that starts a mode's run is a cheap pre-filter on the same numbers, the queue and the plan's outdated mark; the one skip it cannot test, a plan recording a decision not to do the work, is the agent's, read off the plan of each ticket the numbers pick.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The mode** - the word after the command: `quick`, `consensual`, or nothing for both; any other word, the agent says so and stops.
- **Only planned tickets with both numbers** - a ticket without a plan, or whose plan gives no effort or no uncertainty, qualifies for nothing, in either mode.
- **A quick win** - effort 2 or less and uncertainty 2 or less.
- **Consensual work** - uncertainty 3 or less and not a quick win.
- **Skipped** - a ticket already on the queue, held by someone, in review (a pull request named on it), or whose plan is outdated; then, read off the plan of each ticket the numbers pick, one whose plan records a decision not to do the work.
- **Queueing** - each remaining ticket goes on the agent queue as a link to the ticket labeled with its title, at the ticket's priority, 5 when it has none, in either mode.
- **A failed write** - a queue write that fails is tried once more after reading the queue again; a ticket the new reading shows queued is left alone.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however small or clear its plan, so a human can still veto it on the queue.
- **Nothing qualifies** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
