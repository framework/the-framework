The dashboard's shell: it decides which page the user is looking at, keeps the live data every page shares flowing, and raises the alerts that belong to the whole app rather than to one page.

## User story

- The user opens the dashboard and lands on the Overview, moves between projects, agents, tickets and settings, and expects every one of those places to be a link they can bookmark, reload, share, or reach with the browser's Back button.
- The user leaves the dashboard in a background tab and expects the tab itself — its title and its icon — to tell them when an agent is working and when something needs them.
- The user expects to be told when the daemon has stopped answering, instead of staring at a page that silently stopped updating.

## Business logic — TL;DR

- **The URL is the selection** - which project, which agent, and which page are read from the address, so the app can never disagree with itself about what is on screen.
- **One frame, three columns** - the agents-and-projects sidebar, the main pane, and the right rail, with the main pane swapped per route.
- **Live and finished look the same** - a running agent and a finished one are shown in the same frame, so an agent ending changes what the frame says without the page rebuilding.
- **One live stream, shared** - the selected agent's event stream is opened once by the shell and read by both the main pane and the right rail.
- **The just-started agent** - a freshly started agent is shown immediately, before the daemon has written anything about it.
- **The picked context is per project** - the file selection shared by the launcher and the rail's file tree, cleared when the project changes and when an agent is started with it.
- **Cross-project polls live in the shell** - interventions, projects, and recent agents are polled once here and shared by everything that shows them.
- **Notifications** - a browser notification when something lands on the "needs you" queue, and one for the new-activity feed, each only when the user has switched that category and browser delivery on.
- **The tab tells you what is happening** - the browser tab's title carries the selected project and the needs-you count; its icon says whether an agent is working.
- **A dead daemon says so** - a banner states that the daemon is not answering and that the page is frozen until it returns.
- **Dead ends are pages, not blanks** - an address naming a project or an agent that does not exist renders an explanation with a way out.

## Business logic

### The URL is the selection

#### User story

The user wants to paste an agent's address to a colleague, reload without losing their place, keep two agents open side by side, and have Back return them to where they launched from.

#### Business logic

The address alone says what is on screen: the Overview at the root, a project's home and launcher under the project, one agent under that project, plus the settings page, the tickets list, one ticket's page, and that ticket's plan page. Every navigation the shell offers — picking a project, picking an agent, opening a ticket, going to settings — is an ordinary history entry, so Back and Forward work throughout, and reopening the dashboard returns to the project the user was last in.

#### Rationale

Which agent was in play used to be several independent pieces of state — the selected agent, the just-started agent, and a follow-the-live-feed flag — reconciled every time the screen was drawn, and they repeatedly disagreed about which agent the screen was about. An address cannot disagree with itself.

### One frame, three columns

#### User story

Wherever the user is, they want the same way back to their agents, their projects, and the Overview.

#### Business logic

Every route is drawn inside the same frame: the sidebar listing the project's agents (or, on the Overview, recent agents pooled across all projects) together with the projects list and the global navigation; the main pane; and the right rail with the file tree and the agent's views. The tickets page and the settings page take the whole main pane, and the tickets page drops the right rail entirely. On a project's launcher the rail's documents move into the main column, since the launcher has room for them; an agent's own page keeps the full rail.

### Live and finished look the same

#### User story

The user is watching an agent work and it finishes. Nothing should jump, reload, or be lost.

#### Business logic

A running agent and a finished one are rendered by the same view; only whether it is live differs. The action bar, the event feed and the message composer change what they offer as the agent ends, without the view being rebuilt around the user.

### One live stream, shared

#### User story

The user watches an agent's output in the main pane while its browser preview or one of its views is open in the right rail; both must show the same agent at the same moment.

#### Business logic

The shell opens the live event stream for whichever agent the address names and hands it to both the main pane and the rail, so there is one stream rather than one per panel. The rail's views are scoped to the agent's newest stretch of work, while the feed keeps the whole journal — so resuming a finished agent appends to the transcript instead of blanking it.

### The just-started agent

