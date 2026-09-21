Shows the tickets of every project that has this package on one page, the widget's Tickets page at `/tickets`: one backlog across projects, filtered, sorted and grouped by a view that lives in the page's address, with two heading buttons that hand every shown ticket (or every selected one), as a link [8], to the actions the installed widgets [9] offer on links ("Add to queue" when a project has the queue package), either the ticket itself or the ask for its plan, and with each row offering to open the ticket, its plan, or the agent holding it, and to start an agent [1] on it.

## Context

**User story**: the user wants to see the whole backlog at once, not one project at a time: which ticket anywhere is the most urgent, which ones have no plan yet, which ones an agent already holds. From that view the user narrows the list, shares the narrowed list by copying the address, and hands the shown tickets to the agents in bulk instead of queueing them one by one.

**Business logic story**: the tickets themselves are markdown files under `tickets/` on each project's `agent-data` branch [3]; this page reads them with the `tickets` command's `list --local` (this machine's copy of the branch, no fetch), run by the dashboard in each project that has the package, and what the user sees is a projection of those files. The run behind each claim comes from the dashboard's own list of the project's runs, matched by the id the claim names. What a single row shows is described in `TicketsPanel.tsx`; the filter, sort and address rules are in `lib/ticket-filter.ts`; the filter controls are `TicketFilterBar.tsx`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry. The dashboard labels it "AI queue".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[8] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target and a priority from 0 to 10.
[9] widget: a browser module one of a project's packages brings to the dashboard; it adds pages, offers actions on the links pages show, and acts through its own package's command.
[4] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[5] holder: who a claim names: the agent's id when the tool that started the agent put it in the agent's environment, else the branch the `tickets` command ran on.
[6] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[7] the Overview: the dashboard's cross-project page at `/`.
[10] launcher: the Start form on a project's own page (its project home).

## Business logic — TL;DR

- **One backlog across projects** - the page reads every project's tickets with `tickets list --local`, refreshes them every 10 seconds, and heads the list with "Tickets" and a shown/total count; a project whose command fails is named with the reason, and the others still show.
- **The view lives in the address** - filters, sort and grouping are read from the page's address on opening and written back to it on every change, without adding browser history.
- **Filtering and click-to-filter** - the filter bar narrows the rows; a row's topic badge adds its topic to the filter and a row's claim marker narrows to claimed tickets.
- **Grouped by project or one flat list** - by default one section per project, each a project panel; in flat mode one cross-project list whose rows carry their project name, with its own hidden-count notice and empty messages.
- **Selecting rows** - ticked rows narrow the heading's queue buttons to the selection, with an "N selected" readout and "Clear selection"; a selected row the filters hide does not count.
- **Add the shown tickets** - one button per link action the installed widgets offer ("Add to queue: all N tickets shown below") hands every shown, or selected, unclaimed ticket as a link to the action (what is already queued is the action's own to skip), and then reads "Queued".
- **Add plans for the unplanned ones** - a second button per action ("Add to queue: plans for all N tickets shown below") hands the plan ask for every shown, or selected, ticket that is neither planned nor claimed, and then reads "Queued"; without any widget offering an action on links, neither button exists.
- **Starting an agent from a row** - a row starts a planning agent or a work agent on the ticket's own project, or sends the user to that project's launcher to configure first; the agent holding a claim opens from the row.

## Business logic

### One backlog across projects

#### Context

See `## Context`.

#### Business logic

The page reads the tickets of every registered project, one group per project with the project's name, and re-reads them every 10 seconds, so a ticket an agent [1] writes, claims or closes appears without reloading the page. A read that fails keeps what was last shown.

The heading reads "Tickets". Once the first read has succeeded and at least one ticket exists anywhere, the heading carries a count of the form `shown/total` (for example `12/40`): the number of tickets the current filters show over the number of tickets in every project. With no filter active it reads `n/n`, which is the only place the page states the backlog's total. Under the heading: "Every project's `tickets/` backlog — what the agent plans from."

Before the first read succeeds the list area reads "Loading…". When no project has the package it reads "No project has the tickets package."

### The view lives in the address

#### Context

**Problem**: a narrowed list is something the user wants to come back to and to hand to someone else. If the filters were page state only, opening a ticket and returning, reloading, or sharing the address would all lose them.

#### Business logic

The page's viewing state is one value: the filters, the sort (key and direction), and the grouping (by project or flat). On opening, the page reads it from the address's query string, and anything the query string does not say takes its default (no filter, newest first, grouped by project). The parsing and formatting rules, and which tokens the query string accepts, are in `lib/ticket-filter.ts`.

Every change to the view rewrites the address in place: the address is replaced, not navigated to, so the browser's Back button steps over filter changes rather than through them, and the address stays copyable. Defaults are left out of the query string, so an untouched page stays at `/tickets`.

"Clear filters" resets the filters only; the sort and the grouping are a viewing preference and stay.

### Filtering and click-to-filter

#### Context

See `## Context`.

#### Business logic

The filter bar (`TicketFilterBar.tsx`) sits under the heading and edits the view's filters; the rows it hides are decided by the rules in `lib/ticket-filter.ts`. The bar is offered the projects' names and every ticket, so its option counts reflect the whole backlog.

Two parts of a row filter on click, additively, so clicking a second one widens the selection instead of replacing it:
- A row's topic badge adds that topic to the topic filter. The topic is lowercased on the way in, the one casing the filters hold, so a badge reading `UX` filters like `ux`. A topic already in the filter is not added twice.
- A row's claim marker adds "claimed" to the planning-stage filter, narrowing the list to tickets an agent holds. It is added once.

### Grouped by project or one flat list

#### Context

**User story**: grouped by project, the user reads each project's backlog as its own table, with that project's tickets update at hand. The flat list is the one view that answers "what is the single highest-priority ticket anywhere", since it orders every project's tickets as one pool.

#### Business logic

By default the page groups by project: one section per project, headed by the project's name, containing a project panel (`TicketsPanel.tsx`) with that project's shown tickets in the view's sort order. Each section is told how many of its own tickets the filters hide and, while any filter is active, given a way to clear the filters; how it shows both is the panel's business. A section is rendered for every project, even one with no tickets. A project deselected in the filter bar's project facet disappears entirely rather than staying as an empty section, since hiding it was the user's choice.

In flat mode (the address carries `group=none`), every shown ticket of every project is one list sorted as a single pool, and each row carries its project's name. No per-project import bar appears in flat mode; updating the tickets belongs to the project sections. Above the flat list, when a filter is active and hides at least one ticket: "N ticket hidden by the current filters." (or "N tickets …") with a "Clear filters" button. A flat list with nothing to show reads "No tickets in any project yet — group by project to import a project's issues." when no project has any ticket at all, and "No tickets match." otherwise.

Whichever mode, rows are ordered by the view's sort: by date, priority, title or effort, in the chosen direction, with tickets missing the sorted value last in both directions and ties broken newest first (rules in `lib/ticket-filter.ts`).

### Selecting rows

#### Context

**Problem**: the heading's queue buttons act on the whole shown list. The user often wants a few of the shown tickets, and expressing "these three" through filters alone is not possible.

#### Business logic

Every row can be ticked. A ticked row is remembered by its project and its file name together, because two projects can each have a ticket of the same name. Only ticked rows that are currently shown count: a ticked ticket the filters hide is neither counted nor acted on, and counts again as soon as its row is shown again. A ticked ticket that disappears from the backlog is simply never matched.

While at least one shown row is ticked, the heading shows "N selected" and a "Clear selection" button that unticks everything, and both queue buttons act on the ticked rows instead of the whole shown list.

### Add the shown tickets

#### Context

**User story**: the user has narrowed the list to what should be worked next and wants all of it on the agents' to-do list, without opening each ticket. Nothing starts right away: what is queued is worked later, one entry at a time, by the user from the Overview's [7] queue card.

**Problem**: the queue is a package a project may or may not have: the page must offer it without naming it, and knows nothing of what it holds.

#### Business logic

The button's set is the shown rows, in the order shown, narrowed to the ticked rows while any is ticked, minus every claimed [4] ticket: a ticket an agent [1] holds is being worked, and its entry would outlive that work as noise on the agent queue [2].

The buttons are the dashboard's slot for the installed widgets' [9] link actions, given the projects of the set: one button per action whose package at least one of those projects has, none when no widget offers an action on links. A button appears only once the tickets are loaded and the set is not empty; an empty set, or one that is all claimed, is not an offer. Its text is the action's own label, then the set: it counts exactly what a click adds and stops saying "all" as soon as a claimed ticket is skipped. With the queue package's "Add to queue":
- Without a selection: "Add to queue: all N tickets shown below"; "Add to queue: the N unclaimed tickets shown below" when claimed tickets were skipped; for a single ticket "Add to queue: the ticket shown below" or "Add to queue: the one unclaimed ticket shown below".
- With a selection: "Add to queue: the N selected tickets"; "Add to queue: the N unclaimed selected tickets" when claimed tickets were skipped; for a single ticket "Add to queue: the selected ticket" or "Add to queue: the one unclaimed selected ticket".

Its tooltip reads "Every ticket joins the queue — the work the framework picks up on its own, worked highest priority first and, within a priority, in the order shown below. A ticket already queued stays as it is." ("Every selected ticket …" with a selection, followed by "The rest of the shown set stays put."). When one claimed ticket was skipped it adds "The claimed ticket shown is left to the agent holding it." (or "… selected …"); when several were, "The N claimed tickets shown are left to the agents holding them."

A click walks the set in the shown order, and every ticket becomes a link [8]: its title, pointing at its file, at the priority its `Priority:` earns on the 0–10 scale, 5 when it has none (`src/widget.ts`). What is already queued is not this page's to know: the action leaves it as it is. The links are grouped by project, in order of first appearance, and the slot hands each group to the action in that project; a project that lacks the action's package is skipped. The queue package's action writes each link as one entry of that project's queue, in the section its priority earns. The action stops at the first failure, whose reason appears as an alert line beside the buttons; everything added before it stays.

After a successful click the button reads "Queued" with a check mark and is disabled; it is armed again the moment the set it acted on changes, whether by a filter, by a refresh bringing new tickets, or by a selection (the slot's rule, keyed by the set). The button is also disabled while any action on the page is in progress.

### Add plans for the unplanned ones

#### Context

**User story**: before implementing, the user wants each unplanned ticket to receive a plan [6]. The project's `plan-tickets` command queues one plan ask per ticket; this button queues the same ask for the tickets shown, so a draining agent reaching the entry writes the plan.

#### Business logic

The button's set is the same as the ticket button's, further narrowed to tickets that have no plan yet. It is the same slot, one button per link action, none without a widget offering one, and appears only once the tickets are loaded and the set is not empty. Its text is the action's label, then the set: it counts what a click adds, and says "unplanned" as soon as the count is below the tally of the shown or selected set, that is whenever a ticket of the set is skipped as planned or as claimed. With "Add to queue":
- Without a selection: "Add to queue: plans for all N tickets shown below"; "Add to queue: plans for the N unplanned tickets shown below" when some were skipped; for a single ticket "Add to queue: a plan for the ticket shown below" or "Add to queue: a plan for the one unplanned ticket shown below".
- With a selection: "Add to queue: plans for the N selected tickets"; "Add to queue: plans for the N unplanned selected tickets" when some were skipped; for a single ticket "Add to queue: a plan for the selected ticket" or "Add to queue: a plan for the one unplanned selected ticket".

Its tooltip reads "Each ticket gets its plan asked for — the same "Create tickets/….plan.md" entry the plan-tickets command queues — worked highest priority first and, within a priority, in the order shown below. Tickets already planned or held by an agent stay as they are, and what is already there is left alone." ("Each selected ticket …" and "The rest of the shown set stays put." with a selection).

A click walks the set in the shown order, and every ticket becomes a link [8] with no target: the plan ask's sentence at the ticket's priority (no target on purpose: a link to a ticket at the start of an entry reads as "queued for implementation", and a plan ask must not). Grouped by project and handed to the action as above, the queue package's action writes each as one entry placed by that priority. The action stops at the first failure, whose reason appears beside the buttons; what was added stays.

After success the button reads "Queued" with a check mark and is disabled until the set it acted on changes. It is disabled while any action on the page is in progress.

### Starting an agent from a row

#### Context

**User story**: from a row the user starts an agent [1] on that ticket right away, in the ticket's own project, or goes to that project's launcher [10] to adjust driver, model or location first. A ticket an agent already holds shows who, and leads to that agent's page.

#### Business logic

What a row shows, including its plan column, its start controls and how a claim [4] names its holder [5], is described in `TicketsPanel.tsx`. This page wires the row's actions, in flat mode directly and in grouped mode through each project's panel, always against the row's own project:
- Opening a row opens the ticket's own page, `/tickets/<project>/<file>`; the plan column's link opens the ticket's plan view, `/tickets/<project>/<file>/plan`. Both are the widget's own pages, addressed by project and ticket file.
- "Start a plan" from a row starts an agent on the ticket's project with the prompt `Create tickets/<stem>.plan.md`. When the agent could not be started, the dashboard's reason, or "The planning agent could not be started." when it gives none, appears above the filter bar.
- "Start work" from a row starts an agent on the ticket's project; the prompt's wording is in `TicketsPanel.tsx`. Failure shows the dashboard's reason or "The work agent could not be started.".
- Every "Configure first, then run" on this page asks the dashboard to open the row's own project's launcher with the row's prompt drafted in.
- On a claimed row, the holder's name links to the holding agent's page in the ticket's project, when the holder is one of that project's agents.

The dashboard starts the run with the user's own picks and lands on it. While any of these actions is in progress the page's rows are marked busy and the heading's queue buttons are disabled; a failure message stays until the next action starts.
