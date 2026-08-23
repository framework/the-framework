The daemon itself: the one foreground process bare `the-framework` runs. It brings the machine into a known state, serves the dashboard, wires the dashboard's buttons to the background services, and tears everything down in order when the user presses Ctrl-C.

## User story

The user runs one command in a repository and gets a working dashboard in their browser, with their projects listed and nothing left over from the last time. When they press Ctrl-C, everything the daemon was running stops with it.

## Business logic — TL;DR

- **Foreground only** - there is no detached mode, so no liveness record, no machine-global state file and no second process to find, reuse or stop.
- **Files are the seam** - the dashboard is a projection of each agent's event log, and steering goes back through the control channel; there is no agent-to-daemon messaging.
- **Where the dashboard binds** - localhost by default; binding anywhere reachable off the machine requires a shared token on every route.
- **The browser bridge is opt-in** - off unless the user turned it on, and it shares the daemon's one secret rather than minting a second.
- **The boot sequence** - create the framework directory, register the home workspace, then reconcile agents a dead daemon left marked running.
- **Nothing is resumed at boot** - stopping the last daemon was a deliberate act, and the stopped agents keep their branches so the user can continue them when they choose.
- **One quota meter for the whole daemon** - the usage panel and the unattended work read the same long-lived reading.
- **The dashboard's settings act immediately** - saving a Discord credential rebuilds the Discord services, and switching Auto PM on sweeps now instead of up to ten minutes later.
- **Shutdown in order** - the background services stop first, then the agents, then the meter, then the server.

## Business logic

### Foreground only

#### User story

The user wants one obvious process they started and can stop, not a background service to discover, adopt or kill.

#### Business logic

The daemon runs in the foreground and only in the foreground: Ctrl-C closes the dashboard and every agent it is running. Because there is no detached mode, there is no liveness record, no machine-global state file, and no second process to find, reuse or stop.

### Files are the seam

#### User story

The user watches an agent's output live in the browser and clicks Stop, or answers a question it parked on.

#### Business logic

An agent appends to its own event log, and the daemon tails that file and pushes each new event to connected browsers — the dashboard is a projection of the event stream, not a second source of truth. Steering goes the other way through the control channel: the daemon owns no agent, so its Stop button and choice picks are appended to that project's control channel and the live agent tails it. Appends are best-effort, because a full disk must not take the dashboard down with it. Agents and steering are keyed per project — each agent is spawned against its project's path and its control entries land in that project's own channel — and the daemon's own working directory is simply the home workspace it streams by default.

The framework directory is created up front, so the daemon works as the very first command in a fresh workspace, before any agent has made it.

### Where the dashboard binds

#### User story

The user runs the daemon on a server and wants to reach its dashboard from their laptop, without leaving a machine that spawns processes open to anyone who finds the port.

#### Business logic

The dashboard binds to port 4200 on localhost by default, which is unreachable from off the machine and needs no secret — the local zero-configuration path is unchanged. Binding to any address that is not loopback generates and persists a shared token instead, and every route is then gated behind it.

If start-up fails after the port has been bound, the server is torn down before the failure is reported, so a failed start cannot leave a process squatting the port and holding the event loop open.

### The browser bridge is opt-in

#### User story

The user wants a parked question from a cloud session carried into their local dashboard.

#### Business logic

The browser bridge is off unless the user turned it on, because it opens the daemon's one route reachable from another origin; while off, every bridge route is not found. When on, it reuses the daemon's own shared token rather than minting a second one — the two guard the same daemon, and a second secret would be one more thing to rotate and leak without narrowing anything.

The cloud sessions the bridge should have a tab open for are gathered across every registered project, because a cloud agent is not tied to the home workspace, and per project best-effort so one unreadable repo cannot empty the list.

### The boot sequence

#### User story

The user's machine crashed, or they killed the daemon the hard way. On the next start, agents that no longer exist must not still show as running with a Stop button that does nothing.

#### Business logic

At boot, in order: the framework directory is created; the home workspace is registered as a project if it is activated; then every registered project's agents are reconciled — any agent a dead process left marked as running is recorded as stopped, and the number fixed per project is logged.

Registering the home workspace is best-effort and idempotent, so it never blocks the daemon coming up, and a working directory that lives inside an already-registered project is skipped — the daemon creates its framework directory wherever it runs, so starting it from a subfolder of a repo would otherwise keep adding a nested duplicate project.

### Nothing is resumed at boot

#### User story

The user pressed Ctrl-C yesterday. Today they start the daemon again and expect a quiet machine, not yesterday's agents running again behind their back.

#### Business logic

No agent is restarted at boot. Ctrl-C closing the last daemon and every agent it was running was a deliberate act. A stopped agent keeps its worktree and branch, so it is the user's to continue from the dashboard whenever they want it.

### One quota meter for the whole daemon

#### User story

The usage panel and the unattended work must agree about where the account stands.

#### Business logic

The daemon owns one long-lived quota reading and hands the same one to the dashboard and to the background services. A second poller would double a rate-limited read and could disagree with the number on screen. The meter is stopped by the daemon on the way out as well as by the dashboard, because a broken install serves errors without ever taking ownership of it and that poller would otherwise keep reading by itself.

### The dashboard's settings act immediately

#### User story

The user pastes a Discord webhook, or ticks "spend what's left on the roadmap", and expects something to happen now — not after a restart, and not in ten minutes.

#### Business logic

Saving a Discord credential writes it to the registry and then rebuilds this daemon's Discord services against it, so notifications start without a restart. A preferences write that switches Auto PM *on* wakes the sweep immediately; an unrelated setting saved while it happens to already be on does not, because that is no reason to go spend quota. The dashboard's own "Run now" asks for an on-demand sweep instead, which runs even while the schedule is off, and the schedule stays off. Only the daemon runs the sweep, so only it can report what the sweep decided, and the per-project error state the background jobs record is what the dashboard reads.

Every agent the background services start is run as a verbatim prompt: these are preset prompts and queue entries, not build intents to scaffold from.

### Shutdown in order

#### User story

The user presses Ctrl-C. Nothing may be started while everything is being stopped, and nothing the daemon owned may outlive it.

#### Business logic

On an interrupt or termination signal, the shutdown runs in a fixed order. The background services quiesce first, so that Auto PM or an arriving notification cannot start an agent while the rest are being stopped. Then the agents this daemon spawned are stopped, and the ids of those that were still alive are logged by name — a process still alive at shutdown that the dashboard showed as finished is the one fact that explains a busy slot nothing else can account for, and a bare count hides it. Finally the quota meter is stopped, the runtime is disposed, and the server is closed.

Finished agents' archives need no flushing step here: each one is committed and pushed through the data branch's write cycle the moment that agent settles.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
