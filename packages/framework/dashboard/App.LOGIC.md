Composes the dashboard: reads what is selected off the URL, keeps the sidebar, the main pane and the right rail around whichever page the URL names, runs the polls that every page shares, holds the selected agent's [1] live event stream [2], and turns two of the polled feeds into browser notifications.

## Context

**User story**: the user opens the dashboard, picks a project, presses Start and watches the agent [1] work. Later the user pastes the agent's link into another tab, reloads it, opens two agents side by side, or presses Back, and lands exactly where the link says. A tab left in the background tells the user from its title and icon whether something needs them and whether an agent is working. When the daemon stops answering, the page says so instead of freezing silently.

**Problem**: which page, which project and which agent are selected must agree across the sidebar, the main pane, the right rail, the polls and the live stream at once. Kept as several pieces of in-memory state, they can disagree about which agent is in play. Kept in the URL, they cannot, and every selection becomes a link.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] Settings: the settings page.
[4] the Overview: the dashboard's cross-project page at `/`.
[5] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[6] agent view: one agent's page.
[7] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[9] context set: the files and repository paths the user picked to focus the next agent on, shown as `#` chips in the composer and as checked files in the right rail's "Files" tab.
[10] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[11] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[12] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[13] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[14] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[15] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[16] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[17] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[18] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[19] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **The URL is the selection** - every page, project and agent [1] the dashboard can show is a path, so Back, reload, bookmarks and side-by-side tabs all work and no two parts of the page can disagree about what is selected.
- **The frames around every page** - the sidebar is on every page, the right rail only while a project is selected and never beside the tickets pages, and a warning bar sits above everything while the daemon is not answering.
- **What the main pane shows** - the URL resolves, in order, to Settings [3], a ticket's plan page, a ticket's page, the tickets page, the Overview [4], "No such project", the project home [5], "This agent is gone", or the agent view [6], which is one and the same page for a running and a finished agent.
- **Starting an agent from any page** - a start goes to the new agent at once, before its record exists, and a start that returns no id lands on the project home and adopts the running agent as soon as it appears.
- **What is polled, and how often** - the polls that several pages share run once here: the project's agents every 2 seconds, its files every 10, the interventions [7] every 15, the registered projects every 30, the activity feed only while it can notify, the cross-project recents only on the Overview, and "is any agent working" and "is the daemon answering" every 5.
- **The selected agent's live stream** - one live stream follows the agent in the URL and feeds both the agent view and the rail's views [8]; a new start empties it, a continuation keeps it.
- **The context set** - the context set [9] is one selection shared by the composer and the rail, cleared when the project changes, when an agent starts, and on "New".
- **Browser notifications** - a new intervention notifies when its category (default on) and browser delivery (default on) are both on; a started or finished agent notifies only when the "New activity" category (default off) is on as well.
- **The browser tab reports the state** - the tab title carries the intervention count and the selected project's name, and the tab icon animates while any agent anywhere is running.
- **The daemon-unreachable banner** - a probe every 5 seconds turns a silent daemon into the bar "The daemon is not answering — retrying. Everything on this page is frozen until it returns."

## Business logic

### The URL is the selection

#### Context

See `## Context`.

#### Business logic

The path names the page; the rule that reads it lives in `lib/route.ts`:

- `/` is the Overview [4].
- `/settings` is Settings [3].
- `/tickets` is the tickets page: every registered project's tickets, one section each, with no project selected.
- `/{project}` is the project home [5] of the project with that id.
- `/{project}/{agent id}` is the agent view [6] of that agent [1], running or finished; the second segment is the agent id [10].
- `/{project}/tickets` is the tickets page as well; the project segment adds nothing to it.
- `/{project}/tickets/{ticket}` is one ticket's own page, the ticket addressed by its file name.
- `/{project}/tickets/{ticket}/plan` is that ticket's plan page.
- Any other path is the Overview, and segments beyond the ones above are ignored. A project or agent named in the path that does not exist is handled by the main pane (see "What the main pane shows").

Every click that changes the selection writes a new path, and so a new browser history entry: Back and Forward move the selection, and going where the page already is adds no entry. The one exception is the correction that adopts a just-started agent's id (see "Starting an agent from any page"): it replaces the current entry instead of adding one, since it is not a step the user took.

Where each control lands:

