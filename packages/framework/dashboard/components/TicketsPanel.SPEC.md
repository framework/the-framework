One project's `tickets/` backlog as a list of one-line rows, scannable without opening anything, with three agent-starting actions on it: work a ticket, plan a ticket, and bring the whole backlog up to date with GitHub. Each of the three also offers "Configure first, then run", which opens the project's launcher with the same prompt instead.

## User story

The user wants to read a project's backlog at a glance — what each ticket is, how urgent, whether it is already planned or already being worked, how old — and to put an agent on any of it in one click. On a project with no tickets yet, they want the backlog filled from the repo's GitHub issues rather than a dead end.

The user also wants to run any of those three on a different model or somewhere other than this machine — settings that live in the launcher, not on a backlog row.

## Business logic — TL;DR

- **A ticket is one row** - title, project (in the cross-project list), topics, claim, effort, uncertainty, priority, age, plan, and the GitHub item behind it, all on one line; the row opens the ticket's detail page. Where the surrounding page selects tickets for its bulk actions, the row also leads with that selection's checkbox.
- **Start work from the row** - a play control on the row's left edge starts an unattended agent on that one ticket and nothing else, with the ticket named on the agent.
- **The plan column is either a plan or an offer to write one** - a planned ticket links to its plan; an unplanned one offers to start an agent that writes it.
- **Claimed rows say who holds them** - a ticket an agent has claimed shows a hammer and the holder's name, meaning an agent is planning or implementing it.
- **Update from GitHub** - one action brings `tickets/` up to date with the repo's issues; on a project with no import on record it brings everything open across. It runs unattended, as the same routine does when the daemon starts it.
- **Empty is not the same as filtered** - a backlog filtered down to nothing says how many tickets the filters hide and offers to clear them; only a genuinely empty `tickets/` offers the GitHub update.
- **Configure first, then run** - each of the three actions carries a chevron that hands its prompt to this project's launcher instead of starting anything; the plan column's link to an existing plan carries none, since reading a file starts nothing.

## Glossary

- **start column** - the row's left-edge control that starts an agent working that ticket.
- **plan column** - the row's control that either opens the ticket's plan or starts an agent to write it.

## Business logic

### A ticket is one row

#### User story

See `## User story`.

#### Business logic

Every ticket occupies a single line. The title takes whatever width the row has to spare and truncates when it runs out; clicking it opens the ticket's detail page. In the flat cross-project list the row also names its project, since there is no section heading saying it. The rest of the line, from left to right: the ticket's topics, its claim, its effort and uncertainty estimates, its priority — coloured by how urgent it is, and spelled out as "Priority: 8" — and its age, with the exact date and time on hover. Priority, age and the plan column keep fixed widths, and a ticket with no GitHub item still reserves that column's width, so the columns line up down the whole list regardless of what any one ticket carries.

Where the surrounding page supports filtering, a row's topics and its claim marker are clickable: a topic filters the page to that topic, the claim marker filters to claimed tickets. Where the page has no filters, they are plain labels.

Where the surrounding page selects tickets for its bulk actions — the Tickets page's queue buttons — the row's left edge leads with a checkbox showing and toggling that selection. The selection itself belongs to the page (it can span projects); the row only reports the toggle, navigates nowhere on it, and never disables the box — selecting is state, not an action. Where the page selects nothing, no checkbox renders.

### Start work from the row

#### User story

The user reads the backlog, sees the ticket that should be done next, and wants an agent on it immediately.

#### Business logic

The start column asks an agent to work `tickets/<file>` and to start no other ticket. The agent runs unattended — ending when it settles and firing its armed handoff — because one agent on one ticket is exactly the work the queue-draining routine starts, and it should run the same way. The ticket is named on the agent itself, so the agent's record says which ticket it implements.

### The plan column

#### User story

Before committing an agent to a big ticket, the user wants a plan written for it, and afterwards wants to read that plan.

#### Business logic

A planned ticket's plan column links to the rendered plan, marked prominently so planned rows are scannable at a glance. An unplanned ticket's plan column instead starts an agent asked to create the ticket's plan file beside the ticket, and is drawn quietly — an action still available rather than something already there.

The planning agent runs attended, unlike the work agent and the GitHub update: a plan is written for a human to read and act on, so it stays a conversation the user can land in and steer.

### Claimed rows say who holds them

#### User story

The user needs to know a ticket is already being worked before starting a second agent on it.

#### Business logic

A ticket an agent has claimed shows a hammer and the holder's name inline, truncated to keep the row aligned, with the full holder and the explanation on hover: an agent is working on this ticket, planning it or implementing it. Where filtering is available, the hover also says the marker leads to all claimed tickets.

#### Rationale

The holder is named on the row rather than only in the tooltip: a control that only reveals itself after a second of hovering is one nobody discovers.

### Update from GitHub

#### User story

The user's real backlog lives in the repo's GitHub issues and they want `tickets/` to reflect it — the first time, and every time since.

#### Business logic

A bar above the list says when `tickets/` last caught up with GitHub, or that there is no record of an import yet, with the update action beside it. The action asks for `tickets/` to be brought up to date with the issues and comments changed since the last import; with no import on record, everything open comes across instead. It runs unattended, since an update fired by a button is routine work rather than a conversation.

The same instruction sits behind the same label everywhere it is offered, including the onboarding checklist, so one label always means one instruction.

### Configure first, then run

#### User story

The user wants a ticket worked, planned, or the backlog updated, but on a different model or somewhere other than this machine.

#### Business logic

All three agent-starting actions are split buttons: beside each sits a chevron whose menu holds "Configure first, then run". Taking it opens this project's launcher carrying the prompt that action would have sent — the ticket's work ask, the ticket's plan ask, or the GitHub update's own instruction — and starts nothing. Both of the panel's update buttons, the filled backlog's and the empty backlog's, carry the same instruction here as they send.

A plan that already exists is a link rather than a start, so its column carries no chevron: there is nothing to configure about reading a file.

### Starting anything hands the user to the agent

#### User story

The user presses a button and wants to watch the work, not stare at a list that has not changed yet.

#### Business logic

Whenever any of the three actions starts an agent, the dashboard shell is told, so the user lands on the agent doing the work rather than on a panel showing stale rows until files land. Every action is blocked while another start is in flight — the chevrons beside them excepted, since those start nothing — and a failed start leaves its reason in the panel: the update, the planning agent, or the work agent could not be started.

### Empty is not the same as filtered

#### User story

See `## User story`.

#### Business logic

A panel whose tickets were all hidden by the surrounding page's filters says how many are hidden and, where the page allows it, clears the filters from right there. It never offers the GitHub update in that state.

A genuinely empty backlog explains that tickets live in `tickets/` and are what the agent plans from, and offers the GitHub update as the way to fill it. Until the project's tickets have been read, the panel says it is loading.

#### Rationale

Offering an import to a user who has merely filtered their backlog away would ask for work that has already been done.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
