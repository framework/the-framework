Lists one project's tickets as one-liner rows — priority, topics, who holds the ticket, its effort and uncertainty ratings, its age, whether it has a plan, and the GitHub issue it tracks — so the backlog is readable without opening anything. Each row opens its ticket, and carries two direct starts: an agent [1] that implements the ticket, and an agent that writes its plan. Above the rows sits when the tickets last caught up with GitHub and the button that catches them up again.

## Context

**User story**: the user reads a project's backlog on the project's home and on the dashboard's Tickets page, scanning for what is urgent, what nobody planned yet and what an agent [1] is already working, then either opens a ticket to read it or starts an agent on it from the row itself.

**Business logic story**: the tickets are markdown files under `tickets/` on the project's `agent-data` branch [2]; this panel shows what the daemon reports about them. The same row is used twice: inside a project's section, where the section heading names the project, and in the Tickets page's flat cross-project list, where each row names its own project instead.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[5] session name: the name an agent gives its own work; its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] prompt agent: an agent that runs one prompt and stops there.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[8] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: keep the work in its checkout, push its branch, also open a pull request, also merge it.
[9] launcher: the Start form on a project's own page.
[10] drain: starting an agent on the agent queue's first open entry.

## Business logic — TL;DR

- **One ticket per row** - title, project (in the flat list), topics, claim, effort, uncertainty, priority, age, plan and GitHub issue, in fixed columns so the list scans down.
- **Who holds a ticket** - a hammer and the holder's name mark a claimed ticket, and lead to the agent holding it.
- **The plan column** - a plan that exists is a link to read it; a ticket with none offers to start an agent that writes it.
- **Starting work from a row** - one click starts an agent implementing that one ticket and nothing else.
- **Configure first, then run** - every start on the panel also offers a trip to this project's launcher with the same prompt waiting there.
- **Catching the tickets up with GitHub** - a line saying when the tickets last caught up, and a button that starts an agent to catch them up again.
- **Nothing to show** - a project with no ticket offers the import; a project filtered down to nothing says how many are hidden and clears the filters from there.
- **One start at a time** - while a start is in flight every start on the panel is out, and a refusal is shown above the rows.

## Business logic

### One ticket per row

#### Context

See `## Context`.

#### Business logic

A row reads, left to right:
- A tick box labeled "Select <title>", offered only where the surrounding page acts on a selection. It is never disabled, since selecting starts nothing.
- The start column: the play button described under "Starting work from a row".
- The ticket's title, which fills whatever width the other columns leave and truncates when it does not fit. Clicking it opens the ticket.
- The project's name, only in the flat cross-project list, where no section heading says it.
- The ticket's topics, one badge each. Where the surrounding page filters, a badge is a button that adds its topic to the filter, with the tooltip "Filter by <topic>"; where it does not, the topics are plain badges.
- The claim [3] marker, described under "Who holds a ticket".
- "Effort: N" and "Uncertainty: N", each shown only when the ticket's plan recorded that rating.
- "Priority: N", or nothing when the ticket names no priority. The value is red from 8 up, amber from 5 to 7, and muted below that or when there is none, so the critical tickets stand out down the column.
- The ticket's age, as "22s ago", "30m ago", "5d ago", "2w ago" or "1y ago", with the exact date and time on hover.
- The plan column, described below.
- The GitHub issue the ticket tracks, as a link opening in a new tab, showing the issue's label. A ticket that tracks no issue keeps the column's width empty, so the columns to its left stay aligned row to row.

The topics, claim, effort and uncertainty are hidden on a narrow screen; every other column stays.

### Who holds a ticket

#### Context

**User story**: a ticket an agent [1] is already working must not be picked up by the user or by another agent. The row says so where the user is looking, rather than only on hover, and takes the user to the agent doing the work.

#### Business logic

A claimed [3] ticket carries a hammer icon in the warning color followed by the holder [4], truncated to keep the row aligned. The holder reads as the agent's session name [5] when the claim names one of this project's agents, and otherwise exactly as the claim wrote it. The hammer alone is shown when the claim names nobody readable.

Hovering reads "Claimed by <holder> — an agent is working on this ticket (planning it or implementing it).", or "Claimed — an agent is working on this ticket (planning it or implementing it)." when there is no holder to name. A claim covers both cases: the agent may be planning the ticket or writing its implementation, and the marker does not distinguish the two.

The marker acts on click when the surrounding page offers it. When the claim names one of this project's agents, clicking opens that agent's page and the tooltip adds "Click to open the agent's page."; otherwise, where the page filters, clicking narrows the list to claimed tickets and the tooltip adds "Click to see all claimed tickets.". Where the page offers neither, the marker is plain text.

### The plan column

#### Context

**User story**: a ticket is either already planned, in which case the user wants to read the plan, or still unplanned, in which case the user wants one written. The column is that fork, one click wide.

