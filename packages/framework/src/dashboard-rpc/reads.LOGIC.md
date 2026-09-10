Answers everything the dashboard reads about a project or an agent [1]: the agent history, one agent's replay, the project's surfaced documents, its tickets, the cross-project rollups the Overview [2] and the launcher show, the files of a checkout [3] with their git status, one file's diff or content, where an agent is working and what its handoff [4] left behind, the project's own `SYSTEM.md`, and the state of the Claude web bridge [5]. Every read is forgiving: an unknown project or a failing read answers the empty shape (an empty list, an empty map, nothing) rather than an error, and a read about an agent relayed [6] to a device [7] is answered by that device.

## Context

**User story**: the user opens a project and sees its agents, newest first, each with its status; opens an agent and sees its events replayed, the files it changed with their diffs, the checkout it is in, and, once it has ended, the branch, commits and pull request it left; opens the Overview and sees what is running everywhere, what needs a human, and what happened recently. Every one of those panels polls one of these reads.

**Business logic story**: the dashboard is a projection of the same files the daemon and the agents write. Each read resolves the project id to the project's path, then the agent id to the checkout that agent works in when the read is about one agent, and hands the path to the reader that owns those files (the readers live in `dashboard/`, `store/` and the skill packages). What the disk cannot know, the daemon adds on the way out.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the Overview: The dashboard's cross-project page at `/`. project home: a project's own page with the launcher (the Start form) and its composer. agent view: one agent's page.
[3] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[5] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[6] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[7] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[8] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[9] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[10] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[11] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[12] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[13] location: Where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[14] retained checkout: the checkout of an agent that has ended and is still on disk, kept so the user can inspect what the agent left; nothing removes it on a timer.
[15] event / event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[16] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[17] intervention: Something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[18] open question: A gate nobody has answered yet, as the dashboard lists them across projects.
[19] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[20] routine: A preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[21] the built-in system prompt: The standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[22] pick: The answer to a gate: the option or options chosen, by the user or automatically.
[23] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Every read answers empty rather than failing** - an unknown project, an unknown agent, an unsafe id or a reader that throws all yield the read's own empty shape.
- **The agent history** - a project's agents newest first, the live ones prepended to the recorded ones, one row per id with the live copy winning, and the agents relayed to devices merged in from the daemon's memory.
- **What only the daemon knows about an agent** - a `web` agent whose cloud session is waiting on a human is marked waiting, and an agent another machine's daemon started is marked as from another host.
- **An agent's replay** - the agent's recorded events, from its run on the `agent-data` branch or its archive; nothing when either is gone.
- **Retained checkouts** - the ids of ended agents whose checkout is still on disk, live agents excluded.
- **Where an agent is working** - its checkout's path, whether that checkout is its own, its branch, whether it holds uncommitted changes, its size once nothing writes to it, and the pull request that belongs to this agent and not a predecessor's.
- **Documents and tickets** - the surfaced documents at the project root, the project's tickets off the `agent-data` branch, one ticket's full text, the agent that wrote a ticket's plan, and when the tickets last caught up with GitHub.
- **Cross-project rollups** - every registered project's tickets, the aggregated agent queue, the Overview, recent agents, hot tickets, interventions, open questions, activity and the dashboard page, each built over every project the registry lists.
- **The files of a checkout and their status** - every file git sees, and each file's untracked/modified/deleted status, from the agent's own checkout when an agent id is given.
- **One file's diff, one file's content, and what the agent changed** - the diff of a changed file, the content of an unchanged one, and every changed file with its line counts, always read from the checkout's own git state.
- **The project's GitHub URL and git status** - the URL from the `origin` remote; the branch, dirty flag and linked pull request of the project or of one agent's checkout, filtered to that agent's lifetime.
- **What an agent's handoff left behind** - read from the project's checkout against the agent's own branch, with uncommitted work counted only from the agent's own checkout.
- **The project's own instructions** - the text of `SYSTEM.md`, so the prompt preview can show the whole system prompt.
- **The bridge's state** - the question a cloud session is parked on, where the picked answer stands, what the session has said, whether anything reached the bridge and how, the bridge token while the bridge is on, and the bridge browser's state.
- **Reads about a relayed agent go to the device** - the reads that are about one agent's checkout are answered by the device that runs the agent, and an unreachable device answers the read's empty shape.

