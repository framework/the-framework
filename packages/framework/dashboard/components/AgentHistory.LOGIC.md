The dashboard's left column, present on every page: the brand mark, the project select, which picks the one project every page shows, the "New agent" button, the "Overview" destination, one row per page the installed modules [15] add, the "Recent agents" list, and a footer with the connection indicator, the theme toggle, the notifications menu and "Settings". The list shows the picked project's [17] own agents [1], and every project's agents pooled newest-first when no project is picked, in both cases with a main agent's subagents [16] folded under it; each row says in one word what its agent is doing, when it started, where it runs and which coding agent [3] runs it, and a stand-in row says "starting…" for a just-started agent until its own row lands.

## Context

**User story**: the user finds every agent from the same column on every page, tells a working agent from one waiting for an answer, one still saving from one done, one running on another machine or in a cloud session [4] from a local one, and jumps to any of them, or starts a new one, without leaving the column.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the Overview: the dashboard's cross-project page at `/`.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] launcher: the Start form on a project's own page (the project home).
[6] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[7] saving: the window after an agent ended clean in which the tool that runs it still saves the agent's record on the data branch and cleans up its checkout; nothing of the agent's own work is published then. The daemon marks an agent's record saving while its status is done and its process is still alive on this machine (`src/dashboard-rpc/reads.ts`).
[9] the Claude web bridge / the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[10] cloud work adoption: how the daemon recognises the branch a cloud session pushed as the agent's, by the cloud anchor it descends from.
[12] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[14] driver: a coding agent wrapped as a black box. The user's driver choice is `claude-code` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[15] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[16] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.
[17] picked project: the one project the project select, the menu at the top of this column, names. Every page then shows only that project's data. When the select says "All projects", no project is picked and every page shows every project's data.

## Business logic — TL;DR

- **One column on every page** - brand mark, the project select, the navigation group, the agents list and the footer controls, in a fixed-width column that never disappears, on the Overview and on an agent's page alike.
- **"New agent"** - starts an agent where it can: in the picked project [17], in the only project, from a picker when there are several and none is picked, or, with no project at all, by offering to add one first.
- **"Overview" and the modules' pages** - the cross-project destinations, "Overview" carrying the count of items in the "Human Queue", then one row per page a module [15] adds, labelled by the module (the tickets' page among them, when a package brings one); only the current view carries the active fill, never two.
- **The project select** - at the top, above a rule: the picked project [17] or "All projects", applying to everything under it.
- **Which agents are listed** - the picked project's [17] own agents, or with none picked every project's recent agents pooled, each row naming its project; "No agents yet." when there is nothing.
- **Subagents under their main agent** - the list is a tree one level deep: a subagent [16] whose main agent is in the list sits under it, in a list that is open by itself while a subagent is working, waiting or the one selected, and folded otherwise; the main agent's row carries the count of its subagents on its first line, and a click on the count opens or folds the list without opening the agent, the user's choice winning from then on. A main agent that is `done` reads "running" while one of its subagents in the list still holds its job.
- **The starting row** - a dimmed "starting…" stand-in appears once a start reports its agent's id, unless the list already holds that agent, and retires when that agent lands, whatever its status, or after 20 seconds without it.
- **Which row is highlighted** - the selected agent's row, or the newest running agent's row while following a just-started agent, or the stand-in while the selected agent's row has not landed.
- **What a row shows** - one status word with a dot, the project and the relative start time, the agent's title, and a cluster of glyphs for another machine's daemon, a device, a cloud session and the coding agent.
- **The status word** - "waiting", "in cloud", "merged", "saving…" or the stored status, ranked so a row never says "done" about work still moving and never says "in cloud" about work that landed.
- **Long titles** - a title that overflows the column fades at its end and shows the full text on hover; one that fits gets no tooltip.

## Business logic

### One column on every page

#### Context

See `## Context`.

#### Business logic

The column holds, top to bottom: the brand mark and word mark, which lead to the Overview [2], keeping the picked project [17], and animate while any agent [1] is working; the project select; a rule; the "New agent" button; the "Overview" row; one row per module page; the scrolling "Recent agents" list under a heading that stays pinned at the top of the scroll and is shown even when the list is empty, so "No agents yet." reads as the state of this list; and a footer with the connection indicator (which daemon this dashboard talks to), the theme toggle, the notifications menu (`NotificationsMenu.tsx`), and a gear button whose hover and accessible name read "Settings" and which opens the Settings page.

### "New agent"

#### Context

**User story**: the user starts an agent [1] from the column wherever they are; where it starts depends on what exists.

#### Business logic

One button, always labeled "New agent" with a plus icon, whose behavior depends on the page:

- With a project picked [17], or with exactly one registered project: starting opens that project's launcher [5] at once.
- With no registered project: there is nowhere to run an agent, so the hover reads "Add a project to start an agent" and the click opens the add-project panel (`AddProjectPanel.tsx`); once a project is added the caller refreshes its project list.
- With several projects and none picked, on a project's own page too: the button opens a picker listing every project by name, each with a dot that is filled when the project is activated and muted otherwise; picking one opens that project's launcher.

