Runs The Framework's one daemon per machine, in the foreground: it binds the dashboard on a port and host, decides whether a shared token guards it, registers the directory it was started in as a project, runs each project's open hooks [18] once the dashboard listens, wires the dashboard to the runtime that starts agents [1] through a project's start hook and to the sweeps [2] that work in the background, runs the bridge browser [3] when asked, and on Ctrl-C runs each project's close hooks [18] and closes all of it. The daemon runs no agent itself. It also fixes the "strictly inside" test the home project registration relies on.

## Context

**User story**: the user runs `the-framework` inside a repository and the dashboard comes up at `http://127.0.0.1:4200`; that repository is a project of the dashboard from then on. Ctrl-C closes the dashboard, and there is no way to leave the daemon running detached; an agent [1] in flight is not the daemon's process and goes on to its end. Started with `--host` on an address other than loopback, the dashboard is reachable from the network, and the URL the user has to open carries a token.

**Business logic story**: the daemon owns no agent and no agent's state. The tool that runs an agent keeps the agent's card and diary [4] in the agent's checkout [5], and the dashboard is a projection of those files; what the user says to an agent goes the other way through the agent's inbox [6], or through the project's resume hook once the agent has ended. The daemon therefore serves files, runs the projects' hooks [18] and runs the sweeps [2]. The rules for starting an agent live in `daemon-runtime.ts`, for writing to one in `dashboard/run-inbox.ts`, the sweeps in `daemon-services.ts`, the HTTP server and its request guard in `dashboard/server.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[3] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[4] card / diary: an agent's record in the `logs` skill's two shapes: the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are on the `agent-data` branch.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[9] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[10] question: what an agent's turn ended on, asking the user to choose between options; a cloud session's question reaches the dashboard through the bridge.
[11] pick: the answer to a question: the option or options the user chose.
[15] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[17] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[18] hooks: the shell lines a project's own `.the-framework/hooks.yml` names: the `open` and `close` lists, run in the project by the daemon when the dashboard opens and closes, and the `start`, `resume`, `check`, `offset` and `switch` lines, run when the user starts an agent, continues an ended one, opens the launcher, sets the spend offset [19], or switches a scheduled command on or off on this machine; per user, since the file is ignored by git.
[19] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work (an agent the scheduler started rather than a person) may start. Each project's scheduler holds its own, as `spendOffset` in its state file `.agent-scheduler/state.json`.

## Business logic — TL;DR

- **Port, host and the shared token** - the dashboard binds `127.0.0.1:4200` unless told otherwise; a loopback bind needs no secret, any other bind creates or reuses the shared token and every request without it is refused.
- **The home project** - the directory the daemon starts in gets its `.the-framework/` directory up front and, when it is activated, joins the Projects list, unless it lies inside a project already registered.
- **Nothing is repaired or resumed at boot** - the daemon runs no agent [1], so it has none to recover: an agent whose process died is its own tool's to sweep.
- **The projects' hooks** - once the dashboard listens, every registered project's open hooks [18] run, one project after another; at shutdown, once the sweeps are quiesced, every registered project's close hooks run; the daemon names no tool, and a hook that fails, hangs or is missing never stops the daemon.
- **What the dashboard is wired to** - the runtime's Start, the quota [7] source the usage panel draws, the per-project error state the sweeps [2] write, the relay [8] endpoints for devices [9], and preference writes that act the moment they switch the bridge browser [3].
- **The bridge and its browser** - the bridge [3] is on only when its preference was on at boot, reuses the shared token as its secret, and its browser launches in the background once the dashboard listens if the user asked for it; the Driver tab's session list is gathered across every project.
- **Foreground only, and the order of shutdown** - the daemon runs until Ctrl-C; then the sweeps stop, the projects' close hooks run, and the quota source, the bridge browser, the runtime and the HTTP server follow; agents in flight are left to end on their own; a start that fails after the port is bound releases the port.

## Business logic

### Port, host and the shared token

#### Context

**User story**: see `## Context`. Exposing the daemon to the network is a security decision: anyone who reaches the port can make it run the project's own shell lines, which is code execution on the machine, so a network bind is guarded by a secret the user has to carry in the URL.

