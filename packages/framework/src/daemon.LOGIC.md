Runs The Framework's one daemon per machine, in the foreground: it binds the dashboard on a port and host, decides whether a shared token guards it, registers the directory it was started in as a project, repairs what a previous daemon left behind, wires the dashboard to the runtime that starts agents [1] and to the sweeps [2] that work in the background, runs the bridge browser [3] when asked, and on Ctrl-C closes all of it in an order that lets nothing start while the rest stops. It also fixes the event-typed name of the tail on `.the-framework/events.jsonl` (the tailing rules are in `jsonl-tail.ts`) and the "strictly inside" test the home project registration relies on.

## Context

**User story**: the user runs `the-framework` inside a repository and the dashboard comes up at `http://127.0.0.1:4200`; that repository is a project of the dashboard from then on. Ctrl-C closes the dashboard and every agent [1] it is running, and there is no way to leave the daemon running detached. Started with `--host` on an address other than loopback, the dashboard is reachable from the network, and the URL the user has to open carries a token.

**Business logic story**: the daemon owns no agent's state. An agent appends what it does to the event stream [4] in its checkout [5], and the dashboard is a projection of that file; steering goes the other way through the control file [6]. The daemon therefore serves files, spawns processes and runs the sweeps [2]. The rules for starting and steering an agent live in `daemon-runtime.ts`, the sweeps in `daemon-services.ts`, the HTTP server and its request guard in `dashboard/server.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[3] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[4] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[9] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[10] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[11] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[12] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[13] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[14] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[15] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[16] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[17] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[18] prompt agent: one of the two kinds of agent: a prompt agent runs one prompt and stops there, while a build agent works the agent queue after its opening exchange.
[19] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **Port, host and the shared token** - the dashboard binds `127.0.0.1:4200` unless told otherwise; a loopback bind needs no secret, any other bind creates or reuses the shared token and every request without it is refused.
- **The home project** - the directory the daemon starts in gets its `.the-framework/` directory up front and, when it is activated, joins the Projects list, unless it lies inside a project already registered.
- **What boot repairs** - across every registered project, agents [1] recorded as running whose process is gone are given their missing end, and agent browsers nobody owns any more are closed.
- **Nothing is resumed at boot** - the agents the previous daemon stopped stay stopped, keeping their checkout [5] and branch for the user to continue from the dashboard.
- **What the dashboard is wired to** - one quota [7] source shared with Auto PM [8], the per-project error state the sweeps [2] write, the relay [9] endpoints for devices [10], Discord credentials that take effect on save, preference writes that act the moment they switch something on, and Auto PM's report and its "sweep now" ask.
- **The bridge and its browser** - the bridge [3] is on only when its preference was on at boot, reuses the shared token as its secret, and its browser launches in the background once the dashboard listens if the user asked for it; the Driver tab's session list is gathered across every project.
- **Foreground only, and the order of shutdown** - the daemon runs until Ctrl-C; then the sweeps stop first so nothing new can start, the agents it spawned are stopped and named, and the quota source, the bridge browser, the runtime and the HTTP server follow; a start that fails after the port is bound releases the port.

## Business logic

### Port, host and the shared token

#### Context

**User story**: see `## Context`. Exposing a process spawner to the network is a security decision: anyone who reaches the port can run code on the machine, so a network bind is guarded by a secret the user has to carry in the URL.

#### Business logic

The port defaults to `4200`; a port of `0` asks the operating system for a free one, and the port actually bound is reported once the HTTP server listens, together with the process id, the host, the URL and the start time. That report is the only way the CLI learns the port and prints the URL. The host defaults to `127.0.0.1`. A loopback host (what counts as loopback is the rule in `loopback-host.ts`) needs no token, so the local zero-configuration path stays as it is. Any other host exposes the dashboard to the network: the daemon reads the shared token from the registry or creates and persists it there now (the rule in `registry.ts`), hands it to the HTTP server, and every request that does not present it is refused.