The button carries the active fill only when the project's launcher is the current view: a project selected, no agent picked, not following a just-started agent. Elsewhere it is plain, because "New agent" is an action, not a place.

### "Overview" and the modules' pages

#### Context

**User story**: the two cross-project destinations sit above the agents list, more prominent than a menu row, and the one open question count the user must never lose sight of rides on "Overview".

#### Business logic

- "Overview" leads to the Overview [2]. When the count of interventions [6] is above zero, the row carries a filled badge with the count, whose hover reads "<N> item in your Human Queue" or "<N> items in your Human Queue". The row is the active one when no project is selected and no module's page is current.
- Below "Overview", one row per page the installed modules [15] add, in the order the shell hands them, each with the module's own label and icon (a generic blocks icon when the module gives none); a row opens its page and is the active one while that page is current.
- All of these rows correspond to pages with no project selected, so "Overview" is the active one only when no module's page is current. The dashboard has no row of its own for tickets: the tickets' page is the tickets package's module's, listed here like any other module page.

### The project select

#### Context

**User story**: the user picks, at the very top of the column, the one project the whole dashboard is about, or all of them. The pick is set apart from the rows under it, because it applies to every one of them. The menu, `ProjectSelect.tsx`, says which projects are activated and which one the daemon has trouble with, and registers a new project.

#### Business logic

The brand mark and the project select sit above a rule that separates them from the rest of the column. The select is a button showing the picked project's [17] name with its dot, or "All projects" when none is picked. What its menu lists and what a pick does are in `ProjectSelect.tsx`; what the pick changes on the pages is the caller's, `App.tsx`.

### Which agents are listed

#### Context

See `## Context`.

#### Business logic

With a project picked [17], the list holds that project's own agents [1], in the order the caller gives them, newest first. With none picked, on every page, the list holds every project's recent agents pooled, newest first, and each row's second line leads with its project's name, except a subagent's [16] under its main agent; selecting a pooled row jumps into that project and that agent, so both the project and the agent change at once. When neither the list nor the starting row has anything to show, "No agents yet." is shown under the heading.

### Subagents under their main agent

#### Context

**User story**: the user asked one agent for work it split across subagents [16]. The list shows that agent as one row with its subagents under it, open while they work so the user sees them, and folded to a count once they are all done, so five finished subagents do not push the user's other agents down the list.

**Problem**: without this every subagent was a row like any other, named by a prompt that ends in the same lines for every subagent, and nothing said which agent it worked for.

#### Business logic

The list, a project's own or the pooled one, is shown as a tree one level deep (the rule in `lib/subagents.ts`): a subagent whose main agent is in the list sits under that main agent, oldest first, and no longer has a row of its own in the list's order; in the pooled list the main agent is looked for among the same project's rows. A subagent whose main agent is not in the list, and an agent started for a subagent, are ordinary rows.

Under a main agent's row that has subagents:

- The main agent's row is as tall as any other row: the count of its subagents sits on the row's first line, in the cluster at its right end, before the other glyphs. It shows a chevron that points right while the list is folded and down while it is open, a small agent icon, and the number of its subagents in the list. Its accessible name is "1 agent" or "<N> agents", followed by " · <K> running" while K of them, at least one, have the status `running`; its hover reads "<N> subagents", with ", <K> running" likewise.
- The subagents' rows are shown under the main agent's row, indented under a connecting rule, while the list is open. By itself the list is open while any of the subagents is not over (`running` or `waiting`) or is the selected agent, and folded otherwise; on the Overview, where no row is selected, only the first applies.
- A click on the count, or Enter or Space while it has the focus, opens a folded list and folds an open one, and does not open the main agent. From then on the user's choice for that main agent wins over the rule above, in either direction. The choice is kept in the page's memory only: a reload forgets it.

A subagent's row is an ordinary row (see "What a row shows" and "The status word"), selected and highlighted like any other, with two differences: its title is its task, the first line of what it was asked, without the lines every subagent is told (`lib/subagents.ts`); and its subtitle is only when it started, on the Overview too, since it is in its main agent's project.

A main agent never waits in a process: it ends its turn after starting its subagents and is continued each time one of them ends, so its record says `done` while the work it was asked for is still going. Its row therefore does not say "done" then: while the main agent's stored status is `done` and at least one of its subagents in the list holds its job (it is `running`, it is saving, or it ended less than 10 seconds ago: the main agent is continued a few seconds after a subagent's card says it ended, and without those seconds the row flickered to "done" and back; the rule in `lib/subagents.ts`), the row is drawn as a running agent's, the word "running" with the pulsing dot, and is not shown as saving [7] as well, so it has one dot and one word. A main agent whose stored status is `failed`, `stopped` or `waiting` keeps its own word, and once no subagent holds its job the row reads "done" again. Only the row changes; the record stays `done`.

### The starting row

#### Context

**Problem**: an agent's [1] row exists only once the daemon has written its record, which lands a beat after Start is clicked, and the daemon's list of agents is polled every two seconds. The start itself takes seconds to report the new agent's id, so the list may hold the agent's row before or after that report. Without a stand-in, Start looks like nothing happened; with a careless stand-in, a second agent appears to be starting beside the real one, or "starting…" stays for ever after a start that produced no agent.