#### Business logic

The port defaults to `4200`; a port of `0` asks the operating system for a free one, and the port actually bound is reported once the HTTP server listens, together with the process id, the host, the URL and the start time. That report is the only way the CLI learns the port and prints the URL. The host defaults to `127.0.0.1`. A loopback host (what counts as loopback is the rule in `loopback-host.ts`) needs no token, so the local zero-configuration path stays as it is. Any other host exposes the dashboard to the network: the daemon reads the shared token from the registry or creates and persists it there now (the rule in `registry.ts`), hands it to the HTTP server, and every request that does not present it is refused.

### The home project

#### Context

**User story**: the user runs `the-framework` inside a repository and finds it in the dashboard's Projects list without registering it by hand.

**Problem**: the daemon creates a `.the-framework/` directory for its own state wherever it runs, so a daemon started from a subfolder of a registered repository would otherwise register that subfolder as a second, nested project on every start.

#### Business logic

The directory the daemon is started in is its home project. Its `.the-framework/` directory is created before anything else, so the daemon works as the very first command in a fresh repository, before any agent [1] has written there. When the home directory is activated (it carries the `.the-framework/.gitignore` that activation writes; the rule is in `install.ts`), it is added to the Projects list, deduplicated by path, unless it lies strictly inside a project already registered: strictly, so a directory equal to a registered project is the registered project and one outside every project is its own. A home directory that is not activated is not registered, and the dashboard serves all the same. Both the activation check and the registration are best-effort: a failure of either never keeps the daemon from coming up.

### Nothing is repaired or resumed at boot

#### Context

**Business logic story**: the daemon runs no agent [1]. An agent is the process of the tool the project's start hook [18] names, and that tool records its own agents and sweeps the ones whose process died.

#### Business logic

The daemon starts no agent at boot, and repairs none: it reads an agent's card [4] as it stands, and never writes an end on an agent's behalf. An agent that ended waiting on a question [10] keeps its checkout [5], and any ended agent is the user's to continue from the dashboard whenever they want.

### The projects' hooks

#### Context

**User story**: the user keeps `.the-framework/hooks.yml` in a project with `npx agent-scheduler start` under `open` and `npx agent-scheduler stop --unless-keep-alive` under `close`; from then on the project's scheduler is on whenever the dashboard is, and off when the dashboard closes unless the scheduler was told to keep alive. The daemon knows nothing of the scheduler: it runs the lines the file names.

**Problem**: a tool that starts agents on a schedule should follow the dashboard's own life without The Framework naming that tool; and a line a person wrote must never keep the dashboard from coming up or from closing.

#### Business logic

The hooks [18] are the project's own: the rules for the file and for running a line are in `project-hooks.ts`. Once the dashboard listens and its URL is reported, the daemon runs the open hooks of every registered project, one project after another, each in that project's root, so a slow line delays the background sweeps [2] at most, never the URL. A project added from the dashboard while the daemon runs gets its open hooks run at that moment (the rule is in `daemon-runtime.ts`), since the boot never saw it. At shutdown, once the sweeps are quiesced, the close hooks of every registered project run the same way. The `start`, `resume` and `offset` lines are not run here: they run on the user's click (`daemon-runtime.ts`, `dashboard/run-inbox.ts`, `dashboard-rpc/quota.ts`). Every line's outcome is logged as "[framework] open hook (<project>): <line>: exit <code>" (or "timed out after 60s", or "could not start: <why>"), and what the line said on stderr is logged under it. A project without the file has no hooks and nothing is logged for it.

### What the dashboard is wired to

#### Context

**Business logic story**: the HTTP server (`dashboard/server.ts`) knows nothing on its own; the daemon hands it every source it answers from and every action it forwards. The error state exists here rather than in the dashboard because only the daemon runs the sweeps [2].

