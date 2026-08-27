The framework's command-line entry point. Its human surface is four options whose bare form serves the dashboard; behind one further option — the daemon's own way of spawning work — sits the entire lifecycle of a single agent, from the spec file that describes it to the exit code it leaves behind.

## User story

- The user types the command with no arguments and gets the dashboard in the browser. Ctrl+C closes it and every agent it is running; the daemon's logs stream to that terminal.
- Everything else about an agent — its prompt, its driver, its run target, its checkout — is chosen in the dashboard, never on a command line.
- The daemon starts each agent as its own process. That process narrates itself to the terminal, records itself for the dashboard, obeys Stop and choice picks while it works, and publishes its own result when it finishes.

## Glossary

- **agent spec** — the single JSON file the daemon writes to describe an agent it wants started: the prompt, which flow to run, the checkout, and the options. The command consumes the file as it reads it, so a device token carried in it does not outlive the agent that used it.
- **on-before-mergeable prompt** — the built-in quality follow-up, fired after an agent signals ready for merge: it appends quality tasks to the agent's own TODO file for the backlog loop to pick up.

## Business logic — TL;DR

- **Four options and no verbs** - `--port`, `--host`, `--help`, `--version`; anything else is a usage error. `--agent <path>` exists for the daemon, not for a human.
- **Bare command serves the dashboard** - the daemon runs in the foreground until it is signalled, printing where it is reachable, the version, and whether a newer one exists.
- **Binding off loopback is announced as a security decision** - a non-loopback bind prints a loud warning and a token-bearing URL, because the token is the only guard on a process spawner reachable from the network.
- **Nearest layer wins** - the agent spec's own values beat the repo's `the-framework.yml`; a value the spec omits is left for the file to decide, and nobody deciding lands on the zero-config default.
- **Refuse before spending anything** - a mismatched layout marker, an empty prompt, a resume asked of a build, or a missing GitHub remote/token for the `actions` target stops the agent before a driver exists, and records the failure rather than leaving the agent stuck at "running".
- **Files are the seam for steering** - Stop, live chat messages, handoff changes, the Merge action and choice picks all arrive over the control channel; the agent's own narration goes out over the event log.
- **Gates park only where someone can answer** - an unattended or unsteerable agent takes each gate's recommended option instead of waiting; a parked agent is held alive so the answer has someone to reach.
- **The agent names itself and its branch follows** - once the agent picks a session name, the framework-owned branch is renamed by the branch-management package's naming rule and the branch the checkout is then on is recorded as fact, never guessed.
- **Quality follow-ups queue before the work is published** - the on-before-mergeable prompt runs first, then the handoff, then the archive, so nothing it wrote is left behind.
- **The handoff is a ladder, and merging is authorized** - push, then pull request, then merge; the merge rung additionally needs the agent's ready-for-merge signal and an empty agent TODO file, unless a human pressed Merge.
- **A stopped agent is not a failure and publishes nothing** - a clean stop reports itself and exits 0, and neither the quality step nor the handoff runs.

## Business logic

### Four options and no verbs

#### User story

The dashboard is the product's user interface. The command exists to start it, and to be startable itself.

#### Business logic

The command accepts exactly `--port <n>` (default 4200, `0` for an ephemeral port), `--host <addr>` (default loopback), `-h`/`--help`, and `-v`/`--version`. Any other token — an unknown option or a stray word — is reported as a usage error, together with a pointer to the help, and the command exits 2. A `--port` that is not a non-negative integer, and a `--host` or `--agent` with no value after it, are the same kind of usage error.

`--version` prints the version read from the package's own manifest at runtime; if that cannot be read, it prints `unknown`.

`--agent <path>` is the daemon's process API rather than a human option: it names an agent spec, and the command then runs exactly that one agent. A spec that cannot be read is a usage error.

#### Rationale

