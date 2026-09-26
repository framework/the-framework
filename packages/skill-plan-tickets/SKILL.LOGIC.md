The `plan-tickets` command skill: the prompt of the agent a runner starts for queueing a plan for the open tickets that have none or an outdated one, as a skill file the coding agent's harness expands from `/plan-tickets`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/plan-tickets` every few hours, only while a ticket needs a plan and is not asked for. The agent reads every open ticket as listed, picks up to ten that need a plan by the ticket's priority and date, and puts one plan ask per ticket on the agent queue, the sentence `Create tickets/<name>.plan.md` at the ticket's priority. It writes no plan itself; the queued work does.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, in numbers, which an unattended agent cannot infer from the skills alone and two runs read the same way. Where the job is broken without a capability, the skill says so in capability words and stops. The schedule's check that starts a run applies the same rule from the ticket rows and the queue alone, less the cap of ten: whether a plan exists, its outdated mark, the claim, the pull request, the waiting line, and whether the queue names the ticket; nothing in the rule needs a ticket opened.

## Business logic — TL;DR

- **Capabilities first** - with no ticketing system or no AI queue, it shows an error to the user saying which and stops, before reading anything; in capability words, naming no skill.
- **Nobody answers** - the agent never asks and decides by itself.
- **The listing decides** - the agent reads the open tickets as listed, and the queue, and opens no ticket; what a ticket needs, and in which order, is read off its row.
- **Needs a plan** - the listing shows no plan, or shows the plan outdated.
- **Skipped** - a ticket its listing shows locked (held by someone), with a pull request (in review), waiting (what it waits on named on it), or already on the queue: any entry, in any wording, with the ticket's file without `.md` anywhere in it, so a plan ask and a link to the ticket both count. The match is on text, so an entry for `<name>-more` also skips the ticket `<name>`, in the skill and the check alike; an entry for `<name>` never skips `<name>-more`.
- **At most ten a run** - highest priority first, then oldest date first, then by the listing's file name, `.md` included, A to Z (`<name>-more.md` before `<name>.md`), so two runs keep the same ten in the same order; the rest wait for the next run. A ticket's priority is its own when that is a bare whole number from 0 to 10, else 5, the tickets skill's rule; the queue takes only 0 to 10.
- **The plan ask** - the plain sentence `Create tickets/<name>.plan.md`, `<name>` the ticket's file without `.md`, not a link to the ticket (a link asks for the ticket's work, not its plan), at the ticket's priority, queued one by one in that order; an entry lands at the end of its priority section, so the order of the writes is the order of work within a priority.
- **A failed write** - a queue write that fails ends the run with an error to the user naming the ticket and the reason; the remaining tickets are left for the next run. The skill adds no retry of its own: the queue's command already tries a lost write once more by itself.
- **Only queue** - the queue is the only thing it changes; it writes no plan itself.
- **Nothing to queue** - no ticket needs a plan, or every one is skipped: it says so and stops.
- **The last word** - a run that queued ends naming each entry it queued with its priority, each ticket it skipped and why, and how many wait for the next run, so the run's record in the logs says what it did.
