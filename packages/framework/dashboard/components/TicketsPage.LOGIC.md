Shows every registered project's tickets on one page, the dashboard's Tickets view at `/tickets`: one backlog across projects, filtered, sorted and grouped by a view that lives in the page's address, with two heading buttons that put every shown ticket (or every selected one) on its project's agent queue [2], either to be implemented or to be planned, and with each row offering to open the ticket, its plan, or the agent holding it, and to start an agent [1] on it.

## Context

**User story**: the user wants to see the whole backlog at once, not one project at a time: which ticket anywhere is the most urgent, which ones have no plan yet, which ones an agent already holds. From that view the user narrows the list, shares the narrowed list by copying the address, and hands the shown tickets to the agents in bulk instead of queueing them one by one.

**Business logic story**: the tickets themselves are markdown files under `tickets/` on each project's `agent-data` branch [3]; this page only reads what the daemon reports for every project and what the user sees is a projection of those files. What a single row shows is described in `TicketsPanel.tsx`; the filter, sort and address rules are in `lib/ticket-filter.ts`; the filter controls are `TicketFilterBar.tsx`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry. The dashboard labels it "AI queue".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[5] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[6] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[7] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[8] the Overview: the dashboard's cross-project page at `/`.
[9] prompt agent: an agent that runs one prompt and stops there.
[10] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[11] launcher: the Start form on a project's own page (its project home).

## Business logic — TL;DR

- **One backlog across projects** - the page reads every project's tickets, refreshes them every 10 seconds, and heads the list with "Tickets" and a shown/total count.
- **The view lives in the address** - filters, sort and grouping are read from the page's address on opening and written back to it on every change, without adding browser history.
- **Filtering and click-to-filter** - the filter bar narrows the rows; a row's topic badge adds its topic to the filter and a row's claim marker narrows to claimed tickets.
- **Grouped by project or one flat list** - by default one section per project, each a project panel; in flat mode one cross-project list whose rows carry their project name, with its own hidden-count notice and empty messages.
- **Selecting rows** - ticked rows narrow the heading's queue buttons to the selection, with an "N selected" readout and "Clear selection"; a selected row the filters hide does not count.
- **Queue the shown tickets** - the "Add … to the AI queue" button puts every shown, or selected, unclaimed ticket on its project's agent queue, skipping what is already queued, and then reads "Queued".
- **Queue plans for the unplanned ones** - the "Queue a plan …" button queues the plan ask for every shown, or selected, ticket that is neither planned, claimed nor already queued, and then reads "Plans queued".
- **Starting an agent from a row** - a row starts an attended planning agent or an unattended work agent on the ticket's own project, or sends the user to that project's launcher to configure first; the agent holding a claim opens from the row.

## Business logic

### One backlog across projects

#### Context

See `## Context`.

#### Business logic

The page reads the tickets of every registered project, one group per project with the project's name, and re-reads them every 10 seconds, so a ticket an agent [1] writes, claims or closes appears without reloading the page. A read that fails keeps what was last shown.

The heading reads "Tickets". Once the first read has succeeded and at least one ticket exists anywhere, the heading carries a count of the form `shown/total` (for example `12/40`): the number of tickets the current filters show over the number of tickets in every project. With no filter active it reads `n/n`, which is the only place the page states the backlog's total. Under the heading: "Every project's `tickets/` backlog — what the agent plans from."

Before the first read succeeds the list area reads "Loading…". When no project is registered it reads "No projects registered yet."

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

**User story**: grouped by project, the user reads each project's backlog as its own table, with that project's import from GitHub at hand. The flat list is the one view that answers "what is the single highest-priority ticket anywhere", since it orders every project's tickets as one pool.

#### Business logic

By default the page groups by project: one section per project, headed by the project's name, containing a project panel (`TicketsPanel.tsx`) with that project's shown tickets in the view's sort order. Each section is told how many of its own tickets the filters hide and, while any filter is active, given a way to clear the filters; how it shows both is the panel's business. A section is rendered for every project, even one with no tickets. A project deselected in the filter bar's project facet disappears entirely rather than staying as an empty section, since hiding it was the user's choice.

