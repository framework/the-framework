The rules of the package's dashboard widget [1] (`../dashboard/`), kept apart from React so they are tested like the rest of the package: the sentences the widget's pages start agents [2] with, how a page finds the run behind a claim [3] or a plan, how the widget's address reads, what a ticket is as a link [4], and how the `tickets` command's answers are read back.

## Context

**User story**: from the dashboard's Tickets page the user starts an agent on a ticket, or asks for its plan, with the one sentence every surface uses; sees who holds a claimed ticket as that run's name, and opens the run; opens a ticket's page by its address and comes back to it later; and hands a ticket to whatever another widget offers on a link, at the ticket's own priority.

**Business logic story**: the pages know the dashboard only through its host: a command run in a project, a run started, the project's runs. These rules turn what the host answers into what the pages show, and what the pages ask into command lines and prompts.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads and changes its data through its own package's command.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. The dashboard also calls one "a run".
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository) and an optional priority from 0 to 10; what other widgets' actions on links are given.

## Business logic — TL;DR

- **The prompts** - `Create tickets/<stem>.plan.md` asks for a ticket's plan; `Work on tickets/<file>. Do not start any other ticket.` asks for its implementation; `/update-tickets` brings the tickets up to date with the tracker; a plan's path is `tickets/<stem>.plan.md`.
- **The run behind a plan** - the newest of the project's runs whose ask contains the plan's sentence; none when no run named it.
- **The run behind a claim** - the project's run whose id the claim names; none for any other holder.
- **The widget's address** - nothing after `/tickets` is the list; a project then a ticket's filename is that ticket's page; `plan` after those is its plan; anything else names no page.
- **A ticket as a link** - its title pointing at `tickets/<file>` at the priority its `Priority:` earns (5 when unreadable); a plan ask is the plan sentence pointing nowhere, at the same priority.
- **A ticket's lane on the Overview card** - claimed when an agent holds it, whatever its priority; high priority when nobody holds it and its `Priority:` reads 7 or more on the 0-10 scale; otherwise off the card.
- **Reading the command's answers** - `list` prints rows, kept when they carry the five plain facts; `show` prints one ticket with its text, its plan and its holder, or a refusal that reads as "no such ticket"; `meta` prints the last-import stamp; a command that could not run, or printed the wrong shape, is an error with its reason.
- **Held back from work** - a ticket with a `PR:` line is in review, one with a `Waiting:` line is waiting, in review first when both; the pages start no agent on it or on its plan, offer it to no queue, and keep it out of the high-priority lane.

## Business logic

### The prompts

#### Context

**Problem**: the same ask worded twice drifts, and a plan's author is found by the exact wording of the ask.

#### Business logic

The plan ask for a ticket is `Create tickets/<stem>.plan.md`, the ticket's name with `.md` replaced by `.plan.md`; the work ask is `Work on tickets/<file>. Do not start any other ticket.`; the update ask is the project's `/update-tickets` command. Each exists once, here, and every page uses it verbatim, as its button's start, as the launcher's draft and, for the plan ask, as the text a plan is queued as.

### The run behind a plan and the run behind a claim

#### Context

**User story**: the user reads a plan and wants to continue with the agent [2] that wrote it; the user sees a claimed ticket and wants to see the run holding it.

#### Business logic

Given the project's runs as the dashboard names them (an id, a session name when the run has one, what it was asked, its status, when it started), a plan's author is the newest run whose ask contains the plan ask for that ticket; a run that never named the plan is not the author, and a plan with no such run has none. A claim's [3] run is the run whose id equals the holder the claim names; a holder that is no run's id (another machine's run, a branch name) has none, and the pages show it as written.

### The widget's address

#### Context

The dashboard mounts the widget's page at `/tickets` and hands it the segments after that. A link to `tickets/<file>` in a project, wherever the dashboard shows one, opens `/tickets/<project>/<file>`.

#### Business logic

No segment is the list of every project's tickets. Two segments, a project and a filename that is a ticket's (a `.md` name with no path, not a plan's or a claim's), are that ticket's page. Three, the same followed by `plan`, are the ticket's plan. Anything else — a project alone, a name that is not a ticket's, another third word, more segments — names no page.

### A ticket as a link

#### Context

See `## Context`.

#### Business logic

The ticket itself as a link [4] is its title, pointing at `tickets/<file>`, at the priority its own `Priority:` earns on the 0–10 scale (5 when it has none or an unreadable one, the rule of `names.ts`). The ask for its plan as a link is the plan sentence with no target, at the same priority: deliberately not a link to the ticket, because a leading link to a ticket reads everywhere as "this ticket is queued for implementation", and a plan ask must not.

### Reading the command's answers

#### Context

The pages run the `tickets` command through the dashboard and get its JSON output, or the reason the command could not run.

#### Business logic

`list` answers rows: those of its output that carry a file, a title, a summary, a date and a planned flag are kept, anything else is dropped; an output that is not a list, or a command that could not run, is an error with the reason. `show` answers one ticket: its row with its whole text, its plan's text when it has one, its holder when claimed; a refusal (`ok: false`) reads as no such ticket; an output that is not a ticket, or a command that could not run, is an error with the reason. `meta` answers when the tickets last caught up with the tracker; on any failure nothing is known.

### Held back from work

#### Context

**User story**: a ticket whose pull request is open, or that waits on something outside the work, is not something a person starts or queues; the tickets skill tells an agent the same.

#### Business logic

A ticket whose row carries a pull request (its `PR:` line) is in review; one whose row carries a non-empty `Waiting:` text is waiting; a ticket with both is in review. The pages start no agent on a held-back ticket, nor on its plan, and offer it to no link action. An unclaimed held-back ticket is in no lane of the Overview card, whatever its priority: nobody can start it. A claimed one stays in "Claimed".

### A ticket's lane on the Overview card

#### Context

**User story**: the Overview's Hot tickets card is a shortlist: what agents hold, and what a person would likely start next.

#### Business logic

A ticket an agent holds (its claim exists) is in the "Claimed" lane, whatever its priority: work under way is the fact. An unclaimed ticket whose `Priority:` reads 7 or more is in the "High priority" lane: the ticket format's own 0-10 scale, where 10 acts immediately and 0 is only-if-capacity, so 7 and up read as "do this soon". A word (`high`, `urgent`, `p0`) is not on that scale and never qualifies, and neither does the P0-first reading. Every other ticket is in no lane and left off the card.
