Answers everything the dashboard reads about a project or an agent [1]: the agent history, one agent's replay, what named working agents are doing now, the project's surfaced documents, the cross-project rollups the Overview [2] and the launcher show, the files of a checkout [3] for the composer's picker, where an agent is working and what its handoff [4] left behind, and the state of the Claude web bridge [5]. Every read is forgiving: an unknown project or a failing read answers the empty shape (an empty list, an empty map, nothing) rather than an error, and a read about an agent relayed [6] to a device [7] is answered by that device.

## Context

**User story**: the user opens a project and sees its agents, newest first, each with its status; opens an agent and sees its events replayed, the checkout it is in, and, once it has ended, the branch, commits and pull request it left; opens the Overview and sees what is running everywhere, what needs a human, and what happened recently. Every one of those panels polls one of these reads.

**Business logic story**: the dashboard is a projection of the same files the daemon and the agents write. Each read resolves the project id to the project's path, then the agent id to the checkout that agent works in when the read is about one agent, and hands the path to the reader that owns those files (the readers live in `dashboard/`, `store/` and the skill packages). What the disk cannot know, the daemon adds on the way out.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] the Overview: the dashboard's cross-project page at `/`. project home: a project's own page with the launcher (the Start form) and its composer. agent view: one agent's page.
[3] checkout: an agent's own working copy of the project, where it works; the project's branches provider (`../store/branches.ts`) says where it is and which branch it is on.
[4] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself only when its task or the person asks; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[5] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[6] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[7] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[8] agent id: an agent's stable id, derived from the moment it started; it names the agent's card and diary, its branch until the agent names it, and its run.
[9] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[12] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[13] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[14] retained checkout: the checkout of an agent that has ended and is still on disk, kept so the user can inspect what the agent left; nothing removes it on a timer.
[15] event / diary: everything an agent does, one event per line of the agent's diary `<id>.jsonl`, which the tool that runs the agent keeps in the agent's checkout while it works and records on the `agent-data` branch when it ends.
[16] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[17] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[18] open question: a question nobody has answered yet, as the dashboard lists them across projects.
[19] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[21] pick: the answer to a gate: the option or options the user chose.
[22] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[23] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.

## Business logic — TL;DR