- Selecting a project in the sidebar's picker lands on its project home, never on one of its agents.
- "New" in the sidebar lands on the named project's home with the context set [9] cleared, even when that project is already the selected one.
- A row naming an agent of another project (the Overview's recent agents, its agents, its hot tickets) lands on that agent directly, without passing through its project's launcher.
- The brand mark and "Overview" land on the Overview; the sidebar's "Settings" gear lands on Settings; "Tickets" lands on the tickets page; a ticket row lands on the ticket's page; a plan link lands on the plan page; "Back" from a ticket's page or plan page returns to the tickets page.
- Every explicit selection also ends the follow of a just-started agent that has no id yet.

### The frames around every page

#### Context

**User story**: whatever page is open, the user keeps the sidebar on the left: "New", "Overview", "Tickets", the projects picker, the "Recent agents" list and, in its footer, which daemon the dashboard is talking to, the theme, notifications and "Settings". While a project is selected, the rail on the right offers the "Files", "Views", "Browser" and "Docs" tabs.

#### Business logic

- The sidebar is present on every page and collapses and reopens with Cmd/Ctrl+B (the shortcut lives in `components/ui/sidebar.tsx`). It is handed everything it shows: the selected project's agents [1] and which one is selected; on the Overview [4], the recent agents pooled across every project; the registered projects; the count of interventions [7], for the badge on "Overview"; whether any agent is working, for the animated brand mark; the prompt of a just-started agent, for its "starting…" row; and whether the tickets page is the current one, so that "Overview" and "Tickets" are never both highlighted. Adding a project from the sidebar reloads the projects and the agents at once instead of waiting for their next poll. What its rows and menus do is described in `components/AgentHistory.tsx`.
- The main pane shows the page the URL names (see "What the main pane shows").
- The right rail exists only while a project is selected, and never beside the tickets pages, which take the full width. It is handed the selected agent's views [8]; the project's files and the context set [9], for its "Files" tab; whether the selected agent is running with a browser preview, for its "Browser" tab; the agent's location [11], since some locations have no browser to show; and whether the project home [5] is already showing the docs in its own column. That last is the case exactly when the project home is the main view (a registered project selected, no agent selected or being adopted, not Settings [3]), and the rail then withholds its "Docs" tab. Which tabs the rail offers is decided in `components/RightRail.tsx`.
- Above the whole workspace, while the daemon is not answering, sits the bar described in "The daemon-unreachable banner".
- The workspace row is the height of the window and never scrolls as a whole: each column scrolls on its own, and the page never scrolls sideways.

### What the main pane shows

#### Context

**User story**: the user follows a link. A link to an agent [1] whose checkout [12] was removed, or to a project dropped from the registry, says so and offers the way back, rather than silently landing somewhere else as if the link had worked.

#### Business logic

The first rule that matches decides the page:

1. Settings [3], when the path says so: from there the onboarding checklist can start an agent and select a project, and "Done" returns to the Overview [4].
2. A ticket's plan page, when the path names a project, a ticket and the plan flag.
3. A ticket's own page, when the path names a project and a ticket.
4. The tickets page, for any other tickets path.
5. The Overview, when no project is selected; it is handed the interventions [7] for its card.
6. "No such project", when the project id is not among the registered projects. The page reads `No project is registered as "<id>". It may have been removed, or the link may be from another machine.` and offers "Go to the Overview". It is declared only once the projects poll has answered with at least one project, so a link never flashes it while the first read is still out; with an empty registry the check never fires.
7. With no agent selected: while a start that returned no id is being adopted, the agent view [6], live, showing the project's own output under the typed prompt (and, for an agent relayed [14] to a device [13], that device's label); otherwise the project home [5], handed the live events, the files, the context set [9] and what the daemon currently finds wrong with the project, for its banner.
8. With an agent id that is not among the project's agents: if it is the agent just started here, or the agents list has not been read yet, the agent view, live, labeled with the typed prompt, because the record lands a beat after the start and a bookmarked link must not flash "gone" before the first read. Otherwise "This agent is gone": `It is not in this project's agents. An agent disappears when its worktree is removed.` with "Back to the project", which returns to the project home.
9. The agent view of the listed agent: live exactly while its status is `running`; labeled by what the user typed, else its session name [15], else its branch, else its start time (the rule in `lib/agent-label.ts`); told its location [11], the device it runs on when relayed, and what its handoff [16] is armed to do, as the default for the handoff controls. A running and a finished agent get the same page, so an agent ending changes what its bar, feed and composer say without replacing the page. Deleting the agent from its page returns to the project home and reloads the agents list so its row is gone.

### Starting an agent from any page

#### Context

**User story**: the user presses Start in a launcher, sends a message that continues a finished agent [1], or starts an agent from the Overview's [4] onboarding checklist, from Settings [3] or from the tickets page. The new agent is on screen at once, and Back returns to where it was launched from.

#### Business logic

- A start reports the project it started in (not always the selected one), the prompt that was typed, the agent id [10] the daemon allocated when it has one, and, for an agent relayed [14] to a device [13], that device's label.
- The dashboard goes to the new agent immediately, as a real history entry. The main pane shows the agent view [6] live on the strength of the id alone, before the agent's record exists; the sidebar shows a "starting…" row carrying the typed prompt until the real row lands; and the agents list is reloaded right away rather than at its next poll.
- The live feed on screen is emptied for a new agent, but not for a continuation: when the reported id is the agent already on screen in the same project, which is a message of live chat [17] resuming an ended agent, the transcript keeps its history and the new turn appends to it.
- The context set [9] is cleared: the picked files went with that agent, and the next launch starts from a clean focus.
- A project with no git repository behind it gets no checkout [12] for its agent, so such a start hands back no id and there is nothing to go to yet. The dashboard then lands on the project home [5] showing the project's live output under the typed prompt, and adopts the first agent the agents poll reports as `running`, replacing the URL rather than adding a history entry; such a project runs one agent at a time, so the running one is this one. This is the only place the selection is inferred rather than read off the URL, and any explicit selection cancels it.

### What is polled, and how often

#### Context

**Business logic story**: the dashboard is a projection of files the daemon writes. Apart from the selected agent's [1] live stream, everything on screen is polled, and a poll that several pages need runs once here so the pages agree.

#### Business logic

- The selected project's agents, live and archived [18], every 2 seconds (`lib/use-agents.ts`): the sidebar's rows and the main pane's routing read one list.
- The selected project's files every 10 seconds, scoped to the selected agent's checkout [12] when an agent is selected (the same checkout its branch, preview and open-folder actions act on), so a file the agent creates shows up without a reload; empty when no project is selected.
- The interventions [7] across every project every 15 seconds, always: they feed the sidebar's badge, the Overview's [4] card, the tab title and the notifications. The cadence is slow because each poll asks GitHub once per project.
- The registered projects every 30 seconds: the sidebar's picker, the tab title, the "No such project" check and the project home's [5] banner of what the daemon currently finds wrong with the project all read it, and that last state appears and clears on the daemon's own cadence. Adding a project reloads it at once.
- The activity feed every 15 seconds, only while it can notify (see "Browser notifications"): the notification is its only reader on this page.
- The recent agents pooled across every project every 10 seconds, only on the Overview: a selected project's own agents fill the sidebar otherwise.
- Whether any agent in any project is running, every 5 seconds (`lib/use-working.ts`).
- Whether the daemon answers at all, every 5 seconds (see "The daemon-unreachable banner").
- A poll that fails keeps what it last showed rather than blanking it, and a list counts as unread until its first answer after the selection changes (`lib/use-async.ts`); that is what lets the main pane tell "not there" from "not read yet".

### The selected agent's live stream

#### Context

**Business logic story**: an agent's [1] events reach the browser as they are written, over one live stream per selected agent. The agent view's [6] transcript and the right rail's "Views" tab both read it, so the one subscription is held here.

#### Business logic

- The stream follows the agent in the URL. With a project selected and no agent, it follows the project's own events, which is where an agent without a checkout [12] writes. With no project selected there is no stream.
- Selecting another agent resubscribes to that agent's events. A new start empties the accumulated feed without resubscribing, so the pane waits empty for the new agent's first line instead of showing the previous agent; a continuation of the agent on screen keeps the feed.
- The views [8] for the rail are read off the newest segment of the feed, since a resumed agent appends a second segment to the same journal, and a view shown again under the same id updates in place (`lib/live-state.ts`).
- The agent view is told when the stream is lost and being retried, so it can say the feed may be behind reality. Reconnection, replay and retry rules live in `lib/use-live-events.ts`.

### The context set

#### Context

**User story**: the user clicks files in the rail's "Files" tab or types `#` in the composer to point the next agent [1] at particular files, or checks the whole repository; both places show the same selection.

