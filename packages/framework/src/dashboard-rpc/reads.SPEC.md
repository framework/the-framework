Everything the dashboard reads: a project's agents and what each one is working on, its docs, tickets and agent queue, the cross-project rollups on the Overview, the file tree with per-file changes and diffs, an agent's end-of-agent handoff, and what the Claude web bridge has seen.

## User story

The dashboard is a projection of what the daemon and its agents write to disk. Everything the user sees — the agent list, the file tree with its change dots, the diff on hover, the branch and pull request badges, the Overview's pooled feeds, a cloud session's parked question — is one of these reads, polled while the page is open.

## Business logic — TL;DR

- **A read never fails at the user** - an unknown project, a repo that is not a git repo, or a read that goes wrong all answer with an empty result, so a panel renders as empty instead of erroring.
- **An agent-scoped read is answered by whoever owns the agent** - a locally running agent is read off its own worktree; an agent running on a device is read over the relay from that device.
- **The agent list merges three sources into one row per agent** - the archived agents, every live agent, and the agents this daemon is relaying from a device; where the same agent appears twice, the live copy wins.
- **A record is annotated with what only the daemon knows** - on the way to the dashboard, an agent's record is marked as waiting when the browser bridge reports its session waiting on a human — it holds the session's question, or claude.ai's session list shows the session awaiting input — and as from another host when a different machine's daemon started it; the record on disk carries neither.
- **What the agent changed is read from git, not from the agent** - the changed files, their statuses and their diffs come from the agent's own checkout.
- **A file read cannot be talked into reading something else** - the server decides from its own git status whether a path is a changed file, and refuses paths that escape the checkout.
- **A finished agent is described by its branch, not by a checkout it no longer has** - the handoff reads the agent's branch from the project, so it never reports the user's own branch and uncommitted files as the agent's.
- **A pull request badge belongs to the agent that earned it** - pull requests are only counted from the moment the agent started, so an agent on a reused branch never wears a predecessor's.
- **Cross-project rollups say which projects they could read whole** - so a feed that came back short because a remote was unreachable is not mistaken for a feed with nothing in it.
- **The bridge is read by cloud session** - the parked question, the state of the answer, what the session has said, whether the extension is reaching the daemon at all, and where the daemon's own bridge browser stands.

## Business logic

### A read never fails at the user

#### User story

The user opens a project that has no `tickets/` directory yet, or one that is not a git repo, or one whose path has moved.

#### Business logic

Every read resolves the project first; an unknown project answers with that read's empty result — no agents, no tickets, no files, no git status. A read that goes wrong answers the same way. Nothing here reports an error to the browser.

### An agent-scoped read is answered by whoever owns the agent

#### User story

The user opens an agent that is running on another device and browses its files, its diffs and its git status exactly as for a local agent.

#### Business logic

Every read that names an agent first asks whether that agent is one this daemon is relaying from a device; if so, the same read is performed on that device and its answer returned. When the device cannot be reached, the read answers with its empty result, like any other unavailable read. A read that names only a project is always local.

### The agent list merges three sources into one row per agent

#### User story

The user starts an agent and sees it appear in the sidebar as running straight away; reloads the page and still finds the agent that is running on a device; and sees an agent that was continued after finishing shown as running, not as its earlier, finished leg.

#### Business logic

The list is the project's archived agents, plus every agent currently live in its own worktree, plus the agents this daemon is relaying from devices — which exist only in the daemon's memory and would otherwise be lost on a reload. There is exactly one row per agent id: a relayed copy beats a local one, and a live copy beats an archived one, because the live copy is the current truth. Nothing is filtered out by status, so an agent whose record was just corrected does not flicker out of the list for a poll. A `web`-target agent whose cloud session the browser bridge reports as waiting on a human — parked on a question it holds, or shown awaiting input by claude.ai's session list — is marked as waiting on the way out — the record on disk cannot know, only the daemon does — so its row says "waiting" rather than "in cloud". Likewise an agent whose recorded host is not this machine is marked as from another host: the data branch is shared precisely so that other machines' agents appear here, and a row that looked exactly like one of this daemon's own left the user reading the archive by hand to learn whose it was. A record with no host at all is left alone. The same marks are applied to the Overview's pooled recent agents.

### Where an agent is working

#### User story

The user wants to know where an agent is doing its work: which checkout, which branch, whether it is holding uncommitted changes, what its checkout costs on disk, and whether it has a pull request.

#### Business logic

An agent is reported with the checkout it has, its branch, whether that checkout is dirty, and its pull request — plus a note that a pull request lookup is still pending, so the interface can ask again shortly rather than showing "none". The report distinguishes an agent with its own worktree from one that fell back to the project's main checkout, because in the latter case "uncommitted changes" are the user's, not the agent's. The size on disk is only measured for a checkout nothing is writing to: a running agent's tree changes under the measurement, and measuring a build directory mid-build costs a lot for an answer that is worthless.