- **Every read answers empty rather than failing** - an unknown project, an unknown agent, an unsafe id or a reader that throws all yield the read's own empty shape.
- **The agent history** - a project's agents newest first, the live ones prepended to the recorded ones, one row per id with the live copy winning, and the agents relayed to devices merged in from the daemon's memory.
- **What only the daemon knows about an agent** - a `web` agent whose cloud session is waiting on a human is marked waiting, an agent another machine's daemon started is marked as from another host, and an agent that ended clean while its process is still alive on this machine is marked saving.
- **An agent's replay** - the agent's events, from the diary in its checkout while it has one, else from its run on the `agent-data` branch; nothing when it is in neither.
- **What working agents are doing now** - for the agents of a project named by id, what each one that is working is doing at this moment, by id; an agent that is not working has no entry.
- **Retained checkouts** - the ids of ended agents whose checkout is still on disk, live agents excluded.
- **Where an agent is working** - while it has a checkout: the checkout's path, its branch, whether it holds uncommitted changes, its size once nothing writes to it, and the pull request that belongs to this agent and not a predecessor's; once the checkout is gone, only the branch and the pull request the agent recorded.
- **Documents** - the surfaced documents at the project root.
- **Cross-project rollups** - the aggregated agent queue, the Overview, recent agents, interventions, open questions, activity and the dashboard page, each built over every project the registry lists.
- **The files of a checkout** - every file git sees (from the agent's own checkout when an agent id is given), for the composer's `#` picker and the count of the Context's files; the Files tab, the diffs and what an agent changed are the Files module's own reads, through the module calls (`modules.ts`).
- **The repository a project is offered** - for a project with no remote, the repository its provider would create and the host's name (`../store/repository.ts`); nothing when there is no provider, a remote is there, or the host cannot be reached.
- **The project's page on its git host, and git status** - the project's page and the git host's name, as the git host provider answers them; the branch, dirty flag and linked pull request of the project or of one agent's checkout, filtered to that agent's lifetime.
- **What an agent's handoff left behind** - the agent's own branch, as the project's branches provider answers it, measured with the commit the agent's own work begins at when its record names one, plus the agent's pull request; a gone branch of an agent that changed nothing is marked so; a subagent [23] its main agent landed is read by the last commit its record kept and marked landed; an agent that recorded neither a branch nor a landed commit has no handoff.
- **The bridge's state** - the question a cloud session is parked on, where the picked answer stands, what the session has said, whether anything reached the bridge and how, the bridge token while the bridge is on, and the bridge browser's state.
- **Reads about a relayed agent go to the device** - the reads that are about one agent's checkout are answered by the device that runs the agent, and an unreachable device answers the read's empty shape.

## Business logic

### Every read answers empty rather than failing

#### Context

**Problem**: a panel that polls must render something on every answer. A project id nobody registered has no path to read from, a reader can throw on a repository in an odd state, and none of that is the panel's problem.

#### Business logic

A read about a project resolves the id through the registry and, when no project has that id, answers its empty shape at once; when the reader throws, the answer is the same empty shape. A read about one agent resolves the agent id [8] to the checkout [3] the agent works in (its own checkout while it exists, else the project's root, the rule being `context.ts`'s) and is just as forgiving. The one exception is where an agent is working, which never falls back to the root (see below). A read over every project treats a registry that cannot be read as an empty project list. The empty shapes are the natural ones: an empty list for a list, an empty map for a map, nothing for a single item.

### The agent history

#### Context

**User story**: the project's agent list shows an agent the moment it starts, with a running status, not only after it ends; an agent the user continued after it stopped shows as one row that is running again, never as a finished duplicate; and an agent running on a device survives a reload of the dashboard.

#### Business logic

A project's agents are the live ones prepended to the recorded ones, newest first. The live agents are read from the card in every checkout the project's branches provider lists; the recorded ones are the project's runs [9] on the `agent-data` branch [11] (the store's reads, `store/`). There is one row per id, and where both a live and a recorded copy exist the live one wins, so a resumed agent reads as running rather than as its recorded first leg. The status is not filtered on: an agent that ended waiting on a question, its checkout kept, keeps its row. The agents this daemon relays [6] to devices exist only in the daemon's memory, so their in-memory records are merged in first and win an id tie, being the live authority; that is what lets a reload re-open a relayed agent instead of losing it. Every local row is annotated as described next.

### What only the daemon knows about an agent

#### Context

**Problem**: the records on disk cannot say three things the user needs to read off a row. A `web` agent's record says done whether its cloud session [12] is parked on a question or finished hours ago, because the agent ends at its hands-off; only the bridge's store knows the session is waiting. The `agent-data` branch is shared precisely so other machines' agents show up, but a row that looks exactly like one of this daemon's own sends the user to the raw record to learn whose it was. And an agent's card says done before the tool that runs it has finished: that tool still records the run on the `agent-data` branch and cleans up the agent's checkout after the card says done, and a row that said "done" through that window read as finished with nothing coming.

#### Business logic

An agent whose location [13] is `web`, which has a session id, and whose cloud session the bridge reports as waiting on a human (the bridge holds the question it is parked on, or claude.ai's session list shows it awaiting input within the session window; the rule is `dashboard/bridge-store.ts`'s) is marked as cloud-waiting, so its row says so instead of "in cloud". Every other agent passes through untouched. An agent whose recorded host differs from this machine's hostname is marked as from another host; an agent with no recorded host predates the field and says nothing about where it ran. An agent whose status is done, whose record names a process id and this machine's hostname, and whose process is still alive is marked saving; an agent with any other status, of another host, with no recorded process id, or whose process is gone passes through untouched, since only this machine can ask whether its own process is alive. The three marks are added on the way to the dashboard and never stored.

### An agent's replay

#### Context

**User story**: the user opens an agent that has ended and sees everything it did, replayed.

#### Business logic

The replay is the agent's events [15]: the diary in its checkout while it has one, else its run's [9] diary on the `agent-data` branch, each line turned into the event it records; an unknown or unsafe id, or a project that is gone, answers an empty list. For a relayed agent the replay comes from the device.

### What working agents are doing now

#### Context

