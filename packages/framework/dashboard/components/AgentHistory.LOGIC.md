The dashboard's left column, present on every page: the brand mark, the "New agent" button, the "Overview", "Tickets" and "Projects" destinations, the "Recent agents" list, and a footer with the connection indicator, the theme toggle, the notifications menu and "Settings". The list shows a project's own agents [1] when a project is selected, and every project's agents pooled newest-first on the Overview [2]; each row says in one word what its agent is doing, when it started, where it runs and which coding agent [3] runs it, and a stand-in row says "starting…" the instant Start is clicked.

## Context

**User story**: the user finds every agent from the same column on every page, tells a working agent from one waiting for a message, one still publishing from one done, one running on another machine or in a cloud session [4] from a local one, and jumps to any of them, or starts a new one, without leaving the column.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the Overview: the dashboard's cross-project page at `/`.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] launcher: the Start form on a project's own page (the project home).
[6] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[7] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[8] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[9] the Claude web bridge / the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[10] cloud work adoption: how the daemon recognises the branch a cloud session pushed as the agent's, by the cloud anchor it descends from.
[11] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[12] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[14] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[15] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next.

## Business logic — TL;DR

- **One column on every page** - brand mark, the navigation group, the agents list and the footer controls, in a fixed-width column that never disappears, on the Overview and on an agent's page alike.
- **"New agent"** - starts an agent where it can: in the open project, in the only project, from a picker when there are several, or, with no project at all, by offering to add one first.
- **"Overview" and "Tickets"** - the two cross-project destinations, "Overview" carrying the count of items in the "Human Queue"; only the current view carries the active fill, never both.
- **"Projects"** - an expandable list of every registered project with a dot saying whether it is activated or in error, the error named on hover, and an "Add project" entry at its end.
- **Which agents are listed** - a selected project's own agents, or on the Overview every project's recent agents pooled, each row naming its project; "No agents yet." when there is nothing.
- **The starting row** - a dimmed "starting…" stand-in appears the instant Start is clicked and retires when the real agent lands, whatever its status, or after 20 seconds without one.
- **Which row is highlighted** - the selected agent's row, or the newest running agent's row while following a just-started agent, or the stand-in while the selected agent's row has not landed; nothing on the Overview.
- **What a row shows** - one status word with a dot, the project and the relative start time, the agent's title, and a cluster of glyphs for another machine's daemon, a device, a cloud session and the coding agent.
- **The status word** - "waiting", "in cloud", "merged", "publishing…" or the stored status, ranked so a row never says "done" about work still moving and never says "in cloud" about work that landed.
- **Long titles** - a title that overflows the column fades at its end and shows the full text on hover; one that fits gets no tooltip.

## Business logic

### One column on every page

#### Context

See `## Context`.

#### Business logic

The column holds, top to bottom: the brand mark and word mark, which lead to the Overview [2] and animate while any agent [1] is working; the "New agent" button; the "Overview" row; the "Tickets" row when the caller can route to the tickets view; the "Projects" row; the scrolling "Recent agents" list under a heading that stays pinned at the top of the scroll and is shown even when the list is empty, so "No agents yet." reads as the state of this list; and a footer with the connection indicator (which daemon this dashboard talks to), the theme toggle, the notifications menu (`NotificationsMenu.tsx`), and a gear button whose hover and accessible name read "Settings" and which opens the Settings page.

### "New agent"

#### Context

**User story**: the user starts an agent [1] from the column wherever they are; where it starts depends on what exists.

#### Business logic

One button, always labeled "New agent" with a plus icon, whose behavior depends on the page:

- With a project selected, or on the Overview [2] with exactly one registered project: starting opens that project's launcher [5] at once.
- On the Overview with no registered project: there is nowhere to run an agent, so the hover reads "Add a project to start an agent" and the click opens the add-project panel (`AddProjectPanel.tsx`); once a project is added the caller refreshes its project list.
- On the Overview with several projects: the button opens a picker listing every project by name, each with a dot that is filled when the project is activated and muted otherwise; picking one opens that project's launcher.

The button carries the active fill only when the project's launcher is the current view: a project selected, no agent picked, not following a just-started agent, and not on the tickets view. Elsewhere it is plain, because "New agent" is an action, not a place.

### "Overview" and "Tickets"

#### Context

**User story**: the two cross-project destinations sit above the agents list, more prominent than a menu row, and the one open question count the user must never lose sight of rides on "Overview".

#### Business logic

- "Overview" leads to the Overview [2]. When the count of interventions [6] is above zero, the row carries a filled badge with the count, whose hover reads "<N> item in your Human Queue" or "<N> items in your Human Queue". The row is the active one when no project is selected and the tickets view is not current.
- "Tickets" opens the cross-project tickets view. It is offered only when the caller can route to it, and it is the active row while the tickets view or one ticket's page is current. Because both rows correspond to pages with no project selected, the tickets view's activeness is what keeps "Overview" from claiming the active fill at the same time.

### "Projects"

#### Context

**User story**: the user switches project from the column, sees at a glance which projects are activated and which one the daemon has trouble with, and registers a new project from the same list.

#### Business logic

The "Projects" row starts collapsed; opening it reveals an indented list under a connecting rule:

- "No projects yet" when none is registered.
- One entry per project, by name, with a dot in front: red when the daemon has recorded an error for the project, filled when the project is activated, muted otherwise. Hovering the dot reads "activated" or "not activated", or, in error, one line per error as "<what is wrong>: <the daemon's message>", where what is wrong is the error's title from `ProjectErrorBanner.tsx` (for a data-branch sync failure, "Not syncing with the remote"). A screen reader hears "Error: ", "Activated: " or "Not activated: " before the name. Selecting an entry navigates into that project; the selected project's entry carries the active fill.
- "Add project" at the end opens the add-project panel (`AddProjectPanel.tsx`); once a project is added, the caller refreshes its list.

