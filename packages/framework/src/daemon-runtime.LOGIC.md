What the daemon does for a project: starting an agent [1] (the project it is for, the preflight [2], its own checkout [3] and branch, the agent spec [4], the spawned process and its environment), keeping the map of live agents that refuses a second agent in the same checkout, continuing an agent from its own checkout, tearing a finished agent down (its run [5] recorded, its checkout reclaimed [6]), retrying an agent the model's transport dropped, relaying [7] an agent to a device [8] and serving the device side of a relay, activating and registering a project, and stopping every agent it spawned when the daemon shuts down.

## Context

**User story**: the user presses Start on a project's launcher and an agent appears in the agent list within moments, working in its own checkout on its own branch while the user's own checkout is untouched; two Starts on the same project run side by side. When the agent ends, its work is pushed and its checkout disappears; a Start that cannot work says why instead of spending a branch on it. Resume continues an agent in the checkout and on the branch it left. Choosing a device runs the agent on another machine, and it renders like a local one. Adding a project activates a repository and lists it.

**Business logic story**: the daemon owns no agent's state. The spawned process narrates itself into the event stream [9] in its checkout, which the dashboard tails; steering reaches it through the control file [10]. What lives here is the boundary around that process: what must be true before it starts, what it is handed, and what happens when it ends. The checkout itself is created and removed by the `branches` skill [11] and by `worktrees.ts`; the agent's process is `cli.ts`; the record of a finished agent is the `logs` skill's run.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] preflight: The check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[3] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[4] agent spec: The one JSON file the daemon hands a spawned agent process with its whole configuration.
[5] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[6] reclaim: Removing a finished agent's checkout once its work is on the remote.
[7] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[8] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[9] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[10] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[11] skill: One of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[12] driver: A coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`.
[13] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[14] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[15] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[16] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[17] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[18] coding agent: The CLI doing the actual work: Claude Code or Codex.
[19] location: Where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[20] driver session: The coding agent's own conversation for one agent, which the driver can resume by its session id.
[21] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[22] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[23] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[24] claim: A ticket's lock file naming the holder working it, so two agents never work the same ticket.
[25] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[26] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **Which project a start is for, and what refuses it outright** - a start names a registered project or defaults to the daemon's home project; an unknown project, a daemon that is shutting down, and an entry script that is a test file each refuse the start with a reason.
- **Running an agent on a device** - a start that names a device [8] is forwarded to that device's daemon and kept here only as an in-memory row, without a checkout [3] or a busy slot on this machine.
- **The device side of a relay** - a daemon that relayed an agent here may read, steer and hand off that agent against this daemon's home project only, through a fixed list of actions that never includes starting, previewing or deleting.
- **Preflight before a checkout is spent** - an agent whose turns run on this machine starts only if its driver's [12] coding agent is installed and logged in; a pass is trusted for 30 seconds, a failure never.
- **A continuation reopens the agent's own checkout** - Resume starts from the project's own options, waits out the previous leg's exit, reuses or re-attaches the agent's checkout on its recorded branch, and restores its history so it stays one agent.
- **Every agent gets its own checkout and branch** - a checkout under `.branches/` on branch `agent-<agent id>` with the four skills [11] linked in; a directory that is not a repository gets no checkout and runs in the project's checkout one agent at a time; a repository whose checkout cannot be created refuses the start rather than borrowing the user's checkout.
- **One agent per checkout** - a second start aimed at a checkout whose agent is alive or mid-spawn is refused as busy.
- **The agent spec, the spawned process and its environment** - the process is handed one spec [4] with its prompt verbatim, runs detached with its stderr in its checkout, sees the skills' commands on its PATH, its id as `AGENT_ID` and the daemon's address, and is refused and undone if the daemon began closing meanwhile.
- **When the process ends** - the spec is removed, the slot freed, and for an agent with its own checkout a chain runs: a failed-start marker if it never reported anything, the teardown, then the transient-death retry.
- **Teardown: record the run, then reclaim the checkout** - the agent's branch is read while the checkout exists, its run [5] written to the `agent-data` branch [13], and the checkout removed only once its work is on the remote, whatever state the agent ended in.
- **One more try after a transient death** - a local agent that failed by its own report on a transport error is continued unattended [14] after 15 seconds, at most twice.
- **Adding a project** - an existing directory is activated and registered; an already activated one is a success that says so.
- **What the sweeps read: slots and busy ids** - a project's slots are its live and mid-spawn agents, re-checked against the operating system, and the busy ids also include agents mid-teardown.
- **Stopping every agent at shutdown** - each agent this daemon spawned gets a graceful stop then a forced one, the daemon waits until it has let go of the repository, and reports which agents it stopped.

## Business logic

### Which project a start is for, and what refuses it outright

#### Context

**Business logic story**: every start reaches the daemon the same way, from the launcher, from the composer's Resume, from a sweep [15] or from another machine's relay [7]. This is the one place a daemon-started agent [1] is born, so the checks that need no checkout [3] come first.

#### Business logic

A start names a project by id or names none. No id, or the home project's id, means the directory the daemon was started in, with no registry lookup; any other id is looked up among the registered projects, and one that is not found refuses the start with "unknown project: <id>". A start that lands while the daemon is shutting down is refused with "the daemon is shutting down", never spawned into the gap between the stop pass and the HTTP server closing, because such an agent would be an orphan nothing ever stops. The script re-invoked for the agent's process is the compiled CLI, or the entry the caller gave; when it cannot be located the start fails with "cannot locate the framework CLI entry", and an entry that is a test file is refused with "refusing to spawn a framework process from a test entry; pass an explicit binPath", because re-running a test suite that itself starts agents would fork without end.

### Running an agent on a device

#### Context

**User story**: the user saved another machine's daemon as a device [8] and picks it on the launcher; the agent [1] runs there and renders in this dashboard like a local one.

#### Business logic

A start that names a device is forwarded to that device's daemon with the device stripped from its options, so the device starts an ordinary local agent and does not relay [7] it on; the forwarding, the streaming of its events back and the forwarding of its steering are the rules in `dashboard/remote-run.ts`. No checkout [3] is created here and no busy slot is taken: the device owns both. A device's refusal or an unreachable device comes back in the same shape as a local refusal, so the dashboard shows it the same way. On success the agent is kept here only as an in-memory row, marked running with the prompt as its intent and the device's label, so the agent list can show it and a reload of the dashboard reopens it; it is never written to disk. The row outlives the agent's event stream [9], so a finished relayed agent's push and pull request still reach its device.

### The device side of a relay

#### Context

**Problem**: a relay [7] lets another daemon run code on this machine. What it may do here has to be a closed list.

#### Business logic

A daemon that relayed an agent [1] here may run, against this daemon's home project only, the actions of a fixed list: reading the agent's files, diffs, changes, git status, checkout [3] and handoff [16] state, and steering it with a stop, a pick, a message, a handoff level, a push, a pull request or a merge. Whatever project the caller names is replaced by the home project, so a relayed call can never address another registered project. Starting an agent, previewing and deleting are never on the list; an unknown action is refused. The list itself is in `dashboard-rpc/relay-dispatch.ts`.

The events of an agent started here by a relay are streamed back to the relaying daemon from the agent's own event stream [9], following the file when the teardown moves it into the archive [17]; after such a move the stream never falls back to the project's root event file, which would be another agent's feed.

### Preflight before a checkout is spent

#### Context

**Problem**: a coding agent [18] that is installed but logged out, or missing, would let the daemon spend a branch and a checkout [3] on every start while each agent dies before writing anything, and the dashboard waits for an agent that never comes.

#### Business logic

Before any checkout is created, the preflight [2] (the checks are in `preflight.ts`) is run for the driver [12] the start picked, `claude` when the pick is not a known driver. It is run for an agent whose location [19] is `local` and for one whose location is `web`, because a `web` agent is started by the local coding agent and needs its binary and login the same way; an `actions` agent runs on a GitHub Actions runner and is not gated. A passing preflight is trusted for 30 seconds per driver, so a burst of starts pays for the probe once and back-to-back starts do not race each other; a failing one is never remembered, so logging in is picked up by the very next start. A failure refuses the start with the failing checks joined on "; ", each as "<check>: <what to fix>".

### A continuation reopens the agent's own checkout

#### Context

**User story**: the user presses Resume on a finished or stopped agent [1], or the daemon retries one, and the agent carries on in the same checkout [3], on the same branch, as the same row of the agent list.

**Problem**: a Resume pressed the instant an agent's row turns done can land while the process that wrote that ending is still exiting and its teardown is still archiving the very history the continuation restores.

#### Business logic

A continuation start carries only its seed: the agent to continue and, when it has one, the driver session [20] to resume. Its options are therefore the project's own options as the base (the preferences [21] with the repo file [22] on top, resolved as in `daemon-services.ts`) with the caller's explicit options over them, so an agent whose first leg was armed to merge does not resume with the merge silently disarmed. A fresh start is untouched: the launcher resolves its options itself and sends them whole.

Before the preflight [2], the previous leg is waited out for up to 15 seconds when its slot is still held: a leg that positively reports itself running is a genuine collision and is not waited for, so the busy refusal stands; a leg that reports itself ended, or whose state cannot be read at that instant, is waited for until its slot clears and its queued teardown finishes. A state that cannot be read is asked again rather than taken as running, because the agent's status file is rewritten in place and a single torn read says nothing about the leg.

After the preflight, the agent's checkout is reused when it still exists; otherwise the agent's branch, the one recorded when its checkout went (the agent renames its branch itself to its session name [23], so the recorded name wins over the birth branch `agent-<agent id>`, which is the only fallback), is checked out again as a fresh checkout with the four skills [11] linked in. The agent's archived history is restored into the checkout, so it reopens its own event stream [9] instead of starting empty and stays one row. All of this runs under the agent's lock (`agent-locks.ts`), so a Resume never reuses a checkout that a teardown is removing. When none of this is possible, a new agent is started instead and the daemon logs "[framework] could not continue agent <agent id> (<reason>); starting a new one".

### Every agent gets its own checkout and branch

#### Context

**User story**: several agents [1] work one project at the same time, and the user's own checkout [3], uncommitted work included, is never touched.

**Problem**: creating a checkout on a large repository can outrun its time budget and be cut short part way, leaving a partial directory git no longer knows about.

#### Business logic

A new agent's id is derived from the moment of the start, unless the caller minted the id first: a sweep [15] that claimed a ticket for the agent wrote the claim [24] under the id it now starts the agent with. The checkout is created by the `branches` skill [11] in one sequence: a git worktree under the project's `.branches/` directory on a fresh branch `agent-<agent id>`, `.branches/` hidden from git, the project's dependency trees linked in, and the `tickets`, `queue` and `logs` skills linked in beside `branches` where the coding agent's [18] harness looks for skills.

A project that is not a git repository cannot be given a checkout: its agents run in the project's own checkout, one at a time since they would collide, and the daemon logs "[framework] <project> is not a git repository, so it gets no worktree; running in the main checkout". A project that is a repository but whose checkout could not be created does not fall back to the user's checkout: the start is refused with "could not create a worktree for this run: <reason>", the dashboard shows it, and starting again is the retry, because a failed agent is recoverable and a user's checkout with an agent's edits mixed in is not. When the creation was cut short by its time budget, the partial directory it left is removed; a failure of any other kind leaves the directory alone, since it may be a path that was on disk before this agent asked for it.

### One agent per checkout

#### Context

**Business logic story**: with one checkout [3] per agent [1] there is no cap on how many agents a project runs; the only collision left is two agents in the same checkout.

#### Business logic

Each agent holds a slot keyed by its project and its agent id [25]; an agent that got no checkout of its own is keyed by the project alone, which restores the one-at-a-time rule for that project (the key scheme is in `runtime-keys.ts`). A start is refused as busy with "a session is already active for this project; stop it or wait for it to finish" when a start for the same key is still mid-spawn or when the slot's process is alive. A slot whose process is dead is dropped rather than trusted, so an agent whose exit was never observed cannot keep a project busy forever.

### The agent spec, the spawned process and its environment

#### Context

**Business logic story**: the agent's [1] process is a second copy of the CLI, told everything through one file rather than a command line.

#### Business logic

The daemon writes one agent spec [4] (`agent-spec.ts`): the prompt exactly as given, even when empty, and never re-rendered, so a preset the user reviewed in the composer runs verbatim; the kind (`build`, `prompt` or `research`); the checkout [3]; the agent id [25], which also tells the process that The Framework owns its branch; whether it continues an existing agent, in which case the process reopens the agent's event stream [9] instead of truncating it; and every option the start carried.

The process runs detached from the daemon, with its input and output closed and its error output written to `.the-framework/stderr.log` in its checkout when it has one, so a process that dies at boot leaves a trace; when that file cannot be opened the agent still starts. Its environment is the daemon's with the `branches`, `tickets`, `queue` and `logs` commands first on its PATH, its agent id as `AGENT_ID` so that a claim [24] it makes names the agent and not its branch, and the daemon's own address once the daemon has one, so a `web` agent can ask this daemon for a cloud session [26]. The process id becomes the agent's live slot, and the start answers with the agent id so the dashboard selects that agent rather than guessing.

Right before the spawn, and again because everything before it waited, the daemon checks whether it began shutting down meanwhile: if so the start is refused with "the daemon is shutting down" and everything it allocated is taken back: the spec, and for a new agent its checkout and branch; a continued agent's checkout is the agent's own and is left alone. A checkout left standing without an agent would otherwise be reclaimed at the next boot by pushing an empty branch.

### When the process ends

#### Context

**Problem**: with its input and output detached, a process that dies before it opens its own record leaves no trace but its exit; the agent's [1] page would wait for it forever.

#### Business logic

When the process exits, or could not be spawned at all, the spec [4] is removed if it is still on disk, since a process that died before reading it would leave the prompt and any device [8] token there, and the agent's slot is freed. A process that could not be spawned is recorded as "its process could not be spawned (<error>)"; one that exited as "its process exited with code <code> before reporting anything"; one ended by a signal as "its process was killed by <signal> before reporting anything".

For an agent with its own checkout [3], a retirement chain then runs and is parked on the slot so a continuation can wait for it: first the failed-start marker, then the teardown, then the transient-death retry. The failed-start marker is written only when the process never wrote its own status file: the agent is marked failed with the prompt as its intent, the last 2,000 characters of its error output are appended to its event stream [9] as "The session failed to start: <detail>." followed by that tail, and the daemon logs "[framework] run <agent id> failed to start: <detail>". A process that did write its status file is left alone: its ending is its own to report. When the checkout is already gone, no marker is written, because a marker would make a directory under `.branches/` that is not a checkout and every later git command run there would act on the whole repository; the log line "[framework] run <agent id> failed to start: <detail>; its checkout is gone, so no marker is written" is the record instead.

### Teardown: record the run, then reclaim the checkout

#### Context

**User story**: a finished agent's [1] work reaches the remote and its checkout [3] disappears from disk; the agent stays in the agent list with its branch and its history.

**Problem**: the agent's history lives inside its checkout, so removing the checkout first would delete the agent from the dashboard. And a Push, Remove or Resume pressed on a freshly finished agent lands while this runs, both sides pushing the same branch from the same checkout.

#### Business logic

The teardown runs under the agent's lock (`agent-locks.ts`), one at a time with the dashboard's actions on the same agent, so whoever runs first pushes and the other finds the remote already has the branch. The agent's branch is read from the checkout while the checkout still exists, and only from a directory that is a checkout root, because a directory that no longer is one would answer with the user's own branch. The agent's record is then written as a run [5] on the `agent-data` branch [13] through the `logs` skill [11], the card from the agent's status and the diary from its event stream [9], committed and pushed the moment it lands, so it is durable without a human and never a commit on a code branch; a record that could not be written is logged as "[framework] could not archive session <checkout name>: <error>". Then the checkout is removed by the one rule in `worktrees.ts`, shared with the reclaim [6] sweep [15] and the dashboard's Remove: only what is on the remote may go, whatever state the agent ended in, since what decides is whether the work is recoverable, not how the agent ended. A push that cannot land keeps the checkout, logged as "[framework] keeping worktree <path>: <reason>", and the sweep retries it later; a removal is logged as "[framework] removed worktree <path> and <what was deleted>: nothing on it is missing elsewhere". Any failure along the way leaves the checkout on disk, which is the safe direction.

### One more try after a transient death

#### Context

**Problem**: the model's connection drops or its API buckles mid-work. The failure is about the transport, not the work, and the agent's [1] checkout [3] and driver session [20] are intact.

#### Business logic

After its teardown, an agent that failed is continued once more when all of this holds: its location [19] is `local` (a `web` or `actions` agent's lifecycle is not this daemon's to replay); it failed by its own report, that is, its final end event names the failure, so an agent that died at boot is never retried; the failure detail names a transport error (a connection closed, reset or in error, a timeout, a hung-up socket, an overloaded or rate-limited API, a server error); and it has been retried fewer than 2 times in this daemon's life, counted in memory so a lost count only ever grants one extra attempt. A stopped agent stays stopped. The retry is logged as "[framework] agent <agent id> died to a transient error (<detail>); continuing it in 15s, attempt <n> of 2", waits 15 seconds without holding the daemon open (a daemon that exits first simply does not retry), and then starts a continuation of the agent, unattended [14], resuming its driver session when it has one, with the prompt "This session died to a transient connection error, not because anyone asked it to stop. Look at what you had already done, then carry on from there and finish the work." A continuation that cannot start is logged as "[framework] could not continue agent <agent id> after its transient death: <reason>".

### Adding a project

#### Context

**User story**: the user adds a repository by path on the Overview and it appears in the Projects list, activated.

#### Business logic

The path is resolved against the daemon's home directory and must be an existing directory; otherwise the answer is "path does not exist or is not a directory: <path>" rather than a confusing git error. The repository is then activated by the rule in `install.ts` and registered by path; an activation failure is the answer, and a project that was already activated is a success that says so. Registration is best-effort: a registry that cannot be written does not fail the activation.

### What the sweeps read: slots and busy ids

#### Context

**Problem**: a sweep [15] must tell a project with no agent from a busy one and say what holds it, and the reclaim [6] sweep must not race a teardown for the same checkout [3]: an agent's [1] status turns done a beat before its teardown archives and removes its checkout.

#### Business logic

A project's slots are the agents [1] whose process is alive, re-checked against the operating system at read time rather than trusted, each with its agent id [25] and process id, plus the agents mid-spawn, which cannot outlive the spawn. An agent that got no checkout of its own appears without an id. The busy ids are wider: every agent the daemon is still responsible for, spawning, running or mid-teardown, because "not live on disk" is not the same as "the daemon is finished with it".

### Stopping every agent at shutdown

#### Context

**User story**: Ctrl-C closes the dashboard and every agent [1] it is running. What is stopped is not lost: the agent keeps its branch, and its checkout [3] until its work reaches the remote, so the next start continues the same conversation when the user asks for it.

**Problem**: an agent's process is detached so it survives the CLI that asked for it, not the daemon that owns it; left alone it becomes an orphan holding a checkout and the browser it launched with no daemon that knows about it. And ending a process is not letting go of the repository: its teardown runs well past its exit, and the archive commit that follows shutdown would miss that agent's ending.

#### Business logic

Only the agents this daemon spawned are stopped, never an agent it merely steers. Once stopping has begun, every later start is refused, for good. Each agent's process receives a graceful stop and is given 5 seconds by default to go; one that does not go is ended forcibly, together with its whole process group so that the browser it launched dies with it, and then the process itself for one that led no group. The daemon then waits, bounded by the same grace, until each stopped agent's slot has been let go of, its process gone and its teardown finished; a teardown that wedges costs the shutdown its grace period, not the exit. The agents stopped are reported by agent id [25], or as "pid <process id>" for one without an id, because a process still alive at shutdown that the dashboard showed as finished is the one fact that explains a slot the sweeps [15] could not account for.