#### Business logic

The daemon hands the HTTP server:

- The runtime's actions (`daemon-runtime.ts`): starting an agent [1] through the project's start hook [18], adding a project, the events of an agent this daemon is relaying, the reads and steering of an agent running on a device [9], and the relay [8] endpoints through which another machine's daemon runs, reads and steers an agent here.
- One quota [7] source: a single reader that polls for the whole life of the daemon, behind the dashboard's usage panel. The line it draws unattended work stopping at uses the spend offset [19] of the registered projects' schedulers, read off their state files on every read, the loosest one any of them holds (`dashboard/scheduler-state.ts`); with none, the default in `dashboard/quota.ts`. The daemon stops that reader itself at shutdown, because a broken install serves errors without ever taking ownership of it.
- The per-project error state that the sweeps write and the dashboard lists.
- The preferences store, with a listener on what each write switches: a write that switches the bridge browser [3] on launches it, and one that switches it off closes it.
- The built dashboard bundle, served as static files; a missing bundle, which means a broken install, is reported by the server as unavailable rather than crashing the daemon.

### The bridge and its browser

#### Context

**User story**: the user runs an agent whose location is `web` and answers the question its cloud session [17] is parked on from the dashboard. The bridge [3] carries that question in and the pick [11] back. The user switches the bridge, and the daemon's own browser for it, on and off from Settings.

**Problem**: the bridge opens the daemon's one route reachable from another origin, and its browser's first launch downloads Chrome.

#### Business logic

The bridge is opt-in: the browser bridge preference [15] as it stands at boot decides. When it is on, the bridge token is the same shared token that guards a network bind, created and persisted now if it does not exist yet, even on a loopback bind; a second secret would be one more thing to rotate and leak without narrowing anything. When it is off, the HTTP server gets no bridge token and the bridge's routes are absent. A preference flipped while the daemon runs takes effect at the next start.

The bridge browser is the daemon's own Chrome for Testing with the extension installed, so a `web` agent needs no user's Chrome open. It is launched only once the dashboard listens, because the extension is told the daemon's address, and only when the bridge browser preference is on; the launch runs in the background so the dashboard never waits on the download. A launch asked for while the bridge has no token fails with a message that names the fix: "the browser bridge was switched on after the dashboard started — restart the dashboard, and the browser launches on its own" when the bridge preference is on now, or "turn the browser bridge on, then restart the dashboard" when it is off. One browser runs at a time; a browser the user quits is reported stopped and not relaunched; the rest of its lifecycle is in `bridge-browser.ts`.

The cloud sessions the Driver tab serves are gathered across every registered project, since a `web` agent is not tied to the home project, and each project is read best-effort so one unreadable repository cannot empty the list. Which of those agents' sessions make the list is the rule in `dashboard/bridge-sessions.ts`, together with the sessions the dashboard holds a pick for.

### Foreground only, and the order of shutdown

#### Context

**User story**: Ctrl-C closes the dashboard; nothing of The Framework keeps running afterwards. An agent [1] in flight belongs to the tool that started it and goes on to its end; the next dashboard shows it.

**Problem**: a sweep [2] still committing while the rest closes would be cut mid-write; a bridge browser [3] left running would serve a daemon that is gone and hold its profile against the next daemon; a start that fails after the port is bound would leave a process squatting the port.

#### Business logic

The daemon runs until it receives SIGINT or SIGTERM (Ctrl-C), or, in tests, until the caller's signal fires. There is no detached mode, so there is no liveness record, no machine-wide state file, and no second process to find, reuse or stop.

Shutdown proceeds in this order. The sweeps are quiesced first, which resolves once the turn in flight has finished. Then every registered project's close hooks [18] run. No agent is stopped: none is the daemon's process. Then the quota [7] reader is stopped, the bridge browser closed, the runtime disposed, and the HTTP server closed.

When startup fails after the port is bound, the HTTP server is closed before the failure is reported, so the process does not stay alive holding the port.
