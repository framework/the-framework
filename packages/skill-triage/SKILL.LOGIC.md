The `triage` command skill: the prompt of the agent a runner starts for putting the tickets whose plan says they are ready on the project's agent queue, as a skill file the coding agent's harness expands from `/triage`, `/triage quick` or `/triage consensual`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage quick` every few hours and `/triage consensual` once a week, each only while a ticket meets its rule and is not queued. The agent reads every open ticket with its plan's effort and uncertainty, picks the ones the mode's rule names, puts each on the agent queue as a link to the ticket at the ticket's priority, and stops. A person types `/triage` and gets both modes in one pass, a run the runner files under `triage` alone, counted against neither mode's line. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, in numbers, which an unattended agent cannot infer from the skills alone and two runs read the same way. Where the job is broken without a capability, the skill says so in capability words and stops. The schedule's check that starts a mode's run applies the same rule from the ticket rows alone: the numbers, the queue, the claim, the pull request and the plan's outdated mark; nothing in the rule needs a plan opened.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The mode** - the word after the command: `quick`, `consensual`, or nothing for both; any other word, the agent says so and stops.
- **Only planned tickets with both numbers** - a ticket without a plan, or whose listing gives no effort or no uncertainty, qualifies for nothing, in either mode; the numbers are the listing's, no plan is opened, so a rating the listing could not read (`Effort: 2 (maybe 3)`) is no rating.
- **A quick win** - effort 2 or less and uncertainty 2 or less.
- **Consensual work** - uncertainty 3 or less and not a quick win.
- **Skipped** - a ticket already on the queue (an entry linking to it), held by someone, in review (a pull request named on it), or whose plan is outdated.
- **Queueing** - each remaining ticket goes on the agent queue one by one, lowest effort first, as a link to the ticket labeled with its title, at the ticket's priority, 5 when it has none or it is not a number from 0 to 10, in either mode and in one pass when both modes run; an entry lands at the end of its priority section, so the order of the writes is the order of work within a priority.
- **A failed write** - a queue write that fails is tried once more after reading the queue again, a ticket the new reading shows queued left alone; a write that fails again ends the run with the failure said, the remaining tickets left for the next run.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however small or clear its plan, so a human can still veto it on the queue.
- **Nothing qualifies** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
