The dashboard's Tickets page: every registered project's `tickets/` backlog on one full-width page, filtered, sorted and either grouped per project or pooled into one cross-project list.

## User story

The user wants to see the whole backlog — not one project's slice of it — decide what to work next, and act on a ticket right there: read it, read its plan, have an agent plan it, or have an agent work it. And when the filters have carved out a coherent slice, they want to hand that whole slice to an agent at once.

## Business logic — TL;DR

- **Cross-project by default** - the page reads every registered project's tickets, re-read every ten seconds, and shows a shown/total tally beside its title.
- **The address is the view** - search, filters, sort and grouping are all carried in the page's address, so a view can be shared and reopened; changing them rewrites the address without adding a Back step.
- **Grouped or flat** - grouped shows one section per project, each with that project's own ticket panel; flat pools every project's tickets into one order, each row naming its project — the only view that can answer which ticket is the highest-priority one anywhere.
- **Click-to-filter** - clicking a row's topic adds that topic to the filter, clicking its claim marker narrows to claimed tickets; both add to what is already filtered rather than replacing it.
- **Plan it or work it from the row** - a ticket can be handed to a planning agent or to an unattended work agent without leaving the page.
- **Spin up the whole shown set** - a button beside the page's heading starts an unattended agent working exactly the tickets the filters show; a shown set spanning several projects fans out one agent per project, and the button's label counts the tickets and the agents one click costs.
- **Filtered-away tickets are accounted for** - the page says how many tickets the filters hide and offers to clear them; a project the user deselected disappears silently instead.

## Business logic

### Cross-project by default

#### User story

See `## User story`.

#### Business logic

The page reads the tickets of every registered project and re-reads them every ten seconds. Its heading carries how many tickets are shown out of how many exist; unfiltered that reads as the backlog's total, which the page states nowhere else. The tally appears only once the first read has landed and the backlog is non-empty. Below the heading the page explains what it lists: every project's `tickets/` backlog — what the agent plans from.

Before the first read the page says it is loading. With no project registered, it says so.

### The address is the view

#### User story

The user narrows the backlog down to something worth looking at and wants to keep or share that exact view.

#### Business logic

The page opens with whatever view the address carries, falling back to the defaults when there is none. Every change to search, filters, sort or grouping is written straight back into the address. The change replaces the current address rather than adding to the history, so the Back button steps over a filtering session instead of walking back through it one filter at a time.

### Grouped or flat

#### User story

See `## User story`.

#### Business logic

Grouped by project — the default — renders one section per project, headed by the project's name and holding that project's own tickets panel, with the page's sort applied inside each section. A project the user has deselected in the Project filter is dropped from the page entirely.

The flat list drops the sections: every project's tickets are sorted as one pool and each row names the project it came from. The per-project ticket-maintenance controls belong to the sections and are not offered in flat mode.

#### Rationale

A deselected project vanishes rather than showing an empty section saying "N hidden by filters": that would be noise about a choice the reader just made deliberately.

### Click-to-filter

#### User story

The user spots an interesting topic on one ticket and wants everything else carrying it.

#### Business logic

Clicking a topic on a ticket row adds that topic to the topic filter; clicking a second topic widens the filter to either topic rather than replacing the first. Clicking a ticket's claim marker narrows the page to claimed tickets. Both are no-ops when the filter already holds that clause.

### Plan it or work it from the row

#### User story

The user has decided a ticket is next and wants an agent on it now.

#### Business logic

Every ticket row offers to start a planning agent for that ticket, and to start an agent that works it. The work agent runs unattended with the ticket named on it, so the agent knows which ticket it is working. Both start in the project the ticket belongs to — in the flat list that is the row's own project, not a page-wide selection — and the dashboard shell is told an agent started so it can show it. A start that fails leaves a message on the page saying the planning agent or the work agent could not be started.

### Spin up the whole shown set

#### User story

The user narrows the backlog to a coherent slice — a topic, a priority band, one project — and wants an agent to sweep through everything left showing, rather than starting the rows one by one.

#### Business logic

Whenever at least one ticket is shown, the page's heading row offers a button that starts the whole shown set: an unattended agent told to work exactly the shown tickets — listed in the shown order — and to start nothing else. The set is exactly what the heading's shown tally counts, so the button never starts work on a ticket the reader cannot see below it. With nothing shown, the button is not offered.

An agent works inside one project, so when the shown set spans several projects the button starts one unattended agent per project, each told only its own project's shown tickets. The button's label is the spend readout: with one project it reads "Spin up an agent working on all X tickets shown below" (X being the shown tally), and the moment the set spans projects it also says how many agents the click costs; hovering explains the mechanics either way. A single shown ticket is started exactly as that ticket's own row start would start it — same one-ticket ask, same ticket named on the agent.

Whatever the batch, the dashboard shell is told about one started agent — the first — rather than being bounced through every one. A start that fails leaves its reason under the heading, in grouped and flat mode alike; agents already started stay started.

#### Rationale

One agent working a filtered slice is a different offer from the row's one-agent-one-ticket start: related small tickets land as one coherent change instead of N parallel worktrees. And the label carries the counts precisely because the set is a side effect of the filters — the click's cost must be readable before it is paid.

### Filtered-away tickets are accounted for

#### User story

The user forgets a filter is on and wonders where the rest of the backlog went.

#### Business logic

When filters hide tickets, the page says how many are hidden and offers to clear the filters — in the flat list above the rows, and inside each project's section in grouped mode. When nothing matches at all, the page says "No tickets match." An entirely empty backlog says instead that there are no tickets in any project yet and points at grouping by project, where importing from GitHub is offered.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