**User story**: on a main agent's page, each working subagent's [23] line says what the subagent is doing now; the page asks every 2 seconds while a subagent is working (`dashboard/components/AgentView.tsx`).

#### Business logic

The read takes a project and a list of agent ids [8] and answers a map from id to one line: what that agent is doing now, as the store reads it off the diary [15] in the agent's checkout [3] (the last tool use or the last thing the agent said; the rule is `store/agent-store.ts`'s). An agent that has no checkout on this machine, is not `running`, or has done nothing yet has no entry. An unknown project, or a read that fails, answers an empty map. The read is never forwarded to a device [7].

### Retained checkouts

#### Context

**User story**: the dashboard offers to remove the checkout an ended agent kept, and only those.

#### Business logic

The answer is the ids of the checkouts the project's branches provider lists whose agent is not running; a live agent's checkout is in use, not retained [14], and is left out. An unknown project, a project with no provider or an unreadable listing answers an empty list.

### Where an agent is working

#### Context

**User story**: an agent's action bar says which checkout the agent has, on which branch, whether it holds uncommitted changes, how much disk the checkout takes once the agent is done, and which pull request its branch has. Once the agent has ended and its checkout is gone, the bar says only its branch and its pull request.

**Problem**: the git status bar reads the project, so without this an agent's own branch was visible nowhere, and a retained checkout was a name in a list with no size and no way in. And an agent on a branch name an earlier agent already used must not wear a predecessor's merged pull request as its own. And an ended agent whose checkout is gone must not wear the user's own checkout's branch and "clean" as its own.

#### Business logic

The project must be known and the id safe for a path, else the answer is nothing. Every agent works in a checkout of its own, so the answer is about that checkout, as the project's branches provider lists it, and never about the project's root: the root is the user's checkout, and its branch and uncommitted changes are the user's.

While the agent has a checkout, the answer is the checkout's path, and the git status read there gives the branch and the dirty flag. The pull request is filtered to the agent's lifetime: the agent's start time is derived from its id, and only an open pull request, or a closed one no older than the agent, counts. The size is the branches provider's sized listing's, read only once the agent is no longer running, because a tree being written to has no size worth reporting.

Once the checkout is gone, there is no tree left to be clean or dirty, so the answer carries no path, no dirty flag and no size: only the branch the agent's record names and the pull request the agent recorded, read live for its state. An agent with neither a checkout nor a record answers nothing.

In both cases the pull request may be reported as still being looked up rather than absent, so the bar asks again shortly.

### Documents

#### Context