### The home project

#### Context

**User story**: the user runs `the-framework` inside a repository and finds it in the dashboard's Projects list without registering it by hand.

**Problem**: the daemon creates a `.the-framework/` directory for its own state wherever it runs, so a daemon started from a subfolder of a registered repository would otherwise register that subfolder as a second, nested project on every start.

#### Business logic

The directory the daemon is started in is its home project. Its `.the-framework/` directory is created before anything else, so the daemon works as the very first command in a fresh repository, before any agent [1] has written there. When the home directory is activated (it carries the `.the-framework/.gitignore` that activation writes; the rule is in `install.ts`), it is added to the Projects list, deduplicated by path, unless it lies strictly inside a project already registered: strictly, so a directory equal to a registered project is the registered project and one outside every project is its own. A home directory that is not activated is not registered, and the dashboard serves all the same. Both the activation check and the registration are best-effort: a failure of either never keeps the daemon from coming up.

### What boot repairs

#### Context

**Problem**: a fresh daemon drives no agent [1], but a previous daemon, or an agent's process under it, can have died without recording an end. Such an agent shows as running forever, with a Stop button that does nothing and a gate [11] that reads as answerable while nobody reads its picks [12]. A Chrome that an agent launched can likewise outlive the agent that owned it.

#### Business logic

At boot, across every registered project, each agent whose run [13] or archive [14] says running while its process is provably gone, or whose record names no process to check, is given a surrogate end: the agent is marked stopped with the detail "its process died without reporting an end", and the gate it died holding expires with it. The end is written to the run on the `agent-data` branch [15] and to the archive, each best-effort. An agent whose process is alive on this machine is left alone, because a second daemon may be driving it. The number repaired is logged per project as "[framework] reconciled N orphaned agent(s) in <project>". Then every agent browser nobody owns any more, a Chrome running on the throwaway profile agents use whose parent process is no longer an agent, is ended and its profile removed, and the process ids are logged as "[framework] closed N orphaned agent browser(s): pid …"; this does nothing on Windows. The exact liveness and ownership rules are in `store/agent-store.ts` and `browser.ts`. Each repair is best-effort and a failure is silent.

### Nothing is resumed at boot

#### Context

**Business logic story**: Ctrl-C closes the daemon and every agent [1] it runs. That close is a deliberate act of the user.

#### Business logic

The daemon starts no agent at boot on its own. Starting again the agents the previous daemon stopped would be doing behind the user's back what the user just ended. A stopped agent keeps its checkout [5] and its branch, so it is the user's to continue from the dashboard whenever they want.

### What the dashboard is wired to

#### Context

**Business logic story**: the HTTP server (`dashboard/server.ts`) knows nothing on its own; the daemon hands it every source it answers from and every action it forwards. Two of those sources exist here rather than in the dashboard because only the daemon runs the sweeps [2].

#### Business logic

The daemon hands the HTTP server:

- The runtime's actions (`daemon-runtime.ts`): starting an agent [1], adding a project, the events of an agent this daemon is relaying, the reads and steering of an agent running on a device [10], and the relay [9] endpoints through which another machine's daemon runs, reads and steers an agent here.
- One quota [7] source: a single reader that polls for the whole life of the daemon, shared by the dashboard's usage panel and by Auto PM [8], so the bar the user reads and the line Auto PM obeys cannot disagree; the spend offset [16] it applies is read from the preferences [17]. The daemon stops that reader itself at shutdown, because a broken install serves errors without ever taking ownership of it.
- The per-project error state that the sweeps write and the dashboard lists.
- The Discord credential store: a credential saved from the dashboard is written to the registry, and this daemon's own Discord watchers are then rebuilt against it, so the bot connects without a restart.
- The preferences store, with a listener on what each write switches: a write that switches Auto PM on wakes the Auto PM sweep at once, since the sweep otherwise re-reads the preference only on its own cadence and a box just ticked would sit there doing nothing for up to ten minutes; a write while it is already on is not a reason to spend quota. A write that switches the bridge browser [3] on launches it, and one that switches it off closes it.
- Auto PM's report of what its last sweep decided, and the "sweep now" ask, which runs one Auto PM sweep on demand even while Auto PM is switched off: the click is an explicit ask, and the schedule stays off.
- The built dashboard bundle, served as static files; a missing bundle, which means a broken install, is reported by the server as unavailable rather than crashing the daemon.

