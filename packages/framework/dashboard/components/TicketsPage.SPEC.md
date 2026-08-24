The dashboard's Tickets page: every registered project's `tickets/` backlog on one full-width page, filtered, sorted and either grouped per project or pooled into one cross-project list.

## User story

The user wants to see the whole backlog — not one project's slice of it — decide what to work next, and act on a ticket right there: read it, read its plan, have an agent plan it, or have an agent work it. And when the filters have carved out a coherent slice, they want to queue that whole slice for the AI in one click — or hand-pick some of the shown tickets and have those same clicks act on just the picked ones.

## Business logic — TL;DR

- **Cross-project by default** - the page reads every registered project's tickets, re-read every ten seconds, and shows a shown/total tally beside its title.
- **The address is the view** - search, filters, sort and grouping are all carried in the page's address, so a view can be shared and reopened; changing them rewrites the address without adding a Back step.
- **Grouped or flat** - grouped shows one section per project, each with that project's own ticket panel; flat pools every project's tickets into one order, each row naming its project — the only view that can answer which ticket is the highest-priority one anywhere.
- **Click-to-filter** - clicking a row's topic adds that topic to the filter, clicking its claim marker narrows to claimed tickets; both add to what is already filtered rather than replacing it.
- **Plan it or work it from the row** - a ticket can be handed to a planning agent or to an unattended work agent without leaving the page.
- **Queue the whole shown set** - a button beside the page's heading adds every unclaimed shown ticket to the AI queue (a ticket already queued stays as it is), counting on its label what one click adds; no agent starts — the queue's own consumers do that.
- **Queue plans for the whole shown set** - a sibling button queues one plan ask per shown ticket still to plan — the plan-tickets ask, placed by the ticket's priority — skipping tickets already planned, already queued, or claimed.
- **Selecting rows narrows the queue buttons** - every row carries a checkbox; while any shown row is ticked, both queue buttons say "selected" and act on just the ticked tickets, with a readout of how many are selected and a way to clear the selection.
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

### Queue the whole shown set

#### User story

The user narrows the backlog to a coherent slice — a topic, a priority band, one project — and wants everything left showing on the AI queue, rather than queueing the rows one by one.

#### Business logic

Whenever the filters leave at least one unclaimed ticket showing, the page's heading row offers a button that adds the shown tickets — or, while any row is selected, just the selected ones (see "Selecting rows narrows the queue buttons") — to the AI queue: "Add all X tickets shown below to the AI queue". Each ticket is queued exactly as the ticket detail page's Queue action queues it (the entry links back to the ticket and lands in its priority's section), walked in the shown order so entries within a priority section keep the order the reader saw, and each on its own project's queue, so a shown set spanning projects needs no special case. A ticket an open queue entry already links to is left as it stands — "add" means the set ends up queued, never queued twice. No agent starts: the queue is what the framework's own routine drain fans out over and what the AI Queue card's play buttons start one entry at a time.

Claimed tickets — those an agent already holds — are skipped: they are being worked, and the label then counts only the unclaimed tickets so it never promises a ticket it will skip; hovering explains the mechanics and says how many claimed tickets are being left alone. With nothing to add — nothing shown, or everything shown claimed — the button is not offered.

Once a click has queued the shown set, the button reads "Queued" and rests; any change to the shown set — a filter, newly arrived tickets — arms it again for the new set. The work stops at the first failure, whose reason lands under the heading in grouped and flat mode alike; everything already queued stays.

#### Rationale

Queueing rather than starting agents keeps the one click cheap and durable: entries are what the framework already picks up on its own, survive anything that interrupts the work, and spend nothing until an agent actually starts. Skipping already-queued tickets matters because a duplicate entry would outlive its agent's check-off as an open entry naming a closed ticket, costing the sweep an agent.

### Queue plans for the whole shown set

#### User story

The user has filtered the backlog to a slice they intend to work soon and wants plans written for all of it first — to read before committing agents — without asking ticket by ticket.

#### Business logic

Beside the queue-the-shown-set button sits its plan sibling: one click queues, for every shown ticket that has no plan yet and no claim on it — or, while any row is selected, only every such *selected* ticket (see "Selecting rows narrows the queue buttons") — the ask for that ticket's plan — the same wording the plan-tickets preset queues — placed in the AI queue by the ticket's own priority, walked in the shown order. A drain agent reaching such an entry writes the plan. No agent starts from the click.

The click leaves alone what queueing again would waste: a ticket whose plan ask is already an open entry (recognized by its exact wording), and a ticket already queued for implementation — its work would land before a trailing plan could matter. The button's label counts only what it will ask for, saying "unplanned" the moment its count differs from the shown tally; hovering explains the mechanics, the worked order, and what is left alone. Once a click has queued the shown set's plans the button reads "Plans queued" and rests until the shown set changes. With nothing left to plan the button is not offered — the queue-the-tickets button stands on its own.

#### Rationale

Plans are for a human to read before spending agents, so asking for them in bulk is the natural prelude to queueing the same slice for implementation. The asks ride the same queue as everything else so the framework's own consumers pick them up with no new machinery — and the entry deliberately is not a ticket link, since a leading ticket link is what every reader takes as "queued for implementation".

### Selecting rows narrows the queue buttons

#### User story

The filters cannot always carve out exactly the tickets the user means — a hand-picked few from across the shown list — and they want the page's queue buttons to act on just those, without queueing them one by one from their detail pages.

#### Business logic

Every ticket row carries a checkbox, in grouped and flat mode alike. While at least one shown row is ticked, both queue buttons stop speaking for the whole shown set and speak for the selection instead: their labels say "selected" and count only the selected tickets each click would add, their skip rules unchanged — the queue-add still skips claimed selected tickets, the plan button still skips planned and claimed ones and everything already queued. The heading row says how many tickets are selected and offers to clear the selection in one click. Both buttons' rested "Queued"/"Plans queued" states are per acted-on set, so changing the selection arms them again, exactly as changing the filters does.

Only selected rows the filters still show count: a selected ticket the filters have hidden is neither counted nor acted on — what a button acts on is always visible below it — but the tick itself survives and comes back with the row when the filters release it. With every selected row hidden, the buttons speak for the whole shown set again and the selection readout disappears.

Selecting is page state, never an action: checkboxes are always enabled, and ticking one starts nothing.

#### Rationale

- Narrowing the existing buttons rather than adding selection-only ones: one pair of buttons whose label always names its set keeps the heading readable, and the "Queued" rest state carries over unchanged.
- Counting only shown selected rows keeps the buttons honest — a click never touches a ticket the user cannot currently see — while preserved ticks spare the user re-picking after a detour through the filters.

### Filtered-away tickets are accounted for

#### User story

The user forgets a filter is on and wonders where the rest of the backlog went.

#### Business logic

When filters hide tickets, the page says how many are hidden and offers to clear the filters — in the flat list above the rows, and inside each project's section in grouped mode. When nothing matches at all, the page says "No tickets match." An entirely empty backlog says instead that there are no tickets in any project yet and points at grouping by project, where importing from GitHub is offered.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