## Business logic

### Every read answers empty rather than failing

#### Context

**Problem**: a panel that polls must render something on every answer. A project id nobody registered has no path to read from, a reader can throw on a repository in an odd state, and none of that is the panel's problem.

#### Business logic

A read about a project resolves the id through the registry and, when no project has that id, answers its empty shape at once; when the reader throws, the answer is the same empty shape. A read about one agent resolves the agent id [8] to the checkout [3] the agent works in (its own checkout while it exists, else the project's root, the rule being `context.ts`'s) and is just as forgiving. A read over every project treats a registry that cannot be read as an empty project list. The empty shapes are the natural ones: an empty list for a list, an empty map for a map, nothing for a single item.

### The agent history

#### Context

**User story**: the project's agent list shows an agent the moment it starts, with a running status, not only after it ends; an agent the user continued after it stopped shows as one row that is running again, never as a finished duplicate; and an agent running on a device survives a reload of the dashboard.

#### Business logic

A project's agents are the live ones prepended to the recorded ones, newest first. The live agents are read from every checkout under `.branches/` and from the project root; the recorded ones are the project's runs [9] on the `agent-data` branch [11] plus the transient archive [10] (the store's reads, `store/`). There is one row per id, and where both a live and a recorded copy exist the live one wins, so a continued agent reads as running rather than as its archived first leg. The status is not filtered on: an agent the store has just self-healed to stopped keeps its row, so the list does not flicker. The agents this daemon relays [6] to devices exist only in the daemon's memory, so their in-memory records are merged in first and win an id tie, being the live authority; that is what lets a reload re-open a relayed agent instead of losing it. Every local row is annotated as described next.

### What only the daemon knows about an agent

#### Context

**Problem**: the records on disk cannot say two things the user needs to read off a row. A `web` agent's record says done whether its cloud session [12] is parked on a question or finished hours ago, because the agent ends at its hands-off; only the bridge's store knows the session is waiting. And the `agent-data` branch is shared precisely so other machines' agents show up, but a row that looks exactly like one of this daemon's own sends the user to the raw record to learn whose it was.

#### Business logic

An agent whose location [13] is `web`, which has a session id, and whose cloud session the bridge reports as waiting on a human (the bridge holds the question it is parked on, or claude.ai's session list shows it awaiting input within the session window; the rule is `dashboard/bridge-store.ts`'s) is marked as cloud-waiting, so its row says so instead of "in cloud". Every other agent passes through untouched. An agent whose recorded host differs from this machine's hostname is marked as from another host; an agent with no recorded host predates the field and says nothing about where it ran. Both marks are added on the way to the dashboard and never stored.

### An agent's replay

#### Context

**User story**: the user opens an agent that has ended and sees everything it did, replayed.

#### Business logic

The replay is the agent's recorded events [15]: its run's [9] diary on the `agent-data` branch, turned back into events, else the transient archive's [10] event log; an unknown or unsafe id, or a project that is gone, answers an empty list. For a relayed agent the replay comes from the device.

### Retained checkouts

#### Context

**User story**: the dashboard offers to remove the checkout an ended agent kept, and only those.

#### Business logic

The answer is the ids of the checkouts still on disk under the project's `.branches/` directory whose agent is not running; a live agent's checkout is in use, not retained [14], and is left out. An unknown project or an unreadable listing answers an empty list.

### Where an agent is working

#### Context

**User story**: an agent's action bar says which checkout the agent has, on which branch, whether it holds uncommitted changes, how much disk the checkout takes once the agent is done, and which pull request its branch has.

**Problem**: the git status bar reads the project, so without this an agent's own branch was visible nowhere, and a retained checkout was a name in a list with no size and no way in. And an agent on a branch that successive agents reuse (a routine's [20] branch) must not wear a predecessor's merged pull request as its own.

