The dashboard's left column, present on every page: the brand, the New agent launcher, the Overview, Tickets and Projects destinations, the list of recent agents, and — at the foot — which daemon this is, the theme toggle, notifications and Settings.

## Business logic — TL;DR

- **One column everywhere** - the same rail on every route, so the Overview and an agent's page share it instead of it appearing and disappearing with the selected project.
- **New agent adapts to what exists** - inside a project it starts another agent there; with exactly one project registered it starts there; with several it asks which; with none it offers to add a project first, since there is nowhere to run an agent.
- **The recent list follows the scope** - a selected project shows its own agents; the Overview pools every project's agents newest-first, each row naming its project and jumping into it.
- **A started agent appears immediately** - a placeholder row says "starting…" from the moment Start is pressed until the real agent shows up, and gives up after a while if none ever does.
- **Each row says what its agent is doing** - working, waiting on the user, publishing, or its final status — and for a cloud session, what the cloud side is doing; plus when it started, which driver ran it, whether it runs on another device or as a cloud session, and which machine started it when that was not this one.
- **Exactly one destination is highlighted** - New, Overview, Tickets, a project, or an agent row.
- **Projects carry their health** - each project shows whether it is activated, and turns red with the reason when the daemon has recorded an error for it.

## Business logic

### New agent adapts to what exists

#### User story

The user wants to start an agent, and where it should run depends on what they have registered.

#### Business logic

The launcher always reads "New agent". Inside a project it opens that project's start screen. On the Overview it depends on the projects registered: exactly one, and it starts there directly; several, and it opens a small picker naming each project (with the same activated dot the project list uses); none, and it opens the add-project dialog instead, explaining that a project must be added before an agent can start.

### The recent agents list

#### User story

The user wants to get back to an agent they were watching, from anywhere in the dashboard.

#### Business logic

Under the heading "Recent agents", a project's own agents are listed while a project is selected, and selecting one opens it. On the Overview, where no project is selected, every project's agents are pooled newest-first; those rows lead their meta line with the project name and, when selected, navigate into that project's agent. With nothing to list the heading stays and says "No agents yet.", so the message reads as the state of this list.

### A started agent appears immediately

#### User story

Between pressing Start and the daemon recording the new agent, the rail would otherwise show nothing at all.

#### Business logic

Pressing Start puts a dimmed placeholder row at the top of a project's list, carrying the typed prompt and reading "starting…", highlighted while the user is following the launch. It is replaced the moment any agent appears that was not in the list when Start was pressed — whatever state that agent is in, since an agent can start and finish between two refreshes. A start that never produces an agent at all retires the placeholder after twenty seconds, so the rail stops claiming something is starting; the start form itself reports the actual failure. The placeholder is a project-scoped thing and never appears on the Overview's pooled list.

### What a row says

#### User story

Scanning the list, the user needs to tell at a glance which agents need them, which are still working, and which are done.

#### Business logic

Each row shows a status word with a matching dot: a working agent pulses and reads its running status; an agent parked on the user reads "waiting" with a still dot, because it used to pulse identically whether it was mid-edit or had been idle for an hour; an agent that ended clean but has not yet reported its handoff reads "publishing…" with a pulsing dot, matching the wording on its own page; an agent that handed its task to a cloud session reads, once its local half is done, what the cloud side is doing per the cloud state rule (`cloud-run-state`): "waiting" with a still dot when the browser bridge holds a question its session is parked on, "in cloud" while the session is assumed to still be working, "merged" once the framework merged its pull request, and "done" once it has a pull request or the session can no longer be working — never "in cloud" forever. Otherwise the row shows the agent's final status.

Beside that: how long ago it started (preceded by its project name on the Overview), and, at the end of the line, a glyph naming the machine when another machine's daemon started the agent — the `agents-logs` branch the archives live on is shared, so other machines' agents are listed here, and one that looked like this daemon's own was a mystery; a glyph rather than a word, since the rail's fixed width would cut a machine name short — a device glyph naming the device when the agent runs on another machine, a cloud glyph when it is a cloud session, and the logo of the driver that ran it. Underneath sits the agent's task; a task too long for the rail's fixed width is faded at its end and shows in full on hover, while one that fits is shown plainly with no hover at all.

### Destinations and what is highlighted

#### User story

The user needs to know which view they are looking at.

#### Business logic

Overview leads home and carries the count of items in the user's interventions list as a badge, with a tooltip spelling it out ("N items in your Human Queue"). Tickets opens the cross-project ticket view, and is offered only where there is a ticket view to route to. Projects expands in place into an indented list of every registered project — selecting one navigates into it — and ends with an "Add project" item that opens the add-project dialog. Each project carries a dot: red when the daemon has recorded errors for it, with the errors named on hover and read out to assistive technology; filled when the project is activated; muted when it is not.

Exactly one of these carries the active highlight: New while a project's start screen is open, Overview while the Overview is, Tickets while the ticket view is, and the corresponding row while an agent is selected. While the user follows a just-started agent whose id is not known yet, the highlight sits on the newest running row rather than on New.

### The footer

#### User story

The global controls need a home now that the sidebar is the app's only chrome.

#### Business logic

The foot of the sidebar shows which daemon the dashboard is connected to, the theme toggle, the notifications menu and Settings. The brand at the top leads to the Overview and animates while any agent is working.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
