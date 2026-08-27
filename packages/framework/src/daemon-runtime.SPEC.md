Starting, supervising and retiring agents on behalf of the daemon: every agent the dashboard starts is born here — given its own worktree and branch, spawned as its own process, watched for a death it never reported itself, and torn down once it is over. Also adds projects to the registry and forwards an agent to another device.

## Glossary

- **agent slot** - the daemon's record that it is still responsible for one agent: the agent is mid-start, its process is alive, or its teardown has not finished. A project with no slots is idle.
- **leg** - one stretch of an agent's work done by one process. An agent that is continued (resumed, or retried after a transient death) has several legs, all under the same agent id, on the same branch, appending to the same event log — the dashboard shows it as one agent throughout.

## Business logic — TL;DR

- **Starting an agent** - the dashboard's Start resolves the project, gives the agent a checkout, and spawns it as its own detached process that narrates itself through its event log.
- **Every agent gets its own checkout** - a fresh worktree on its own agent branch, so concurrent agents on one project never share a working tree and the user's own checkout is never touched.
- **A project that cannot be given a worktree** - a non-git project falls back to the main checkout and to one agent at a time; a git project whose worktree could not be created fails the start rather than borrowing the user's checkout.
- **Continuing an agent** - a continuation reuses the agent's id, branch, checkout and event log, and inherits the project's agent options so an armed handoff survives the resume.
- **Refusing a start the driver cannot serve** - before a branch and a worktree are spent, the driver is checked to be installed and logged in; a passing check is trusted briefly, a failing one is re-checked every time.
- **One agent per checkout** - a second agent aimed at a checkout that is already busy is refused as busy; different checkouts never wait on each other.
- **An agent that never booted is reported as failed** - when the spawned process dies before writing its own status, the daemon writes the `failed` status for it and puts the process's error output into the agent's event log — unless the checkout is gone, where only the terminal records it.
- **One more try after a transient driver death** - an agent killed by a dropped connection or an overloaded API is continued automatically, at most twice; any other failure stands.
- **Retiring a finished agent** - its history is archived onto the data branch, then its checkout is removed once its work has reached the remote, and kept otherwise; any branch that went with it is named.
- **Running an agent on another device** - a start aimed at a device is handed to that daemon over the relay, its events are streamed back, and read/steer requests for it are forwarded there.
- **Adding projects** - the repo at a given path is activated and registered in one go.
- **Shutdown stops every agent it spawned** - Ctrl-C terminates each agent's process — an agent that will not go is killed together with its whole process group, its browser included — and waits for its teardown to finish before the daemon lets go of the repo; starts landing during shutdown are refused.

## Business logic

### Starting an agent

#### User story

The user clicks Start in the dashboard — on the project they are looking at, or on the daemon's home workspace — and immediately sees the new agent's page filling with events.

#### Business logic

A start names a project, a prompt and a kind of task. The project id resolves to the repo path through the registry; no id (or the home id) means the daemon's own workspace, resolved without a lookup. An unknown project id is refused by name.

The agent is spawned as a detached process of its own, handed a written-out task description, so it outlives the request that asked for it. It narrates itself: everything the dashboard shows comes from the agent's own event log, and everything the user sends back (Stop, picks, chat) goes through its control channel — the daemon only tracks whether the process is alive. The start hands back the agent id so the dashboard can open exactly that agent rather than guess which one appeared.

Whatever the framework's own CLI entry is, the agent is spawned from it. The daemon refuses to spawn from a test entry, because that would re-run the test suite instead of an agent — and that suite starts agents, so each spawn would spawn another.

The spawned agent's error output is written to a file inside its checkout instead of being discarded, so an agent that dies at boot leaves a trace to read.

The spawned agent's environment is the daemon's own, with the `branch-management` command first on its PATH — the agent names its session and checks its tree through the same package the daemon allocated its checkout with — plus the daemon's address, when the daemon has one: a web run uses it to ask this daemon for a cloud session created by the browser extension. A run nobody's daemon spawned has no such address, and a web run among them stops saying web runs start from the dashboard.