Every agent the sweeps start (`daemon-services.ts`) is a prompt agent [18] started with its prompt verbatim: a preset's prompt or chat text, never a build intent to scaffold from.

### The bridge and its browser

#### Context

**User story**: the user runs an agent whose location is `web` and answers the question its cloud session [19] is parked on from the dashboard. The bridge [3] carries that question in and the pick [12] back. The user switches the bridge, and the daemon's own browser for it, on and off from Settings.

**Problem**: the bridge opens the daemon's one route reachable from another origin, and its browser's first launch downloads Chrome.

#### Business logic

The bridge is opt-in: the browser bridge preference [17] as it stands at boot decides. When it is on, the bridge token is the same shared token that guards a network bind, created and persisted now if it does not exist yet, even on a loopback bind; a second secret would be one more thing to rotate and leak without narrowing anything. When it is off, the HTTP server gets no bridge token and the bridge's routes are absent. A preference flipped while the daemon runs takes effect at the next start.

The bridge browser is the daemon's own Chrome for Testing with the extension installed, so a `web` agent needs no user's Chrome open. It is launched only once the dashboard listens, because the extension is told the daemon's address, and only when the bridge browser preference is on; the launch runs in the background so the dashboard never waits on the download. A launch asked for while the bridge has no token fails with a message that names the fix: "the browser bridge was switched on after the dashboard started — restart the dashboard, and the browser launches on its own" when the bridge preference is on now, or "turn the browser bridge on, then restart the dashboard" when it is off. One browser runs at a time; a browser the user quits is reported stopped and not relaunched; the rest of its lifecycle is in `bridge-browser.ts`.

The cloud sessions the Driver tab serves are gathered across every registered project, since a `web` agent is not tied to the home project, and each project is read best-effort so one unreadable repository cannot empty the list. Which of those agents' sessions make the list is the rule in `dashboard/bridge-sessions.ts`, together with the sessions the dashboard holds a pick for.

### Foreground only, and the order of shutdown

#### Context

**User story**: Ctrl-C closes the dashboard and every agent [1] it is running; nothing of The Framework keeps running afterwards.

**Problem**: a sweep [2] or a Discord message arriving mid-shutdown would start an agent while the rest is being stopped; a bridge browser [3] left running would serve a daemon that is gone and hold its profile against the next daemon; a start that fails after the port is bound would leave a process squatting the port.

#### Business logic

The daemon runs until it receives SIGINT or SIGTERM (Ctrl-C), or, in tests, until the caller's signal fires. There is no detached mode, so there is no liveness record, no machine-wide state file, and no second process to find, reuse or stop.

Shutdown proceeds in this order. The sweeps are quiesced first, so nothing may start or steer an agent from then on. The agents this daemon spawned are stopped next, before any preview they may be serving; stopped here they keep their checkout [5] and branch, so the dashboard can continue them on the next start, and their ids are logged as "[framework] stopped N agent(s): …", because a process still alive at this point that the dashboard showed as finished is the one fact that explains a slot the sweeps could not account for. The archives need no flush: an agent's teardown writes its archive through the `agent-data` branch [15] the moment the agent settles. Then the quota [7] reader is stopped, the bridge browser closed, the runtime disposed, and the HTTP server closed.

When startup fails after the port is bound, the HTTP server is closed before the failure is reported, so the process does not stay alive holding the port.