### Which agents are listed

#### Context

See `## Context`.

#### Business logic

With a project selected, the list holds that project's own agents [1], in the order the caller gives them, newest first. On the Overview [2], the list holds every project's recent agents pooled, newest first, and each row's second line leads with its project's name; selecting a pooled row jumps into that project and that agent, so both the project and the agent change at once. When neither the list nor the starting row has anything to show, "No agents yet." is shown under the heading.

### The starting row

#### Context

**Problem**: an agent's [1] row exists only once the daemon has written its record, which lands a beat after Start is clicked, and the daemon's list of agents is polled every two seconds. Without a stand-in, Start looks like nothing happened; with a careless stand-in, a second agent appears to be starting beside the real one, or "starting…" stays for ever after a start that produced no agent.

#### Business logic

The instant Start is clicked, a dimmed stand-in row is shown at the top of the list: a pulsing dot, the badge "running", the subtitle "starting…", and as its title the prompt the user typed (or "New agent" when there was none). Clicking it goes to the project's launcher [5]. It is shown only within a project, never on the Overview [2], and never while an agent is already running.

The stand-in retires the moment an agent appears in the list that was not in it when Start was clicked, whatever status that agent landed in: an agent that starts and fails inside one polling interval is never once seen running, and it still counts as the handover. An agent that was already listed when Start was clicked never counts. A start that never produces any agent at all is swept after 20 seconds with no running agent, so the column stops pretending; the launcher shows the actual error. Switching project drops the stand-in.

### Which row is highlighted

#### Context

**Problem**: right after Start, the agent [1] the page navigated to has no row yet, and a just-started agent may not have reported its id at all; the highlight has to land on the row standing in for it rather than on "New agent".

#### Business logic

Within a project, a row is highlighted when it is the selected agent's, or, while following a just-started agent that reported no id, when it is the newest running agent's row: only one row, the first running agent in newest-first order, never every running one. The stand-in is highlighted while the page follows a just-started agent, or while the selected agent's own row has not landed in the list yet. On the Overview [2] nothing is highlighted, since a row there navigates into its project.

### What a row shows

#### Context

**User story**: the user reads a row and knows what the agent [1] is doing, how long ago it started, whether it runs on this machine, on a device [12], in a cloud session [4] or was started by another machine's daemon, and which coding agent [3] runs it.

#### Business logic

Each row is a button with two lines.

The first line, left to right:

- a dot, only while the agent is running or parked: pulsing in the primary color while it is working, still and muted while it is parked on the user; and, while the agent is publishing, a pulsing green dot instead, the same window the agent's own status pill calls "publishing…";
- the status word (next section), in uppercase, colored by the stored status when it is the word (primary for running, green for done, amber for stopped, red for failed), muted when parked or publishing, primary for "in cloud", green for "merged";
- the subtitle: on the Overview [2], "<project name> · <when it started>"; within a project, just when it started, as "just now", "<N>m ago", "<N>h ago", "<N>d ago" up to a week, and the local date beyond it (the rule in `lib/format-date.ts`);
- at the right end, a cluster of small glyphs, each with a hover: a laptop glyph named "Started on <host>" with the hover "Started on <host>, by that machine's daemon." when another machine's daemon started the agent, since the shared record lists every machine's agents here; a device glyph named "Runs on <device>" (or "Runs on a connected device" when the device has no label) when the agent is relayed [13]; a cloud glyph named "Runs as a Claude Code cloud session" with the hover "Runs as a Claude Code cloud session; it works and opens its PR over there." for a web agent; and the coding agent's logo, named "Claude Code" or "Codex". The logo names the driver [14] the agent recorded, and every surface Claude runs on — the local CLI, the cloud session, the Actions runner — is still "Claude Code": where it runs is the glyph beside it, not the logo.

The second line is the title: what the user typed as the prompt; failing that, the session name [11] its branch carries; failing that, the branch itself; failing that, the moment it started as a short local date and time (the rule in `lib/agent-label.ts`).

### The status word

#### Context

**Problem**: a web agent's local process ends at its hands-off by design, so its stored status is "done" from that moment on, which says nothing about the cloud session [4] still working, parked on a question, or long finished. And an agent that ended cleanly with an armed handoff [8] is "done" in its record while its branch is still being pushed and its pull request opened.

#### Business logic

The word, by the first rule that applies:

- "waiting": the agent [1] is running and settled [7], or it is a web agent whose cloud session the bridge [9] reports as parked on a question. A finished agent is never waiting: a stale settled mark on a "done", "stopped" or "failed" agent does not relabel it.
- "in cloud": a web agent whose local half is done, with no pull request known, no question pending, and started within the last 12 hours (the window in `src/cloud-run-state.ts`). This outranks "publishing…": the cloud side owns its own push and pull request.
- "merged": a web agent whose adopted work (cloud work adoption [10]) had its pull request merged by The Framework.
- "publishing…": a non-web agent that ended cleanly, was armed to push, and whose handoff has not reported back yet.
- Otherwise the stored status: "running", "done", "stopped" or "failed". A web agent past the 12-hour window with nothing adopted, or with a pull request, reads "done"; a web agent that was stopped or failed reads that.

### Long titles

#### Context

**Problem**: the column has a fixed width, and a long prompt has to stay readable without a scrolling marquee that forces reading at its own pace.

#### Business logic

A title wider than the column is clipped with a fade at its end and shows the full text in a tooltip to the right on hover, wrapped and never wider than a readable paragraph. A title that fits is plain text with no tooltip at all.