### Every agent gets its own checkout

#### User story

The user runs several agents on the same project at once, and keeps working in that repo themselves while they run.

#### Business logic

Each agent is given its own git worktree under the project's `.the-framework/branches/`, on its own `tf-agent-<agent id>` branch. Concurrent agents on one project therefore never fight over a working tree, and the user's own checkout — uncommitted work included — is left untouched.

A fresh worktree has no installed dependencies, since those are not tracked by git, so the project's are mirrored in (the branch-management package's dependency linking).

#### Rationale

The branches view is told about the new checkout immediately rather than at the next sweep, so a just-started agent's branch appears without waiting.

### A project that cannot be given a worktree

#### User story

The user registers a folder that is not a git repository, or a very large repo where creating a worktree takes longer than the framework allows.

#### Business logic

A project that structurally cannot have a worktree — it is not a git repository — falls back to running in the main checkout, and is limited to one agent at a time, because such agents would collide.

A project that *is* a git repository but whose worktree could not be created does not fall back: the start fails and the dashboard shows why. Falling back there would silently point the agent at the user's own working tree, which is the one thing per-agent checkouts exist to prevent; a failed start is recoverable by starting again, a checkout with agent edits mixed into it is not. If the worktree creation was killed for taking too long, the half-written directory it left behind is deleted, since git leaves it in place — but a failure of any other kind leaves the directory alone, because it may have been there before this agent asked for it.

### Continuing an agent

#### User story

The user reads a finished agent's work, and asks it to carry on rather than starting a new agent from scratch.

#### Business logic

A continuation reuses the agent's id, its checkout, its branch and its event log, so the dashboard keeps showing one agent rather than a second row. If the checkout was retained it is used as is; otherwise the agent's own branch — the one recorded on its archive, since the agent renamed it itself — is checked out fresh, and its archived history is restored into the checkout so the agent reopens its log instead of starting empty. When none of that is possible, the start falls back to a new agent.

The continuation inherits the project's resolved agent options, with anything the caller sent explicitly on top. A continuation start carries only its seed, so without this an agent whose first leg was armed to merge would resume with the merge silently disarmed and end in a draft pull request.

A continuation started the instant an agent flips to done waits out the previous leg: the process that wrote that ending may still be exiting, and its teardown queued behind it. The wait is bounded, and ends as soon as the slot clears. A previous leg that positively reports itself as still running is a genuine collision and is not waited on. A leg whose status cannot be read this instant counts as neither finished nor running and is simply asked again on the next tick.

#### Rationale

Continuation and teardown both mutate the same checkout, so a continuation takes the same per-checkout lock as teardown: reusing a checkout mid-retirement would spawn the new leg into a directory about to be removed. Waiting the teardown out costs the click a beat and makes the reuse read a settled archive.

### Refusing a start the driver cannot serve

#### User story

The user's driver CLI is not installed, or its login has expired. Every agent they start dies instantly, leaving a branch and a worktree behind and a page stuck on "Waiting for the session to start".

#### Business logic

Before an agent is given a branch and a worktree, the daemon checks that the chosen driver can actually run; when it cannot, the start is refused and the reasons are shown as the error. Only the two run targets that spend the local CLI are checked — `local`, and `web` because the local CLI is what hands the task to the cloud session. An `actions` agent runs on a GitHub Actions runner, so a machine with no driver installed starts it perfectly well. An agent aimed at a device is handed off before this point and is the other daemon's problem.

Only a passing check is remembered, and only for half a minute: back-to-back starts must not each pay for the probes, but a user who has just logged in must be let through by their very next start rather than after a timeout, so a failing check is re-run every time.

### One agent per checkout

#### User story

The user double-clicks Start, or asks for a second agent on a project whose fallback checkout is already busy.

#### Business logic

A start is refused as busy when the checkout it would use already has an agent starting, or an agent whose process is still alive. An agent with its own worktree is judged per checkout, so it never collides with a sibling on the same project; the fallback agent of a project that gets no worktree is judged per project, which restores the one-at-a-time rule exactly where agents would otherwise collide.

