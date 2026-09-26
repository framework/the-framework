The `triage` command skill: the prompt of the agent a runner starts for putting the tickets whose plan says they are ready on the project's agent queue, as a skill file the coding agent's harness expands from `/triage`, `/triage quick` or `/triage consensual`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/triage quick` every few hours and `/triage consensual` once a week, each only while a ticket meets its rule and is not queued. The agent reads every open ticket with its plan's effort and uncertainty, picks the ones the mode's rule names, puts each on the agent queue as a link to the ticket at the ticket's priority, and stops. A person types `/triage` and gets both modes in one pass, a run the runner files under `triage` alone, counted against neither mode's line. It implements nothing.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, in numbers, which an unattended agent cannot infer from the skills alone and two runs read the same way. Where the job is broken without a capability, the skill says so in capability words and stops. The schedule's check that starts a mode's run applies the same rule from the ticket rows and the queue alone: the numbers, the queue, the claim, the pull request, the waiting line and the plan's outdated mark; nothing in the rule needs a ticket opened.

## Business logic — TL;DR

- **The mode** - the word after the command: `quick`, `consensual`, or nothing for both; any other word, the agent says so and stops, as its first step.
- **Capabilities first** - with no ticketing system or no AI queue, it shows an error to the user saying which and stops, right after the mode word is read; in capability words, naming no skill.
- **Nobody answers** - the agent never asks and decides by itself.
- **The listing decides** - the agent reads the open tickets as listed, and the queue, and opens no ticket; when either read fails, it shows an error to the user saying which and why, and stops, so a run never queues from a queue it could not read.
- **Only planned tickets with both numbers** - a ticket without a plan, or whose listing gives no effort or no uncertainty, qualifies for nothing, in either mode; a rating the listing could not read (`Effort: 2 (maybe 3)`) is no rating.
- **A quick win** - effort 2 or less and uncertainty 2 or less.
- **Consensual work** - uncertainty 3 or less and not a quick win.
- **Skipped** - a ticket its listing shows locked (held by someone), in review (a pull request named on it), waiting (what it waits on named on it), or with its plan outdated, or with an entry on the queue that holds its file name, `.md` included. The match is on text, in the skill and the check alike: a link to the ticket counts; a plan ask (`Create tickets/<name>.plan.md`) does not, since it asks for a plan, not the work; and `.md` keeps a dated name from matching a longer one (`<name>.md` is not in `<name>-more.md`).
- **Queueing** - the rest go on the agent queue one by one, lowest effort first, the way the ticketing system queues a ticket: a link labeled with its title, at the ticket's priority; an entry lands at the end of its priority section, so the order of the writes is the order of work within a priority. The skill orders nothing further: tickets of equal effort go in whatever order the agent reads them.
- **A failed write** - a queue write that fails ends the run with an error to the user naming the ticket and the reason; that ticket and the rest are left for the next run. The skill adds no retry of its own: the queue's command already tries a lost write once more by itself.
- **Only queue, never do** - the queue is the only thing it changes; it implements no ticket however small or clear its plan, so a human can still veto it on the queue.
- **Nothing more** - the skill says nothing about a run with nothing to queue or about the run's closing words: an agent says what it queued and skipped without being told, as every rig run did.