#### Business logic

Once the start reports the new agent's id, a dimmed stand-in row is shown at the top of the list: a pulsing dot, the badge "running", the subtitle "starting…", and as its title the prompt the user typed (or "New agent" when there was none). Clicking it goes to the project's launcher [5]. It is shown in the picked project's [17] list and in the pooled one alike, and never while an agent in the list is already running. Picking another project drops it.

The stand-in retires the moment the list holds the agent with the id the start reported, whatever status that agent landed in: an agent that starts and fails inside one polling interval is never once seen running, and it still counts as the handover. When the list already holds that agent as the start reports it, no stand-in is shown at all, so the agent never appears twice, running or ended. Any other agent in the list never counts. A start whose agent never appears is swept after 20 seconds with no running agent, so the column stops pretending; the launcher shows the actual error. Switching project drops the stand-in.

### Which row is highlighted

#### Context

**Problem**: right after Start, the agent [1] the page navigated to has no row yet, and a just-started agent may not have reported its id at all; the highlight has to land on the row standing in for it rather than on "New agent".

#### Business logic

A row is highlighted when it is the selected agent's; in the pooled list, when it is that agent of the project whose page is open. The stand-in is highlighted while the selected agent's own row has not landed in the list yet.

### What a row shows

#### Context

**User story**: the user reads a row and knows what the agent [1] is doing, how long ago it started, whether it runs on this machine, on a device [12], in a cloud session [4] or was started by another machine's daemon, and which coding agent [3] runs it.

#### Business logic

Each row is a button with two lines.

The first line, left to right:

- a dot, only while the agent is running or waiting: pulsing in the primary color while it is working, still and muted while it waits for the user's answer; and, while the agent is saving [7], a pulsing green dot instead, the same window the agent's own status pill calls "saving…";
- the status word (next section), in uppercase, colored by the stored status when it is the word (primary for running, green for done, amber for stopped, red for failed), muted when waiting or saving, primary for "in cloud", green for "merged";
- the subtitle: in the pooled list, "<project name> · <when it started>"; in a picked project's [17] list, and for a subagent [16] under its main agent, just when it started, as "just now", "<N>m ago", "<N>h ago", "<N>d ago" up to a week, and the local date beyond it (the rule in `lib/format-date.ts`);
- at the right end, a cluster of small glyphs, each with a hover: on a main agent's row, first the count of its subagents [16] (see "Subagents under their main agent"); a laptop glyph named "Started on <host>" with the hover "Started on <host>, by that machine's daemon." when another machine's daemon started the agent, since the shared record lists every machine's agents here; a device glyph named "Runs on <device>" (or "Runs on a connected device" when the device has no label) when the agent is relayed [13]; a cloud glyph named "Runs as a Claude Code cloud session" with the hover "Runs as a Claude Code cloud session; it works and opens its PR over there." for a web agent; and the coding agent's logo, named "Claude Code" or "Codex". The logo names the driver [14] the agent recorded, and every surface Claude runs on — the local CLI, the cloud session, the Actions runner — is still "Claude Code": where it runs is the glyph beside it, not the logo.

The second line is the title: what the user typed as the prompt; failing that, the branch itself; failing that, the moment it started as a short local date and time (the rule in `lib/agent-label.ts`). A subagent's [16] row under its main agent shows only the first line of that.

### The status word

#### Context

**Problem**: a web agent's local process ends at its hands-off by design, so its stored status is "done" from that moment on, which says nothing about the cloud session [4] still working, parked on a question, or long finished. And an agent that ended cleanly is "done" in its record while the tool that runs it is still recording it and pushing its branch.

#### Business logic

The word, by the first rule that applies:

- "waiting": the agent's [1] stored status is `waiting` (it ended on its question and waits for the user's answer), or it is a web agent whose cloud session the bridge [9] reports as parked on a question.
- "in cloud": a web agent whose local half is done, with no pull request known, no question pending, and started within the last 12 hours (the window in `src/cloud-run-state.ts`). This outranks "saving…": the cloud side owns its own push and pull request.
- "merged": a web agent whose adopted work (cloud work adoption [10]) had its pull request merged by The Framework.
- "saving…": a non-web agent the daemon marks saving [7]: it ended cleanly and its process is still alive on this machine.
- Otherwise the stored status: "running", "done", "stopped" or "failed". A main agent that is `done` while one of its subagents [16] holds its job counts as `running` here and is not marked saving (see "Subagents under their main agent"). A web agent past the 12-hour window with nothing adopted, or with a pull request, reads "done"; a web agent that was stopped or failed reads that.

### Long titles

#### Context

**Problem**: the column has a fixed width, and a long prompt has to stay readable without a scrolling marquee that forces reading at its own pace.

#### Business logic

A title wider than the column is clipped with a fade at its end and shows the full text in a tooltip to the right on hover, wrapped and never wider than a readable paragraph. A title that fits is plain text with no tooltip at all.