The checkout is claimed the moment the start begins, not when the process appears, so two starts arriving together cannot both pass the check.

### An agent that never booted is reported as failed

#### User story

An agent's process dies before it manages to say anything — it could not be spawned at all, or it crashed on startup. Without this, the agent's page waits forever for a session that will never start.

#### Business logic

When a spawned process ends, the daemon checks whether the agent ever wrote its own status record. If it did, the agent's lifecycle is its own to report and the daemon leaves it alone. If it did not, the daemon writes a minimal `failed` status for it and appends a log entry to the agent's event log saying how the process ended, with the tail of the process's error output attached, and prints the same to the terminal.

The status is written only into a checkout that still exists. When the checkout is gone — removed by hand while the process was alive, or never created at all — the daemon says so in the terminal instead and writes nothing, because a record written where a checkout used to be creates a directory under `.the-framework/branches/` that git does not know as a checkout, and every later git command run in it would act on the user's own repository.

The task description written for the agent is deleted when the process ends without consuming it, so an abandoned prompt (and any device token in it) does not stay on disk.

### One more try after a transient driver death

#### User story

The user's agent is killed mid-work by a dropped connection or an overloaded API, hours into a task nobody is watching.

#### Business logic

Once a failed agent has been archived, the daemon reads why it failed and continues it automatically when the reason names a transport failure — connection closed, connection reset, timed out, socket hung up, overloaded, rate limited, or a server-side error from the API. The continuation is unattended and tells the agent that it died to a transient connection error rather than because anyone asked it to stop, and to look at what it had already done and finish from there. It resumes the same driver session when one was recorded.

The retry is deliberately narrow. Only a failure the agent reported itself counts — an agent that never booted is never retried, because retrying it would just re-crash. Only an agent whose status is `failed` counts, so a stopped agent stays stopped. Only a `local` agent counts, because a `web` or `actions` agent's lifecycle lives elsewhere and is not this daemon's to replay. Any reason not named above stands as a real failure, because retrying real failures just re-runs them.

Each agent gets at most two such continuations, after a pause long enough for a dropped connection to be worth re-trying. A pending retry never holds the daemon open: a daemon that exits first simply does not retry.

#### Rationale

The attempt count is kept in memory only. A daemon restart already resumes interrupted agents on its own, and a forgotten count can only ever grant one extra attempt.

### Retiring a finished agent

#### User story

An agent finishes. Its work must survive, its history must stay visible in the dashboard, and its throwaway checkout must not pile up on disk.

#### Business logic

When an agent's process exits, its history — which lives inside its own checkout — is copied out into the project first, as an archive filed under the identity the repo commits as, on the data branch, through the data branch's single write cycle so it is committed and pushed the moment it lands. The branch the work ended on is recorded with it, because the branch outlives the checkout and is the only handle the dashboard has left on a finished agent. That branch is read only from a directory git knows as a checkout in its own right: a leftover directory would answer with the *enclosing* repository's branch, and the archive would record the user's own branch as the agent's.

Then the checkout goes, under one rule: it is removed once its work is on the remote, whatever state the agent ended in — pending changes are committed and the branch is pushed, unless everything the checkout holds is already there, and only then does the checkout come off disk. A push that cannot land keeps the checkout, and a later sweep retries it. Teardown, the sweep and the dashboard's Remove button are the same behaviour by construction. When branches went with the checkout — one that provably held nothing the remote lacks, or the `tf-agent-<agent id>` branch the agent had branched away from — the teardown names them, because a branch disappearing unannounced reads as a bug.

Retirement is best-effort from end to end: it runs off a process-exit event with nobody to report to, so a failure must not take the daemon down, and a checkout that could not be retired is left on disk, which is the safe direction.

#### Rationale

Teardown takes the per-checkout lock, because a Push, Remove or Resume fired off a just-finished agent commits in the same checkout; serialized, whoever runs first commits the whole pending state and the other side finds a clean tree and carries on.

Failed and stopped agents used to keep their checkout "for inspection", which meant those accumulated one per agent until someone noticed. Their work is on the remote branch either way.

### Running an agent on another device