#### Business logic

The project must be known and the id safe for a path, else the answer is nothing. The path is the checkout the agent id resolves to; whether it is the agent's own is whether it differs from the project's root, because in the root the uncommitted changes are the user's, not the agent's. The git status read there gives the branch and the dirty flag, and the pull request is filtered to the agent's lifetime: the agent's start time is derived from its id, and only an open pull request, or a closed one no older than the agent, counts. The size is read only for the agent's own checkout and only once the agent is no longer running, because a tree being written to has no size worth reporting. When the checkout is not the agent's own (the agent's checkout is gone and the read fell back to the root), the root's current branch has nothing to do with this agent, so the pull request is instead resolved from the agent's own record. The pull request may be reported as still being looked up rather than absent, so the bar asks again shortly.

### Documents and tickets

#### Context

**User story**: the project home lists the surfaced planning documents and the project's tickets; a ticket has its own page; a plan page offers to open the agent that wrote the plan, where the composer continues that agent's conversation.

#### Business logic

The surfaced documents are read at the project root in sidebar order (`dashboard/docs.ts`). The tickets are read off the `agent-data` branch [11] (`dashboard/tickets.ts`), an empty list when the project has none yet; one ticket's full text is nothing when the ticket does not exist. The agent that wrote a ticket's plan is the newest of the project's agents whose ask names that plan (the rule is `tickets.ts`'s), reported as its id and status, or nothing when no agent was asked for it. When the tickets last caught up with GitHub is whatever was recorded, or nothing.

### Cross-project rollups

#### Context

**User story**: the Overview [2] shows what is running now across every project, the size of the agent queue [16], recent agents, hot tickets, the pull requests that need review, every agent's open question [18] with its full gate [19], and the "New activity" feed.

#### Business logic

Each rollup is built over every project the registry lists (the builders are `dashboard/overview.ts`, `dashboard/queue.ts`, `dashboard/interventions.ts`, `dashboard/open-questions.ts`, `dashboard/activity.ts` and `dashboard/dashboard.ts`), and a registry that cannot be read means no projects. Recent agents carry the same annotations as the agent history. The interventions [17] and the activity feed report, beside their items, which projects were read whole: a project whose sources could not be read contributes no items, exactly like a project with nothing waiting, and the browser's notifier needs the difference, because a queue that came back empty only because GitHub was unreachable is not a baseline to announce the whole backlog against later.

### The files of a checkout and their status

#### Context

**User story**: the context picker and the file tree list the checkout's files, and the tree dots each file with its git status.

#### Business logic