Everything an agent needs was once a command-line flag — dozens of them, most with no human user at all, because the dashboard was serializing its own start-agent options onto a command line. They travel as one JSON agent spec now. `--host` and `--port` survive because they are the two things a browser cannot be asked and a dashboard cannot serve about itself; `--help` and `--version` because a command with options owes the user both. Printing `unknown` rather than a version number on a failed read is deliberate: the packages are legitimately versioned `0.0.0`, so a numeric fallback would make a failed read indistinguishable from a correct one.

### Serving the dashboard in the foreground

#### User story

The user runs the command and wants the dashboard, its logs, and one Ctrl+C that closes everything.

#### Business logic

The bare command starts the daemon on the chosen port and host and blocks until the process is signalled. As soon as it is listening it prints the dashboard's URL, the reminder that Ctrl+C stops the dashboard and every agent it is running, and then a footer: how to reach the help, the version, and — once the npm registry answers — whether a newer version exists. A daemon that fails to start reports why and exits 1.

Binding to a non-loopback address is treated as a security decision, not a convenience. The shared token is generated up front, a warning states plainly that the bind exposes code execution to the network and that the token is the only guard, and the printed URL carries the token so the first request can authenticate; the user is told to swap the bind-all address for the machine's actually reachable name.

#### Rationale

The update line is not awaited before the static lines: the foreground path blocks on the server forever, so a line printed after the wait would never appear at all. The check is forgiving — offline or slow resolves to "unknown", which prints nothing.

### One agent's configuration, and which flow it runs

#### User story

A project can carry its own defaults in `the-framework.yml`, and the dashboard can override them per agent. Neither should have to repeat the other.

#### Business logic

An agent's settings are resolved over layers, nearest first: what the agent spec said, then the repo's `the-framework.yml`. A setting the spec omits is genuinely absent rather than false, which is what lets the repo file decide it; a setting nobody decides falls to the built-in default, which is what makes the handoff zero-config at level `pr`. What the layers resolved to, and which layer decided it, is echoed at startup. A malformed `the-framework.yml` is a warning, never a failed agent.

The spec is re-validated rather than trusted: an unrecognised driver, run target or handoff level is ignored, and a ticket path that is not a ticket never reaches the agent — the ticket arrives from a queue file an agent itself wrote.

Which flow the agent runs is decided once. A prompt agent runs its text verbatim, because that text may already be an edited preset that must not be re-rendered. A research agent renders the research preset around the given "what", falling back to the preset's own default when no "what" was given. Anything else is a build. Transparent mode forces the prompt flow: a raw wrapped agent must skip the build's backlog work too, not merely have its system prompt zeroed. A continuation is the exception — an agent resuming a driver session whose recorded meta says it was a build re-enters the build flow, even though the dashboard's Resume always arrives as a prompt start.

Three refusals happen before any work begins: a checkout whose recorded layout marker disagrees with this build's own is refused outright; a prompt agent with no prompt is refused; and asking to resume a driver session for a build agent is refused, because a build rebuilds framing that a resumed conversation already carries.

At startup the agent also says which driver is about to spend the user's subscription when it is not the default, and names any setting the chosen driver cannot honor — the browser, for instance, is wired through Claude Code's own tool configuration and does nothing on another driver.

#### Rationale

Silently losing the context the user asked to continue from is the worst possible outcome, so a resume asked of a build stops the agent instead of quietly running a fresh session that looks resumed. A setting that silently does nothing is likewise worse than one that says so, hence the notices about settings not in force.

### Steering a running agent

#### User story

While an agent works, the user presses Stop, answers a gate, types a message to it, changes how far it will publish itself, or presses Merge — all from the dashboard, which is a different process.

#### Business logic

An agent is steerable when it records itself and was given an agent id — that is, when the daemon spawned it and therefore steers it. A steerable agent resets and then tails its control channel, and acts on each entry:

- **Stop** aborts the agent. Any gate parked at that moment resolves to "proceed" so nothing hangs, and the live-chat queue closes.
- **A message** joins the live-chat queue for the agent to consume between turns.
- **A handoff change** moves the armed rung — up or down — at any moment until the agent settles, and the new rung is immediately re-announced so a dashboard tab opened mid-agent reads it correctly.
- **Merge** arms the full ladder and records that a human authorized the merge. It does not abort: the agent still ends at its own natural end and the merge fires there. It additionally answers a backlog offer that is parked — the answer to "shall I take more work?" is "wrap up now" — while every other kind of gate keeps waiting, since those are questions about the work itself that merging does not answer.
- **A choice pick** resolves the gate it names.

Steering is one-directional over files: the control channel carries instructions in, the event log carries narration out, and there is no direct channel between the agent's process and the daemon.

#### Rationale

Steerability used to also be granted by "a daemon is alive somewhere on this machine", read from a global state file. That file went missing while the daemon was very much alive, and every Stop press then landed in the control channel and was read by nobody, in silence. Being handed an agent id is a fact about *this* agent, and holds where a file about another process does not.

### Gates and live chat only where someone can answer

#### User story

An unattended agent must never park waiting for a human who is not there; an agent the user is watching must park and wait.

#### Business logic

Choice gates park only when the control channel is live and the agent was not started unattended. An unattended agent keeps its control channel — Stop and messages still work — but every gate takes its recommended option instead of waiting, so the daemon's own product-manager work is never blocked by a question nobody will see.

The live-chat queue is handed to the agent only when the dashboard started it, which is the only case where a user interface exists to carry the conversation on. A dashboard-started agent drains whatever messages queued and then ends itself; the dashboard reopens the conversation as a continuation rather than keeping a process parked.

Every parked wait — a gate or a message wait — is held open explicitly for as long as it lasts.

#### Rationale

A daemon-spawned agent has nothing else keeping its process scheduled between turns: its output is detached, the driver runs as a per-prompt child, the control channel watcher does not hold the process open. Without the explicit hold the process simply exited mid-wait, and picks then landed in the control channel with nobody left to read them.

Conversely, a headless agent used to inherit the chat queue merely because some daemon happened to be alive on the machine, and then parked forever on a message nothing could send. Reachable is not the same as watched.

### What the agent records about itself

#### User story

Every dashboard surface is a projection of the agent's event log, including tabs opened long after the agent started. Anything not recorded is invisible.

#### Business logic

Every framework event is printed to the terminal and appended to the event log at once. Failing to open the log is reported and the agent continues without persistence; it is never a reason to fail.

The log is seeded with what the agent was asked to do, so it is labelled rather than showing as promptless, along with the agent id the daemon allocated, the flow it starts under, and where it runs. A continuation reopens the existing log instead of starting the agent's history over, so messaging a stopped agent stays a single entry in the history.

Beyond the driver's own narration the agent records these facts about itself:

- **The armed handoff rung**, at start and again whenever it changes, spelled out stage by stage. The control channel carries the instruction but only an event reaches the agent meta, and the meta is the only thing a tab opened mid-agent can read the state back from. The stages are always derived from the single rung, so they cannot contradict each other.
- **The ticket it implements**, once, when the daemon named one — a fact about why the agent exists, and what lets the Overview mark that ticket as being worked right now.
- **The branch it actually started on**, read rather than guessed. Outside a git checkout nothing is recorded.
- **The renamed branch.** When the agent announces its session name, the framework-owned branch born as `tf-agent-<agent id>` is renamed to `tf-<session name>` by the branch-management package's naming rule — suffixed when that name is taken, a no-op when the agent already checked `tf-<session name>` out itself — and the branch the checkout is then actually on is recorded. A refusal (the agent on a branch of its own making, or a reserved name) records nothing and never fails the agent.
- **The browser preview's port and page.** The port is held until the driver session opens, and the current page is re-announced after every session opens.
- **The pull request** it ends up opening, by number and URL.