#### Business logic

A ticket that has a plan shows a clipboard in blue, drawn heavier than the column's other state, labeled "View the plan for <title>" with the tooltip "View the plan"; clicking opens the ticket's plan. Where the surrounding page has nowhere to open a plan, the icon is shown disabled. There is no "configure" offer beside it: reading a file spends no agent [1].

A ticket with no plan shows a quieter clipboard, lighter than the row's own age column, labeled "Create a plan for <title>" with the tooltip "Plan this ticket — starts an agent to write its plan". Clicking starts a prompt agent [6] on this project asked to write the plan — "Create tickets/<stem>.plan.md", the one wording the "Plan tickets" preset and the daemon's own queue writes use. That agent is attended: a plan is written for a human to read and act on, so it stays a conversation the user lands in and steers, rather than one that settles and hands itself off. A refusal reads "The planning agent could not be started.".

The two states are told apart by color and weight, not by the icon alone, so the planned rows are scannable down the column.

### Starting work from a row

#### Context

**User story**: the user reading the backlog wants the ticket worked now, without queueing it and without opening it first.

**Problem**: an agent [1] given a ticket to work could wander into other tickets, and the daemon must know which ticket the agent is implementing in order to record it and to claim [3] it for the agent.

#### Business logic

The start column is a play button labeled "Start work on <title>", with the tooltip "Spin up an agent working on this ticket". It starts a prompt agent [6] on this project with the prompt "Work on tickets/<file>. Do not start any other ticket." — the drain [10] preset's wording narrowed to this one ticket — and names the ticket to the daemon as `tickets/<file>`, since the prompt is not the drain preset's and the daemon would not otherwise know which ticket is being implemented.

That agent runs unattended [7]: one agent on one ticket is the same work the daemon's own drain starts, so it runs the same way, ending when its work settles and firing the handoff [8] it was armed with. A refusal reads "The work agent could not be started.".

When a start succeeds, the surrounding page is told what was asked and which agent was started, so it can take the user to the agent instead of leaving them on rows that have not changed yet.

### Configure first, then run

#### Context

**Problem**: which coding agent runs, on which model, and where it runs are set in the launcher [9] and the dashboard's own settings, nowhere near this row. Without a way across, changing any of them means leaving the page, editing preferences, coming back, and hoping the button still means the same thing.

#### Business logic

Every start on the panel — the work start, the plan start and the GitHub update — carries a chevron beside it offering "Configure first, then run": "Opens the launcher with this ticket's prompt, so you can set the model and where it runs." for the work start, and "Opens the launcher with the plan prompt, so you can set the model and where it runs." for the plan start. Choosing it leaves the same prompt waiting in this project's launcher [9] and takes the user there, starting nothing. The chevrons of every row name their own ticket ("Other ways to work on <title>", "Other ways to plan <title>").

A chevron is never disabled by a start in flight, because it starts nothing: being unable to go and look at the settings while something else runs would defeat the offer.

### Catching the tickets up with GitHub

#### Context

**User story**: a project's issues live on GitHub and its tickets live on the `agent-data` branch [2]; the user wants the second to reflect the first without walking the issues by hand.

#### Business logic

Above the rows, one line states when the tickets last caught up with GitHub — "Updated from GitHub 3h ago", or "No record of an import yet" when nothing was ever imported — with the update button immediately beside it, rather than a panel's width away from the line it acts on. What that button offers and how it words itself is described in `UpdateTicketsButton.tsx`.

The update runs unattended [7]: an import fired by a button is routine work rather than a conversation, so it ends when its work settles and fires its armed handoff [8], exactly as it does when the daemon starts the same routine on its own clock. A refusal reads "The update could not be started.".

### Nothing to show

#### Context

**Problem**: an empty list has two very different causes. A project that never imported its issues should be offered the import; a project whose tickets are merely hidden by a filter must not be, or the panel would ask for work that is already done.

#### Business logic

While the tickets are still being read the panel reads "Loading…". With no project selected it shows nothing at all.

A project with no ticket at all reads "No tickets yet. Tickets live in `tickets/` and are what the agent plans from." and offers the update button beneath it.

A project whose every ticket is hidden by the surrounding page's filters instead reads "N ticket hidden by the current filters." (or "N tickets hidden by the current filters.") and, where the page allows it, offers "Clear filters" right there rather than pointing back at the toolbar. It offers no import.

### One start at a time

#### Context

**Problem**: every start on the panel spends a checkout and a share of the account's quota. A double click, or a second row clicked while the first is still starting, would spend two.

#### Business logic

While any start on this panel is in flight, every start button on it is disabled — the work starts, the plan starts and the update alike — and comes back when it settles. The chevrons stay live.

A refusal is shown as red text above the rows, or inside the empty state's card, and stays until the next start.
