The Hot tickets card on the dashboard's Overview: across every project that has this package, the tickets an agent [1] holds and the unclaimed tickets flagged high priority, nothing else. A row opens the ticket's page, a claim opens the run holding it, and beside every row sit the actions other widgets offer on the ticket as a link [2].

## Context

**User story**: on the Overview the user sees at a glance which tickets agents are working (planning or implementing) and who holds each, and which tickets nobody holds but are flagged to do soon; a click opens the ticket, another opens the run holding it, and, where the project has the queue package, "Add to queue" beside a row queues that ticket.

**Business logic story**: the card reads `tickets list --local` in every project, the list an agent reads, and the project's runs from the dashboard, to name a claim's holder as a run. Which lane a ticket sits in is the rule in `src/widget.ts`. The card names no queue: what a row offers beyond opening is whatever the installed widgets offer on links, which the dashboard draws beside the row.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. The dashboard also calls one "a run".
[2] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository) and an optional priority from 0 to 10; the dashboard puts beside it whatever verbs the installed widgets offer on links ("Add to queue" when the project has the queue package).

## Business logic — TL;DR

- **The read** - `tickets list --local` and the project's runs, in every project that has the package, all projects at once, again every 30 seconds; a project whose command fails is named with the command's reason and the others still show.
- **The two lanes** - "Claimed": every ticket an agent holds, with the holder; "High priority": every unclaimed ticket at priority 7 or up, with its priority; every other ticket is off the card; an empty lane dims to its header; "Nothing claimed or high priority." when both are empty.
- **A row** - the ticket's title (its summary on hover) opens the ticket's own page; a holder that is one of the project's runs is named by the run's name, or its id, and opens the run, any other holder is shown as written; the project's name; then the actions the installed widgets offer on the ticket as a link.

## Business logic

### The read

#### Context

See `## Context`.

#### Business logic

For each project the dashboard lists as having this package, the card asks the dashboard to run `tickets list --local` in that project and, on the same beat, for the project's runs; every project is read at once, and again every 30 seconds. A project whose command fails, or prints something that is not a list, shows a red line "Could not read the tickets of `<project>`: `<reason>`" at the top of the card, and the other projects still show. Until the first read has answered the card says "Loading…".

### The two lanes

#### Context

**User story**: the card is a shortlist, not the backlog: what is under way, and what a person would likely start next.

#### Business logic

Each ticket is placed by the rule in `src/widget.ts`: a claimed ticket in "Claimed", an unclaimed one whose priority reads 7 or more in "High priority", and every other ticket is left off. The two lanes are stacked, "Claimed" first, each headed by its name and its count; a lane with nothing dims to its header line so the populated lane carries the card. Every ticket in a lane is shown, never a "+N more". A ticket in review or waiting is never in "High priority", nobody can start it; claimed, it stays in "Claimed" and its row offers no link action. When both lanes are empty the card says "Nothing claimed or high priority.", not "no tickets": the backlog may be full.

### A row

#### Context

See `## Context`.

#### Business logic

A row shows the ticket's title, with its summary (or its title again) on hover; a click opens the ticket's own page in this widget (`/tickets/<project>/<file>`). In the "Claimed" lane the row names the holder: when the claim names one of the project's runs, the run's name (its id until it has one), and a click opens that run's page; any other holder is shown as the claim wrote it and opens nothing. In the "High priority" lane the row shows the ticket's priority instead. Then the project's name, only when more than one project has the package, and the actions the installed widgets offer on links, given the ticket as a link (its title, pointing at `tickets/<file>`, at its own priority) in its own project: "Add to queue" where the project has the queue package, nothing where it does not.