**User story**: the project home lists the surfaced planning documents. (The project's tickets are no read of the daemon's any more: the tickets package's own module reads them through its command, `modules.ts`; the daemon reads tickets only for the rollups it composes, through the provider the package declares.)

#### Business logic

The surfaced documents are read at the project root in sidebar order (`dashboard/docs.ts`).

### Cross-project rollups

#### Context

**User story**: the Overview [2] shows what is running now across every project, the size of the agent queue [16], recent agents, the pull requests that need review, every agent's open question [18] with its full gate [19], and the "New activity" feed.

#### Business logic

Each rollup is built over every project the registry lists (the builders are `dashboard/overview.ts`, `dashboard/queue.ts`, `dashboard/interventions.ts`, `dashboard/open-questions.ts`, `dashboard/activity.ts` and `dashboard/dashboard.ts`), and a registry that cannot be read means no projects. Recent agents carry the same annotations as the agent history. The interventions [17] and the activity feed report, beside their items, which projects were read whole: a project whose sources could not be read contributes no items, exactly like a project with nothing waiting, and the browser's notifier needs the difference, because a queue that came back empty only because the git host was unreachable is not a baseline to announce the whole backlog against later.

### The files of a checkout

#### Context

**User story**: the composer's `#` picker lists the checkout's files, and the right rail counts the ones picked into the Context. The Files tab lists and marks them itself, through its module's own server part.

#### Business logic

The files are every file git sees in the checkout, tracked and untracked, honoring the ignore rules, repository-relative and sorted. With an agent id the file list reads the agent's own checkout rather than the project's root, and the project's root once that checkout is gone. An unknown project, or a relayed agent's unreachable device, answers an empty list.

### The project's page on its git host, and git status

#### Context

**User story**: the git status bar shows the branch, whether there are uncommitted changes, and the linked pull request; the project links to its page on the git host, labelled with the git host's name.

#### Business logic

The project's page and the git host's name are what the project's git host provider answers for its `home` (`store/git-host.ts`); nothing when the project is unknown, has no git host provider, the provider cannot name a page (no remote of its git host), or the project is on the relay. The git status is the project's, or one agent's checkout's when an agent id is given: that agent's branch and dirty state are the ones that actually belong to it. A read for an agent is filtered to the agent's lifetime, derived from its id, so an agent on a reused branch does not show a predecessor's merged pull request as its own. Not a repository, or no checkout, answers nothing.

### What an agent's handoff left behind

#### Context

**User story**: an agent has ended; its page shows the branch it left its work on, what it committed, what it changed, whether that was pushed or opened as a pull request, and what it left uncommitted.

**Problem**: a clean agent's checkout is removed when it ends, and an agent-addressed read then falls back to the project's root, which would report the project's own branch and the user's own uncommitted changes as though they were the agent's. The branch is what outlives the agent, so the branch is what is asked about.

#### Business logic

The project must be known, the id safe, and the agent found in the project's records, else nothing. The handoff [4] is read off the agent's record by `dashboard/agent-handoff.ts` ("A finished agent's handoff, off its record"): for the branch the agent recorded, through the project's branches provider, with the agent's pull request picked from what happened since the agent started; an agent started from a branch other than the default one (a subagent [23] starts from its main agent's) is measured from the commit its record says its own work begins at, so the page shows its own commits and files and not the other branch's. An agent whose work the default branch already contains is measured from that commit too, so the page still shows what it did. A subagent its main agent landed has no branch left: its handoff is read by the last commit its record kept, with no pull request lookup, and is marked as landed. An agent whose record carries neither a branch nor a landed commit, or a project with no branches provider, answers nothing. When the branch is gone and the agent changed nothing (the rule is `dashboard/agent-handoff.ts`'s), the handoff is marked as unchanged, so the page says the agent made no changes rather than that its branch is gone.

### The bridge's state

#### Context

**User story**: a `web` agent's page shows the question its cloud session [12] is parked on, where the pick [21] the user made stands (queued, delivered, or failed with the extension's reason), and what the session has said so far; Settings shows whether the extension has ever reached the daemon and how it went, offers the bridge token to paste into the extension, and shows the bridge browser's state.

**Problem**: the bridge sees a claude.ai page, which knows its own session and nothing about agents, so these reads are keyed by the cloud session's id; the agent view derives that id from the agent's own record, and the join happens in the browser. An extension that is misconfigured looks exactly like one that is not installed, since both leave no question behind, so the last contact is reported even when it was refused: a refused request at least proves something is trying.

#### Business logic

A session id that does not look like a cloud session id (`session_` followed by up to 128 letters or digits) answers nothing, or an empty transcript. The parked question is whatever the bridge last reported for that session, nothing when there is none; the answer is the one the user picked in whatever state it is, nothing when none was picked; the transcript is what the bridge scraped, in order. The bridge's status is the last contact (when, which route, and the status it got), how many questions are parked, what the page script last said about itself, and the extension's last version claim with whether it was turned away. The bridge token is handed out only while the bridge preference [22] is on, so a daemon with the feature off never hands the secret to a page; it is nothing otherwise, and nothing when no token exists. The bridge browser's state is off, starting (with the step it is on), running (since when, visible or not, and whether the claude.ai tab sits on the sign-in page), or stopped and why.

### Reads about a relayed agent go to the device

#### Context

**Problem**: an agent relayed [6] to a device [7] has no checkout here. Everything about its checkout, its branch and its events lives on the device.

#### Business logic

The replay, where the agent is working, the checkout's files, the git status and the handoff are forwarded to the device when the agent id names an agent this daemon relays, and the device's answer is returned (the forwarding is `relay-agent.ts`'s). A device that cannot be reached, or refuses, answers the read's own empty shape, so the dashboard never has to special-case a relayed agent. Reads about a project rather than an agent, and the bridge reads, are never forwarded.