#### User story

The user starts an agent on a device saved in the dashboard — another machine's daemon — and watches it in the same dashboard as their local agents.

#### Business logic

A start aimed at a device is forwarded to that daemon and its events are streamed back, without allocating a worktree here or consulting this daemon's busy rule: the device owns both. The device is told to start an ordinary local agent, so it does not relay onward.

A relayed agent has no local checkout and no local process, so this daemon keeps a memory-only record of it — running, with its prompt as intent, marked as running remotely and labelled with the device's name — which is what lets it appear in the agent list and be reopened after a dashboard reload. It is never written to disk. The record outlives the event stream, so a finished remote agent's push or pull request still reaches the right device.

On the other side, this daemon serves the device role too: it runs one whitelisted read, steer or handoff request from a daemon that relayed an agent here, always against its own home workspace, and it tails a relayed agent's event log so those events can be streamed back to the daemon that started it. That tail follows the log when teardown moves it into the archive, so the agent's final events are not lost — but once the agent's own log is gone it refuses to fall back to the workspace's root log, which belongs to a different agent.

### Adding projects

#### User story

The user points the dashboard at a repository and expects it to show up in the Projects list.

#### Business logic

The path is resolved against the daemon's working directory and checked to be an existing directory first, so a bad path is reported as a path error rather than as a confusing git failure. The repo is activated and then registered. Activation is idempotent — an already-activated repo counts as such and succeeds, and the result says which of the two happened. A git failure is shown as the error.

### What the daemon still holds

#### User story

Background jobs need to know whether a project is idle, and whether a given agent is finished with — including agents whose own status already says done.

#### Business logic

The daemon reports the slots it holds on a project: one per agent whose process is alive, and one per agent mid-start. A live slot is re-checked against the operating system rather than trusted, so an agent whose exit was never noticed cannot keep a project looking busy forever. Slots are reported individually, naming the agent each one belongs to, rather than as a count — a count that comes out one too high cannot be questioned, and this view is the daemon's process table, where a process outliving its own finished agent shows up and nowhere else.

Separately, the daemon reports the agent ids it is still responsible for: starting, running, or mid-retirement. An agent's status flips to done a beat before its teardown archives it and reclaims its checkout, so "not live on disk" is not the same as "the daemon is finished with it" — and the worktree sweep asks this so it never races a teardown for the same directory.

### Shutdown stops every agent it spawned

#### User story

The user presses Ctrl-C. Nothing the daemon started may outlive it.

#### Business logic

Every agent this daemon spawned is sent a terminate signal, which the agent already handles by aborting cleanly and killing its own driver and closing its own browser. An agent that will not go within the grace period is killed outright, and the kill goes to its whole process group, not just the agent: the browser the agent launched sits in that group, and a kill to the agent alone runs none of the agent's own cleanup, leaving that browser running with nothing left that knows about it. Only agents this daemon spawned are stopped; an agent it merely steers is not its to stop. The ids of the agents it stopped are reported, so the shutdown line can name a process that outlived its finished agent.

Shutdown then waits — bounded by the same grace period — until the daemon has actually let go of the repo: not merely until the processes are dead, but until each stopped agent's teardown has finished. The archive commit that runs right behind shutdown depends on this; without the wait it fires while an agent is still being archived and misses that agent's ending.

Once shutdown has begun, no further agent is started: a start arriving in that window is refused, and one already in flight is refused just before its process would be spawned. Such a refusal takes back everything it had allocated — the written task description, and the fresh worktree and branch, but never a continuation's checkout, which belongs to the agent and not to this refusal.

#### Rationale

Agents are spawned detached so they survive the CLI invocation that asked for them — not so they survive the daemon that owns them. Left alone at shutdown they become orphans holding a worktree and a browser, with no daemon left that knows about them. And because the HTTP surface closes after the agents do, a start landing in that gap would spawn exactly such an orphan.

What shutdown stops is not lost, only not restarted automatically: the agent keeps its branch, and its checkout too until the work reaches the remote, so the next start continues the same conversation in the same checkout — when the user asks for it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