It also tracks, for its own ending: whether the agent signalled ready for merge, which session name it chose, the pull request title and description the agent asked for (the latest wins, since the agent may revise them as the work changes), and whether it stopped cleanly rather than failed.

#### Rationale

The dashboard renders only the tail of the transcript from the last driver-session event, so anything emitted before the session opens is dropped from the agent's view — hence the held browser port. The page is re-announced after *every* session, not just the first: a continuation starts a fresh rendered slice, and without the re-announcement its transcript would have no row to host the preview pane.

The clean-stop verdict is the framework's own, set by a user interrupt or a budget cap, and is trusted over which signal aborted the process — a budget stop trips an internal signal the command never sees.

### Where the agent runs, and the browser it owns

#### User story

The user picks a run target in the dashboard: this device, a GitHub Actions runner, or a Claude Code cloud session. Some choices are incompatible with a local browser, and the agent should say so rather than pretend.

#### Business logic

For the `actions` target, the repository's owner and name come from its GitHub origin remote and the credential from the environment or, failing that, from the `gh` CLI — never from the committed `the-framework.yml`, since a repo file is public and this must be a user credential. A missing remote or a missing credential aborts the agent before any driver exists, with a message naming both ways to supply the token and pointing out that it must belong to a user rather than an app.

For the `web` target nothing is resolved: the session is created on the user's own account by the browser extension. The agent announces the hand-off, and states plainly that the cloud session opens on the run's pushed starting point, so local commits that were never pushed are not in it. A `web` agent's cloud session is created by the browser extension through the daemon that spawned the agent — its environment names the daemon's address, and the registry holds the daemon token; an agent with no daemon address, or no token, stops saying web runs start from the dashboard.

The framework launches Chrome itself for a browser-enabled agent rather than letting the driver's browser tooling launch its own, because that is what lets the preview attach to the same page. It does so only for a local agent: the browser tools are wired on this machine, so a remote agent could never reach them, and launching Chrome would leak a headless browser per agent. A browser asked for on a remote target, or on a machine with no Chrome, is reported as having no effect rather than failing the agent. Whether the system prompt may claim the agent has a browser is narrower still than the setting: it must be a local, real, Claude Code agent.

The preview stream of that Chrome is opened alongside it and is stopped with the agent, so no headless browser outlives it.

#### Rationale

An abort that happens after the agent meta already says "running" but before the normal ending machinery is in place must close itself out by hand — say why, record the failure, release the handles — or the agent is recorded as running forever and the dashboard shows work that never moves. Persistence is best-effort even there: a store that cannot write its own failure must still let the process exit.

The preview is opened even while the page is still, because it costs nothing: Chrome emits a frame only on a change.

### Quality follow-ups before the work is published

#### User story

An agent that believes it is done should not be the last word on quality, but a quality pass must not delay or fork the work.

#### Business logic

When the agent was started with the on-before-mergeable step enabled and it signalled ready for merge, one child agent is spawned on the same checkout that appends quality follow-ups to the agent's own TODO file, for the backlog loop to work through. Before the prompt runs, the presets are materialized so the queued entries' file references resolve even in a fresh clone or a project activated before those presets existed; a failure to materialize is reported and does not block the queueing.

Every outcome is recorded as an event, including every reason for not running: the agent never signalled ready for merge, it was stopped, it is a fake agent, it never chose a session name, or there is no executable path to spawn from. The step is skipped silently only when it was never asked for.

The child runs vanilla, which keeps it on the agent's current branch, and its spec deliberately carries no on-before-mergeable step of its own. Spawning is refused outright from a test entry point.

#### Rationale

Announcing the skips as events, rather than to standard output, exists because a dashboard-started agent has its output discarded — silence there read as "it ran and found nothing".

Running vanilla is not an optimization: the built-in system prompt's session-name step would otherwise make the follow-up commit and branch a new session of its own, stranding its output on a branch nothing merges.