In flat mode (the address carries `group=none`), every shown ticket of every project is one list sorted as a single pool, and each row carries its project's name. No per-project import bar appears in flat mode; importing from GitHub belongs to the project sections. Above the flat list, when a filter is active and hides at least one ticket: "N ticket hidden by the current filters." (or "N tickets …") with a "Clear filters" button. A flat list with nothing to show reads "No tickets in any project yet — group by project to import from GitHub." when no project has any ticket at all, and "No tickets match." otherwise.

Whichever mode, rows are ordered by the view's sort: by date, priority, title or effort, in the chosen direction, with tickets missing the sorted value last in both directions and ties broken newest first (rules in `lib/ticket-filter.ts`).

### Selecting rows

#### Context

**Problem**: the heading's queue buttons act on the whole shown list. The user often wants a few of the shown tickets, and expressing "these three" through filters alone is not possible.

#### Business logic

Every row can be ticked. A ticked row is remembered by its project and its file name together, because two projects can each have a ticket of the same name. Only ticked rows that are currently shown count: a ticked ticket the filters hide is neither counted nor acted on, and counts again as soon as its row is shown again. A ticked ticket that disappears from the backlog is simply never matched.

While at least one shown row is ticked, the heading shows "N selected" and a "Clear selection" button that unticks everything, and both queue buttons act on the ticked rows instead of the whole shown list.

### Queue the shown tickets

#### Context

**User story**: the user has narrowed the list to what should be worked next and wants all of it on the agents' to-do list, without opening each ticket. Nothing starts right away: what is queued is worked later by Auto PM [7] or by the user from the Overview's [8] queue card, one entry at a time.

**Problem**: a ticket queued twice would leave an open entry naming a closed ticket after the first entry is worked off, and that stray entry costs an agent. So "add" means "make sure it is queued", never "append".

#### Business logic

The button's set is the shown rows, in the order shown, narrowed to the ticked rows while any is ticked, minus every claimed [4] ticket: a ticket an agent [1] holds is being worked, and its entry would outlive that work as noise on the agent queue [2].

The button appears only once the tickets are loaded and the set is not empty; an empty set, or one that is all claimed, is not an offer. Its label counts exactly what a click adds and stops saying "all" as soon as a claimed ticket is skipped:
- Without a selection: "Add all N tickets shown below to the AI queue"; "Add the N unclaimed tickets shown below to the AI queue" when claimed tickets were skipped; for a single ticket "Add the ticket shown below to the AI queue" or "Add the one unclaimed ticket shown below to the AI queue".
- With a selection: "Add the N selected tickets to the AI queue"; "Add the N unclaimed selected tickets to the AI queue" when claimed tickets were skipped; for a single ticket "Add the selected ticket to the AI queue" or "Add the one unclaimed selected ticket to the AI queue".

Its tooltip reads "Every ticket joins the AI queue — the work the framework picks up on its own, worked highest priority first and, within a priority, in the order shown below. A ticket already queued stays as it is." ("Every selected ticket …" with a selection, followed by "The rest of the shown set stays put."). When one claimed ticket was skipped it adds "The claimed ticket shown is left to the agent holding it." (or "… selected …"); when several were, "The N claimed tickets shown are left to the agents holding them."

A click first reads every project's agent queue as it is at that moment and notes, per project, which tickets an open entry already links to. Then, walking the set in the shown order, each ticket already linked from an open entry of its own project's queue is left alone, and every other ticket is added to its own project's agent queue as one entry: the ticket's title, linked back to the ticket file, placed by the ticket's `Priority:` when it has one (the daemon's placement rule for a ticket without one is in `src/dashboard-rpc/control.ts`). Each entry lands on the queue of the ticket's own project, so a cross-project list needs no special handling. The walk stops at the first failure: the daemon's own reason, or "The tickets could not be queued." when it gives none, appears in red above the filter bar, and everything queued before the failure stays queued.