#### User story

The user types a prompt and presses Start. Something must happen at once, even though the daemon needs a moment to spawn the agent and write its first status.

#### Business logic

On Start the sidebar immediately shows a row for the new agent carrying the prompt the user typed, and the app navigates to that agent, whose live output streams before its status record exists. An agent missing from the project's list is treated as still starting when it is the one just started or when the list has not been read yet; only an agent genuinely absent from a list that was read is reported as gone.

A project with no git checkout gets no worktree, so starting there hands back no agent to navigate to. In that one case the app lands on the project, follows the live output, and adopts the running agent as the selection as soon as the project's agents are read — a correction rather than a step, so it does not add a history entry the user would have to press Back through. Any explicit choice by the user — picking an agent, switching project, starting a new agent — ends that follow.

Starting an agent can also happen from places where no project is selected, such as the onboarding checklist on the Overview and on the settings page, so the project the agent started in is named rather than assumed to be the selected one.

#### Rationale

The one-agent-at-a-time guess is only safe in the no-worktree fallback, because the daemon allows a single agent per project there. It is the only place in the app where the selection is inferred rather than read from the address.

### The picked context is per project

#### User story

The user picks the files an agent should focus on, from the launcher's file chips or from the rail's file tree — the same selection, whichever surface they use.

#### Business logic

The shell owns the picked context so both surfaces share one selection. It is cleared when the project changes — including when the change comes from Back or Forward rather than from a click — and again once an agent has been started with it, so the next launch starts from a clean focus.

### Cross-project polls live in the shell

#### User story

The sidebar badge and the Overview card both show how many things need the user; they must agree, and asking the daemon twice for the same answer is waste.

#### Business logic

The shell polls the cross-project reads once and shares them: the "needs you" queue on a slow cadence because it costs the daemon a GitHub query per project; the registered projects, whose per-project problems appear and clear on the daemon's own schedule and drive the sidebar's warning dot and the project banner; the selected project's files, scoped to the selected agent's worktree so files the agent creates appear without a reload; and, on the Overview only, the recent agents pooled across every project, since with no project selected the sidebar has none of its own to show.

The new-activity feed's only consumer in the browser is its notification, so it is polled exactly when that notification could fire and not otherwise.

### Notifications

#### User story

The user works in another window and wants to be told when an agent needs them — but only about the things they asked to be told about.

#### Business logic

A browser notification fires when a new item lands on the "needs you" queue, and, separately, for the new-activity feed of agents starting and finishing. Each requires both that the user switched that category on and that browser delivery is on. The notifier is told which projects the poll actually reached, so a project that could not be read is not mistaken for one whose items are all new. Discord delivery is not affected by any of this: the daemon delivers that itself.

### The tab tells you what is happening

#### User story

The dashboard sits in a background tab. Its title and icon are all the user can see.

#### Business logic

The browser tab's title carries the selected project's name and the count of things needing the user, so a backgrounded tab says which project wants attention. The tab's icon reflects whether an agent is currently working.

### A dead daemon says so

#### User story

The user's screen has stopped changing. Either their agent went quiet, or the whole page is stale — and those look identical.

#### Business logic

The shell checks whether the daemon answers at all and, when it does not, shows a banner across the top of the app saying that the daemon is not answering, that it is being retried, and that everything on the page is frozen until it returns.

#### Rationale

Without this verdict a dead daemon froze every surface silently: the live streams retry their transport without reporting anything and the polls keep their last value, so a quiet agent and a dead dashboard were indistinguishable.

### Dead ends are pages, not blanks

#### User story

The user follows a link to a project that was removed, renamed, or belongs to another machine; or to an agent whose worktree has since been retired.

#### Business logic

An address naming a project that is not registered renders an explanation and a way to the Overview — and only once the projects have actually been read, so it never flashes while the first read is in flight. An agent that is genuinely absent from the project's agents renders an explanation that an agent disappears when its worktree is removed, with a way back to the project. Deleting the agent that is on screen returns to the project and refreshes the sidebar, so its row is gone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