#### Business logic

The context set [9] is one selection with add, remove and toggle, shared by the composer and the rail. It is cleared when the selected project changes (keyed off the URL, so Back and Forward clear it too), when an agent starts, and on "New", which stays in the same project and would otherwise keep the old selection.

### Browser notifications

#### Context

**User story**: with the tab in the background, the user hears when something needs them and, if switched on in Settings [3], when an agent [1] starts or finishes.

#### Business logic

- Two feeds notify: the interventions [7] and the activity feed. Each fires only when its category is on in the preferences [19] and browser delivery is on. The defaults are on for browser delivery and for the interventions' category, off for "New activity"; they are the daemon's own defaults (`src/preference-defaults.ts`), so the page and the daemon's Discord watcher agree. The browser's own notification permission is the last gate, checked in `lib/use-notifications.ts`.
- The interventions are polled whether or not they notify, since the badge and the Overview [4] need them; the activity feed is polled only while its notification would fire.
- The notifier is handed the whole read, the items and which projects the read actually reached, so an outage is never taken for an empty backlog. That baseline rule and the wording of each notification live in `lib/use-notifications.ts`.
- Discord delivery is the daemon's own watcher and does not depend on this page being open.

### The browser tab reports the state

#### Context

**User story**: several dashboard tabs are open; the one that needs attention says so in its title, and the icon shows at a glance whether the AI is working for the user.

#### Business logic

The tab title is `(N) <project> — The Framework`: the intervention [7] count, omitted when zero, then the selected project's name, omitted on cross-project pages (composed in `lib/document-title.ts`). The tab icon is the animated brand mark while any agent [1] in any project is running and the still mark otherwise, deliberately not scoped to the selected project: an agent left going elsewhere still means the AI is working for the user (`lib/favicon.ts`).

### The daemon-unreachable banner

#### Context

**Problem**: a dead daemon is otherwise invisible. The polls keep their last value and the live stream retries quietly, so "the agent went quiet" and "nothing on this page is live" look identical.

#### Business logic

Every 5 seconds a cheap read (the projects list) probes the daemon (`lib/use-daemon-health.ts`). While the probe fails, a warning bar sits above the workspace: "The daemon is not answering — retrying. Everything on this page is frozen until it returns." It goes away on the first answer; the polls and the stream recover by themselves.