After a successful click the button reads "Queued" with a check mark and is disabled; it is armed again the moment the set it acted on changes, whether by a filter, by a refresh bringing new tickets, or by a selection. The button is also disabled while any action on the page is in progress.

### Queue plans for the unplanned ones

#### Context

**User story**: before implementing, the user wants each unplanned ticket to receive a plan [6]. The "Plan tickets" preset queues one plan ask per ticket; this button queues the same ask for the tickets shown, so a draining agent reaching the entry writes the plan.

#### Business logic

The button's set is the same as the ticket-queue button's, further narrowed to tickets that have no plan yet. It appears only once the tickets are loaded and the set is not empty. Its label counts what a click adds, and says "unplanned" as soon as the count is below the tally of the shown or selected set, that is whenever a ticket of the set is skipped as planned or as claimed:
- Without a selection: "Queue plans for all N tickets shown below"; "Queue plans for the N unplanned tickets shown below" when some were skipped; for a single ticket "Queue a plan for the ticket shown below" or "Queue a plan for the one unplanned ticket shown below".
- With a selection: "Queue plans for the N selected tickets"; "Queue plans for the N unplanned selected tickets" when some were skipped; for a single ticket "Queue a plan for the selected ticket" or "Queue a plan for the one unplanned selected ticket".

Its tooltip reads "Each ticket gets its plan asked for on the AI queue — the same "Create tickets/….plan.md" entry the Plan tickets preset queues — worked highest priority first and, within a priority, in the order shown below. Tickets already planned, already queued, or held by an agent stay as they are." ("Each selected ticket …" and "The rest of the shown set stays put." with a selection).

A click reads every project's agent queue [2] at that moment, noting per project the exact text of every open entry and the tickets open entries link to. Walking the set in the shown order, a ticket is skipped when its project's queue already holds an open entry with the exact plan ask text, `Create tickets/<stem>.plan.md`, and also when the ticket is already queued for implementation, since that work would land before a trailing plan could matter. Every other ticket gets that plan ask added to its own project's agent queue, placed by the ticket's `Priority:` when it has one. The walk stops at the first failure: the daemon's reason, or "The plans could not be queued." when it gives none, appears above the filter bar, and what was queued stays.

After success the button reads "Plans queued" with a check mark and is disabled until the set it acted on changes. It is disabled while any action on the page is in progress.

### Starting an agent from a row

#### Context

**User story**: from a row the user starts an agent [1] on that ticket right away, in the ticket's own project, or goes to that project's launcher [11] to adjust driver, model or location first. A ticket an agent already holds shows who, and leads to that agent's page.

#### Business logic

What a row shows, including its plan column, its start controls and how a claim [4] names its holder [5], is described in `TicketsPanel.tsx`. This page wires the row's actions, in flat mode directly and in grouped mode through each project's panel, always against the row's own project:
- Opening a row opens the ticket's own page; the plan column's link opens the ticket's plan view. Both are addressed by project and ticket file.
- "Start a plan" from a row starts an attended prompt agent [9] on the ticket's project with the prompt `Create tickets/<stem>.plan.md`. When the agent could not be started, the daemon's reason, or "The planning agent could not be started." when it gives none, appears above the filter bar.
- "Start work" from a row starts a prompt agent on the ticket's project, unattended [10], with the ticket named on the agent as `tickets/<file>` so the daemon claims the ticket for it; the prompt's wording is in `TicketsPanel.tsx`. Failure shows the daemon's reason or "The work agent could not be started.".
- Every "Configure first, then run" on this page selects the row's own project, landing on that project's launcher.
- On a claimed row, the holder's name links to the holding agent's page in the ticket's project, when the holder is one of that project's agents.

When an agent starts, the dashboard's shell is told which project started it, with what prompt and which agent id, so it can show the new agent. While any of these actions is in progress the page's rows are marked busy and the heading's queue buttons are disabled; a failure message stays until the next action starts.