Separately, the agent ids that still have a worktree on disk are listed, so the dashboard knows which finished agents have a checkout to offer removing; a live agent is never offered, because its worktree is in use.

### What the agent changed is read from git, not from the agent

#### User story

The user watches an agent work and wants to see, live, which files it has touched, and what each change looks like.

#### Business logic

The file tree lists every file git sees in the agent's checkout — tracked and untracked, ignored files excluded — and each file carries its status: untracked, modified or deleted. A changed file's diff and the agent's whole set of changes with their line counts are read from the same checkout, refreshed on each poll. A file that has not changed can be read as plain content instead.

#### Rationale

The changes are derived from the checkout rather than from the agent's own tool calls, because the driver reports which tool an agent used but not what it passed to it: the framework verifies by outcome, never by watching individual tool calls. Reading git is both the honest source and the one that works for every driver.

### A file read cannot be talked into reading something else

#### User story

The dashboard may be reachable from beyond this machine, and its file reads name paths.

#### Business logic

Whether a path is a changed file — and which kind of change — is decided by the server's own git status, never by what the caller claims; a path git does not report as changed has no diff. Paths that are unsafe or fall outside the checkout are refused. Both apply equally whether the read is served here or forwarded to a device.

### A finished agent is described by its branch, not by a checkout it no longer has

#### User story

An agent finished cleanly and its worktree was removed. Its panel must still say what it committed, what it changed, and whether that reached the remote or a pull request.

#### Business logic

The handoff is read from the project's own checkout against the agent's branch, because the branch is what outlives the agent. Uncommitted work is the one thing the branch cannot answer, so it is read from the agent's own checkout — and only when that checkout is genuinely the agent's own, since the project's checkout holds the user's uncommitted files, not the agent's.

### A pull request badge belongs to the agent that earned it

#### User story

An agent works on a branch that a previous agent already used and whose pull request was merged long ago.

#### Business logic

Every agent-scoped read that reports a pull request only considers pull requests from the moment that agent started. An agent on a reused branch therefore shows no pull request until it opens its own.

### Cross-project rollups say which projects they could read whole

#### User story

The Overview pools everything across projects: what is running, the agent queue, recent agents, hot tickets, all open questions, the interventions list and the activity feed. The browser also notifies about new items, and must not announce the whole backlog at once.

#### Business logic

Each rollup walks every registered project; a registry that cannot be read yields an empty rollup rather than an error. The interventions list and the activity feed additionally report which projects were read completely. That is what lets the browser's notifier tell "nothing is waiting" from "this project could not be read": taking an empty-because-unreachable result as its baseline would announce the entire backlog the moment the remote answered again.

### The bridge is read by cloud session

#### User story

A `web`-target agent hands its task to a cloud session, which parks on a question. The Claude web bridge carries that question into the dashboard, the user answers, and the extension types it back.

#### Business logic

The parked question, the state of the answer picked for it — queued, delivered, or failed with the extension's own reason — and what the session has said so far are all keyed by cloud session id, because that is what the extension can see from a claude.ai page; the agent's view derives that id from the agent's own event, so the two are joined in the browser. Anything that is not a well-formed cloud session id answers with nothing, so an agent with no bridge, no question, or a target other than `web` renders exactly as it otherwise would.

A separate status read says whether anything has reached the bridge at all, when it last did, which page it reported, its version, and how many questions are held — because a misconfigured extension and an uninstalled one both leave no questions behind, and only that status distinguishes them.

The bridge token is readable for the setup step where the user pastes it into the extension, and only while the bridge is switched on, so a daemon with the feature off never hands it out.

The bridge browser's status is readable as the daemon reports it: off, starting and on which step, running — whether its window is shown, and whether its claude.ai tab is on the sign-in page — or stopped and why.

#### Rationale

Revealing the token to the dashboard is not a new exposure: anyone who can load this dashboard can already start agents on this machine, and on a non-loopback bind their browser already holds that same token. What it replaces is telling people to open the registry file and copy a field out of it.

### Reading the project's own texts

#### User story

The prompt preview claims to show the entire system prompt, including the user's own addition; the ticket pages show a ticket's full text; the sidebar shows the project's surfaced documents.

#### Business logic

The project's own `SYSTEM.md`, its surfaced documents in sidebar order, its tickets by filename, one ticket's full text, when its tickets last caught up with GitHub, and its GitHub URL as derived from its `origin` remote, are each served as plain reads — answering with nothing when the project has no such file or no GitHub remote.

A ticket's plan page can also ask who wrote the plan: the answer is the agent the project's records name as its author (the newest whose ask was that plan), with its id and whether it is still running, so the page can open that agent's session; nothing when no recorded agent was asked for the plan.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