Queueing follow-ups replaced running the quality presets inline, back to back, as three full passes serialized on the same git index. Queueing is both what the built-in prompt asks for and the cheaper thing: one short turn that writes a few lines.

### Handing the finished work back

#### User story

The user should get a pull request without asking for one, and should never get a merge the agent was not entitled to perform.

#### Business logic

When the armed rung reaches at least push, the finished agent publishes itself. It does not publish at all when it was stopped — stopping means the opposite of publishing what it happened to reach — nor when it is a fake agent, nor when the rung is below push; each of those is recorded with its reason.

It publishes only what the agent committed — nothing is committed on the agent's behalf, and work left uncommitted stays in the checkout — against the branch as it stands at that moment, which is the renamed one, and a branch that has disappeared is a recorded skip.

The merge rung is authorized rather than merely configured. Unless a human pressed Merge, merging additionally requires the agent's ready-for-merge signal and that the agent's own TODO file has no open entries — never the shared agent queue, which is decoupled from any one agent. A merge withheld this way is not a skipped handoff: the push and the pull request go ahead, the pull request opens as a draft for a human, and the withholding and its reason are recorded.

The pull request the framework opens carries the agent's own title and description when the agent asked for one, the latest version winning. When the agent implements a ticket that references a GitHub issue, the issue reference rides the pull request title so that the squash-merge closes the issue — otherwise an auto-merged quick win leaves its ticket open. A planning agent is the exception in both halves: its pull request lands the plan, not the work, so it gets no issue reference and any closing phrase in the title or description it wrote is defused, or merging the plan would close an issue whose work is still undone.

The outcome is both recorded and narrated: the pull request's number and URL are recorded so every later surface reads them off the agent instead of re-deriving them from branch names and timestamps, and the terminal gets a line for what happened — opened, pushed, auto-merge armed, merge-on-green watched, merged, withheld with the reason, or failed.

The quality step runs first, the handoff second, and the archive last. Both must precede the archive because archiving copies the event log to the data branch, and an outcome recorded afterwards would be missing from the copy the dashboard's history reads; and the handoff must follow the quality step so whatever that step committed is part of what gets published.

#### Rationale

A failed commit used to be ignored, which let the handoff judge a branch missing the agent's work — "committed nothing", skip — while the daemon's identical commit landed seconds later, stranding real work on a local branch nobody was told about.

Opening the pull request from the framework rather than letting the agent run the GitHub CLI itself is what preserves the title convention, the ticket's issue reference, and the recorded pull request number.

The merge rung riding on the handoff's outcome, rather than being its own step, means a merge that could not happen does not read as a failed handoff: the pull request is there either way.

### Interrupts, settling, and exit codes

#### User story

Ctrl+C should stop the work, not orphan it. And whatever happens, the process should say how it went in a form both the terminal and the dashboard can read.

#### Business logic

Ctrl+C and a termination signal do not terminate the process by default; they abort the agent, which drives the driver to kill its own child process tree. A second signal force-quits. The trap is disarmed the moment the agent settles.

Both flows — build and direct prompt — end identically. On success the agent prints a line that matches what actually happened: a hands-off agent says it handed off and that the work continues where it was sent and opens its own pull request; a research agent points at the files it wrote; a prompt agent and a build agent each say they are done. On a clean stop — the Stop button, Ctrl+C, or a budget cap — it reports that it stopped and exits 0, because a stop is not a failure and the dashboard shows the stopped state from the event log. On a real failure it reports the failure and exits 1.

Either way the teardown runs: the interrupt trap is disarmed, the event log flushed, the control channel closed, and the browser preview and the agent's Chrome shut down.

#### Rationale

Nothing gates an agent that is already running. One gate decides whether an agent may *start* — the daemon's quota boundary — and once it has, the agent runs to its own end. Interrupting mid-flight is the worst moment to economise: the tokens are already spent, the work is half-done, and what is saved is the cheap part while what is lost is the expensive part.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