The files are every file git sees in the checkout, tracked and untracked, honoring the ignore rules, repository-relative and sorted; the statuses map each changed file to untracked, modified or deleted. With an agent id both read the agent's own checkout rather than the project's root. No checkout (an unknown project, a relayed agent's unreachable device) answers an empty list and an empty map.

### One file's diff, one file's content, and what the agent changed

#### Context

**User story**: hovering a changed file in the tree shows its diff; hovering an unchanged one shows its content; the agent view lists every file the agent changed with line counts, refreshed each poll.

**Problem**: what the agent changed is derived from its checkout's git state rather than from the agent's tool calls: the driver reports a tool's name but not its arguments, so git is both the honest source and the one that works for every agent.

#### Business logic

The diff is read from the agent's checkout when an agent id names one, else the project's. The file's status comes from the checkout's own git status, never from the caller, so a browser that claims a file is untracked cannot make the daemon read it as one; a path that is not a changed file, or is unsafe, answers nothing (the path rule is `dashboard/file-read.ts`'s: repository-relative, no parent segments, never inside `.git`). The content of an unchanged file answers nothing when the path is unsafe, resolves outside the checkout, or cannot be read. What the agent changed is every changed file in its checkout with its line counts, an empty list when nothing changed or there is no checkout.

### The project's GitHub URL and git status

#### Context

**User story**: the git status bar shows the branch, whether there are uncommitted changes, and the linked pull request; the project links to its GitHub page.

#### Business logic

The GitHub URL is derived from the `origin` remote, nothing when there is no remote, it is not GitHub, or the project is unknown. The git status is the project's, or one agent's checkout's when an agent id is given: that agent's branch and dirty state are the ones that actually belong to it. A read for an agent is filtered to the agent's lifetime, derived from its id, so an agent on a reused branch does not show a predecessor's merged pull request as its own. Not a repository, or no checkout, answers nothing.

### What an agent's handoff left behind

#### Context

**User story**: an agent has ended; its page shows the branch it left its work on, what it committed, what it changed, whether that was pushed or opened as a pull request, and what it left uncommitted.

**Problem**: a clean agent's checkout is removed when it ends, and an agent-addressed read then falls back to the project's root, which would report the project's own branch and the user's own uncommitted changes as though they were the agent's. The branch is what outlives the agent, so the branch is what is asked about.

#### Business logic

The project must be known, the id safe, and the agent found in the project's records, else nothing. The handoff [4] is read from the project's checkout against the agent's own branch (the branch it recorded, else `agent-<id>`), limited to what happened since the agent started (`dashboard/agent-handoff.ts`). Uncommitted work is the one thing the branch cannot answer, and it is counted only when the agent's checkout is a checkout of its own, never from the project's root.

### The project's own instructions

#### Context

**User story**: the prompt preview claims to show the entire system prompt an agent starts with, which is the built-in system prompt [21] plus the project's `SYSTEM.md`.

#### Business logic

The answer is the trimmed text of `SYSTEM.md` at the project's root, or nothing when the project has none, the file is empty, or the project is unknown.

### The bridge's state

#### Context

**User story**: a `web` agent's page shows the question its cloud session [12] is parked on, where the pick [22] the user made stands (queued, delivered, or failed with the extension's reason), and what the session has said so far; Settings shows whether the extension has ever reached the daemon and how it went, offers the bridge token to paste into the extension, and shows the bridge browser's state.

**Problem**: the bridge sees a claude.ai page, which knows its own session and nothing about agents, so these reads are keyed by the cloud session's id; the agent view derives that id from the agent's own record, and the join happens in the browser. An extension that is misconfigured looks exactly like one that is not installed, since both leave no question behind, so the last contact is reported even when it was refused: a refused request at least proves something is trying.

#### Business logic

A session id that does not look like a cloud session id (`session_` followed by up to 128 letters or digits) answers nothing, or an empty transcript. The parked question is whatever the bridge last reported for that session, nothing when there is none; the answer is the one the user picked in whatever state it is, nothing when none was picked; the transcript is what the bridge scraped, in order. The bridge's status is the last contact (when, which route, and the status it got), how many questions are parked, what the page script last said about itself, and the extension's last version claim with whether it was turned away. The bridge token is handed out only while the bridge preference [23] is on, so a daemon with the feature off never hands the secret to a page; it is nothing otherwise, and nothing when no token exists. The bridge browser's state is off, starting (with the step it is on), running (since when, visible or not, and whether the claude.ai tab sits on the sign-in page), or stopped and why.

### Reads about a relayed agent go to the device

#### Context

**Problem**: an agent relayed [6] to a device [7] has no checkout here. Everything about its checkout, its branch and its events lives on the device.

#### Business logic

The replay, where the agent is working, the checkout's files and their statuses, one file's diff or content, what the agent changed, the git status and the handoff are forwarded to the device when the agent id names an agent this daemon relays, and the device's answer is returned (the forwarding is `relay-agent.ts`'s). A device that cannot be reached, or refuses, answers the read's own empty shape, so the dashboard never has to special-case a relayed agent. Reads about a project rather than an agent, and the bridge reads, are never forwarded.
