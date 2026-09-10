Implements the `the-framework` command: four options and no verbs, where the bare command serves the dashboard in the foreground, plus `--agent <path>`, the daemon's private way of starting one agent [1] process from an agent spec [2]. That agent process is the larger half of the file: it reads its options off the spec, resolves them over the repo file [3], opens the store that persists the event stream [4], tails the control file [5] for steering, decides who may answer the agent's gates [6] and whether live chat [7] is wired, creates the driver [8] for the agent's location [9], runs the agent (the middle of its life is `agent.ts`'s), and when the agent ends runs the on-before-mergeable follow-up [10] and the handoff [11], then exits with a code that says how it ended.

## Context

**User story**: the user runs `the-framework` inside a project's checkout and gets the dashboard at `http://127.0.0.1:4200`; Ctrl+C closes it and every agent it is running. The user presses Start in the dashboard, watches the agent's events, answers the questions it stops at, chats with it, ticks or unticks the handoff [11] checkboxes, presses Merge or Stop, and finds the branch pushed and a pull request opened when the agent ends.

**Business logic story**: the daemon (`daemon.ts`) writes an agent spec [2] and spawns `the-framework --agent <path>` with the process's standard streams closed, so nothing this process prints reaches the user in the common case. Every outcome the user needs to see therefore travels as an event on the event stream [4], which the dashboard reads; the terminal lines exist for an agent watched from a terminal. Prompts, gates [6], the backlog loop [12] and live chat [7] are `agent.ts`'s; this file is everything around them.

**Problem**: an agent's configuration must never also be a human-facing flag surface, so the command keeps four options and everything about an agent arrives in one JSON file. A headless process that exits silently, parks on a wait nobody can answer, or leaves a coding agent [13] running after Ctrl+C is invisible to the user, so every exit path is explicit and every skipped step is reported as an event.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] agent spec: the one JSON file the daemon hands a spawned agent process with its whole configuration.
[3] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[4] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[5] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[7] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[9] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[10] on-before-mergeable follow-up: the built-in prompt `prompts/on_before_mergeable_prompt.md`, run as a separate prompt agent on the finished agent's checkout once the agent has signaled ready for merge: it queues quality follow-ups for the work on the agent queue and folds what the work taught into the project's knowledge documents.
[11] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[12] backlog loop: after a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[13] coding agent: the CLI doing the actual work: Claude Code or Codex.
[14] daemon token: the shared secret that authenticates a dashboard exposed to the network: generated once for a daemon bound to a non-loopback address, kept in `~/.the-framework.json`, carried by the URL the terminal prints, and required on every request.
[15] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[16] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[17] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[18] ticket: a markdown file under `tickets/` on the `agent-data` branch (`<date>_<slug>.md`), with an optional plan (`.plan.md`) and claim (`.lock.md`).
[19] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[20] plan agent: an agent started to write a ticket's plan rather than to implement the ticket; its pull request lands the plan, not the work.
[21] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[22] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[23] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[24] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[25] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[26] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[27] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[28] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[29] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[30] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[31] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[32] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[33] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[34] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[35] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[36] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[37] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[38] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[39] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.

## Business logic — TL;DR

- **Four options and no verbs** - `--port`, `--host`, `--help`, `--version`, plus the daemon's unlisted `--agent <path>`; anything else is a usage error that exits with code 2.
- **The version is read from the package** - the installed package's own `package.json` names the version, and an unreadable one reads as `unknown`, never as a number.
- **Serving the dashboard in the foreground** - the bare command runs the daemon in the current directory on port 4200 and `127.0.0.1`, prints where it runs, blocks until signaled, and exits 1 when it cannot start.
- **Exposing the dashboard to the network** - a non-loopback `--host` creates the daemon token before listening, prints a security warning, and prints the URL that carries the token.
- **The startup footer and the update check** - the version and the help pointer are printed at once; whether a newer version is on npm is printed a moment later, or not at all when npm does not answer.
- **One agent from its spec** - `--agent` reads and consumes the spec, keeps only well-formed option values, and lets `FRAMEWORK_FAKE=1` turn the agent into the offline demo.
- **What is refused before anything is spent** - no prompt, a bookkeeping layout that differs from what the repository records, or a resumed session id on a build agent end the process before a driver exists; the preflight is not repeated here.
- **Resolving the configuration over its layers** - the spec's own values beat the repo file, a `false` in the spec is an answer, the handoff defaults to `pr`, and what came from where is echoed.
- **What the terminal is told before the first turn** - the driver when it is not Claude Code, the settings the driver cannot honor, where the agent runs, transparent mode, and which system prompt is in force.
- **The coding agent runs without permission prompts** - every Claude Code turn bypasses its approval prompts, because a headless agent can answer none of them.
- **The store** - the agent's events are persisted in its checkout, seeded with the prompt as the label, the daemon's agent id, the kind and the location; a continuation keeps the existing log; a store that cannot open is a warning, not a failure.
- **A continuation re-enters the flow it recorded** - continuing an agent whose record says it was a build re-enters the build flow with the message verbatim; every other continuation runs as a prompt agent.
- **Steering over the control file** - an agent with an agent id tails the control file after resetting it, and each entry either stops the agent, queues a message, moves the armed handoff, authorizes a merge, or answers a gate.
- **Who answers a gate** - a gate parks only when the control file is tailed and the agent is attended; an unattended agent takes the recommended option; a stop answers every parked gate with "proceed".
- **Live chat** - only an agent the dashboard started takes messages, and it drains what has queued and then ends rather than staying open.
- **Ctrl+C and SIGTERM** - the first signal stops the agent through its driver so no coding agent is orphaned; the second force-quits with exit code 130.
- **The journal** - every event goes to the terminal and the store, and the journal remembers what the epilogue needs: the ready-for-merge signal, the pull request text the agent wrote, the branch, and whether the agent was stopped.
- **The branch is observed, never assumed** - the checkout's branch is read at start, after every turn and before the epilogue; only a change is recorded, and the session name is read off it.
- **What the agent's record learns at start** - the armed handoff as three stages, the ticket the agent implements, and the branch it starts on are emitted before the first turn.
- **The browser** - a local Claude Code agent asked for a browser gets one Chrome shared with the dashboard's preview, and every other agent is told why it gets none.
- **The driver for the location** - an `actions` agent needs a GitHub origin remote and a user token; a `web` agent is handed to the bridge through the daemon that spawned it; a fake agent gets the offline driver.
- **Giving up before a driver exists** - a configuration fault after the store opened is recorded as a failed end, every handle is released, and the exit code is 2.
- **The flow the agent opens with** - research renders the Research preset around the text, a prompt agent runs its text verbatim, a build agent frames it and works the backlog; transparent forces the prompt path and no backlog loop.
- **How the agent ends** - a success line, then the branch read, the follow-up, the handoff and the archive, exit 0; a stop prints "■ Stopped." and exits 0; a failure prints why and exits 1; the handles are released either way.
- **The on-before-mergeable follow-up** - after a ready-for-merge signal, one vanilla prompt agent is spawned on the same checkout to queue the quality follow-ups, never from a test entry and never recursively, and every reason for skipping it is an event.
- **The handoff** - at the armed level, only what the agent committed is published, a merge is withheld without the agent's authorization or with open entries in its own TODO file, a plan agent's pull request text is defused, and every outcome is an event and a terminal line.

## Business logic

### Four options and no verbs

#### Context

**User story**: `the-framework --help` shows everything the command accepts; the user never types an agent's configuration on a command line, because the dashboard is where an agent's prompt, options and checkout are chosen.

#### Business logic

The command accepts `--port <n>`, `--host <addr>`, `-h`/`--help`, `-v`/`--version`, and `--agent <path>`, which the help does not list because it is the daemon's, not the user's. `--port` must be a non-negative integer (`0` asks for an ephemeral port); anything else is "invalid --port: must be a non-negative integer". `--host` and `--agent` without a value are "invalid --host: missing address" and "invalid --agent: missing path". Any other word is "unknown option: <word>" when it starts with a dash and "unknown command: <word>" otherwise, so a verb such as `start` is refused. A usage error is printed together with "Run `framework --help` for usage." and the exit code is 2, whatever else was on the line. Otherwise, in this order of precedence: `--help` prints the help text (which presents the command as `framework`) and exits 0; `--version` prints the version and exits 0; `--agent` runs one agent [1]; and the bare command serves the dashboard.

### The version is read from the package

#### Context

**Problem**: the packages are legitimately versioned `0.0.0` while unreleased, so a numeric fallback would make a failed read indistinguishable from a correct one.

#### Business logic

The version is read once from the `package.json` of the installed package itself, next to the compiled build. When that file cannot be read or has no version, the version is the word `unknown`.

### Serving the dashboard in the foreground

#### Context

**User story**: the user runs `the-framework` in a project and the dashboard is up; Ctrl+C closes it and every agent [1] it is running. There is no background mode.

#### Business logic

The daemon runs in the directory the command was run in, on port 4200 unless `--port` says otherwise, on `127.0.0.1` unless `--host` says otherwise; everything the daemon then does is `daemon.ts`'s. Once it is listening the terminal shows "◆ dashboard running: <url>" and "  Ctrl+C to stop the dashboard and every session it is running. Server logs stream below.", then the startup footer described below, and the daemon's own logs stream after it. The process blocks until it is signaled and exits 0 when the daemon stops. If the daemon cannot start, "could not start the dashboard (<reason>)." is printed and the exit code is 1.

### Exposing the dashboard to the network

#### Context

**Problem**: the daemon spawns processes, so anyone who reaches its port can run code on the machine. The daemon token [14] is the only guard, and the user must be told so before the daemon is left running.

#### Business logic

When `--host` is a non-loopback address, the daemon token [14] is created, or the existing one reused, before the daemon listens, so the URL that carries it can be printed the moment the daemon is up. Beside the running line the terminal warns "⚠ SECURITY: bound to <host> (non-loopback). This exposes code execution to your network; the shared token is the only guard", then prints "  Open with the token (swap <host> for this machine's reachable address, e.g. a Tailscale hostname):" followed by the URL with `?token=<token>` appended, because the bound address is typically a bind-all address such as `0.0.0.0` that no browser can open. A loopback bind creates no token and prints no warning. How the token is made and stored is `registry.ts`'s; how requests are checked against it is the daemon's.

### The startup footer and the update check

#### Context

**User story**: the user who just started the dashboard sees which version runs and whether a newer one exists, without the start waiting on the network.

#### Business logic

After the running lines the terminal prints "Type a prompt on the dashboard to start an agent, or use:", "  framework --help              All options" and "The Framework v<version>". Then, without holding anything up, the npm registry is asked whether a newer version of the package is published; the answer line lands a moment later above the daemon's logs, either "✅ Up to date (v<version>)" or an "⬆️  Update available" line naming the newer version and the install command. When the registry does not answer within 2.5 seconds, or the machine is offline, no line is printed at all. The comparison and the wording are `update-check.ts`'s.

### One agent from its spec

#### Context

**Business logic story**: the daemon writes the agent spec [2] into a private directory and passes only its path; reading the spec removes the file, so a device token in its options never outlives the start (`agent-spec.ts`).

#### Business logic

`--agent <path>` reads and consumes the spec; a path that cannot be read as a spec ends the process with "could not read the session spec (<reason>)." and exit code 2. The agent [1]'s options are read off the spec with these defaults: driver [8] `claude`, no in-context directories, the on-before-mergeable follow-up [10] off, no browser, the backlog loop [12] on, persistence on. From the spec itself: the prompt becomes the agent's intent; the kind is build, prompt or research; the checkout [15] to run in; the agent id [16] when the daemon minted one; whether this process continues an existing agent; the driver, kept only when it names a known driver; the location [9], kept only when it is one of the three; the model and the driver session [17] id to resume, trimmed and kept only when non-blank; the ticket [18] the agent implements, kept only when it is a ticket path, because it comes off the agent queue [19], a file an agent wrote, and is re-checked rather than trusted; whether the agent is a plan agent [20]; whether it is unattended [21]; vanilla [22] and transparent [23] as three-state values, where absent means "the spec said nothing" and the repo file [3] decides; the handoff [11] level, kept only when it names a rung; and the follow-up and browser switches. Setting `FRAMEWORK_FAKE=1` in the environment makes the agent a fake one, run by the offline demo driver of `fake-script.ts`, whatever the spec says; a fake agent with no prompt runs the demo's own intent.

### What is refused before anything is spent

#### Context

**Problem**: an agent that starts with half its configuration, or in a repository whose bookkeeping names differ from this build's, does harm that is hard to undo: a wrong-layout commit, or a fresh driver session that looks like a resumed one.

#### Business logic

Three refusals happen before any driver [8] exists:

- An agent whose prompt is empty ends with "this session has no prompt to run." and exit code 2. Research is the one kind whose empty prompt is fine, because its "what" has a preset default, and a fake agent has its demo intent.
- The layout gate: when the checkout [15] carries `.the-framework/LAYOUT` and it differs from what this build writes, the build refuses outright, prints the refusal naming both layouts and the fix for each direction, and exits 1. A checkout without the marker passes. The rule lives in `layout.ts`.
- A driver session [17] id to resume on a build agent [24] (as opposed to a prompt agent [24]) ends with "a resumed agent session only applies to a prompt session, not a build." plus the help pointer and exit code 2. Research, a prompt agent, a transparent [23] agent and a continuation of an existing agent are exempt, because for them the resumed conversation is the point.

The preflight [25] is not repeated here: the daemon ran it before spawning the process and refused the start on the surface the user was looking at, and an agent whose location [9] is `actions` needs no coding agent [13] on this machine at all.

### Resolving the configuration over its layers

#### Context

**User story**: a project carries its own defaults in the repo file [3], so every agent started on it runs vanilla, or transparent, or hands off at a chosen level, without the user setting it at every start; and what the user chose at the start beats the file.

#### Business logic

The repo file [3] is read from the agent's checkout [15]; when the spec names no checkout, a fake agent runs in a `framework-fake-workspace` directory under the system's temporary directory and any other agent in the current directory. A repo file that cannot be parsed is reported as a warning and ignored, never a failed agent (`config.ts`). The three settings the file may carry, vanilla [22], transparent [23] and the handoff [11] level, are resolved over two layers, the nearest that set a value winning: the agent spec [2]'s own values first, then the file. A `false` in the spec is an answer, not an absence, so it turns off what the file switched on; when neither layer set the handoff level it is `pr`. When any value came from a layer, one "◆ config: …" line says what is in effect and where it came from, worded by `config-layers.ts`. Transparent is resolved once here and governs everything below: the system prompt, the backlog loop [12], the flow, and what the record calls the agent.

### What the terminal is told before the first turn

#### Context

**Problem**: a setting that silently does nothing is worse than one that errors. Which coding agent [13] is about to spend the user's subscription, and which settings are not in force while it does, is said before the first turn [26].

#### Business logic

For a real (not fake) agent: when the driver [8] is not Claude Code, "◆ driver: <driver label>"; when the browser was asked for on a driver other than Claude Code, "note: the browser has no effect on <driver label>: the browser tools are wired through Claude Code's MCP config." on the error stream. An `actions` agent announces "◆ run on: GitHub Actions (<owner>/<repo>)"; a `web` agent announces "◆ run on: Claude Code on the web (a cloud session on your own account, created by the browser extension)". A transparent [23] agent announces "◆ transparent: on — raw <driver label>, no framework prompt, dashboard, or TODO loop". Then the system prompt in force: "◆ system prompt: SYSTEM.md" when the checkout [15] has one; "◆ built-in system prompt: off (<layer>)" when the built-in system prompt [27] is off through vanilla [22], naming the layer that turned it off, and nothing extra for transparent, which already announced itself; and "◆ context: <directories>" when in-context directories were given.

### The coding agent runs without permission prompts

#### Context

**Problem**: every turn [26] of a Claude Code agent is headless, so nobody can answer an interactive approval. Claude Code's own default quietly denies installs, builds and test runs, and an agent so limited can never verify that the project builds or runs.

#### Business logic

Every Claude Code turn runs with its permission prompts bypassed, so the full loop runs unattended. Nothing in the dashboard or the agent spec [2] can lower this; it is what makes an autonomous builder possible, and it is why exposing the daemon is the security decision the `--host` warning names.

### The store

#### Context

**User story**: the agent [1] appears in the dashboard's list labeled by its prompt from its first moment, and a dashboard tab opened mid-way reads everything the agent has done so far.

#### Business logic

Unless persistence is off, which only tests do, the store opens in the checkout [15]'s `.the-framework/` directory and every event is appended there (`store/`). A new agent starts its event file empty, discarding what a previous agent left in that checkout; a continuation of an existing agent keeps the existing log, so messaging a stopped agent stays one row in the history. The store is seeded with: the prompt as the agent's intent (research with no text is labeled by the Research preset's default "what"), the daemon's agent id [16] when it minted one, so the checkout directory and the agent recorded inside it share one id; the kind, build or prompt, where a transparent [23] agent and a research agent both count as prompt; and the location [9] when one was given. A store that cannot open prints "could not persist session state (<reason>); continuing without it" and the agent runs without persistence.

### A continuation re-enters the flow it recorded

#### Context

**User story**: the user messages an agent that has ended; the dashboard reopens it as a continuation, and a build agent [24] continues as a build, with the message sent verbatim, rather than being downgraded to a bare prompt agent.

#### Business logic

A process that continues an existing agent [1], with a driver session [17] id to resume and not transparent [23], re-enters the build flow when the reopened record says the agent was a build; the message is the continuation's opening prompt, sent verbatim, and the backlog loop [12] and the build's ending follow. Every other continuation runs as a prompt agent [24], as does a record that never said what its flow was.

### Steering over the control file

#### Context

**User story**: the user presses Stop, answers a gate [6] card, types a message, unticks a handoff [11] checkbox, or presses Merge in the dashboard, and the running agent [1] reacts; a pick left over from an earlier agent in the same checkout never fires into this one.

#### Business logic

An agent is steerable when it has an agent id [16] and persistence is on, which is every agent the daemon spawns. For such an agent the control file [5] in the checkout [15] is reset first, since gate ids repeat across agents, and then tailed. Each entry does one thing:

- A stop entry aborts the agent.
- A message entry queues the text for live chat [7].
- A handoff entry moves the armed handoff level to the level given and re-announces the armed state as an event, so the agent's record stays true for a tab opened mid-way. The checkboxes are pre-commitments: they may move the level at any moment up to the end of the agent.
- A merge entry arms the full ladder, records that a human authorized the merge, announces the armed state, and answers any parked gate that is the backlog loop [12]'s offer of more work with a stop pick [28] by the user, so the agent wraps up now. Other parked gates keep waiting: they are questions about the work itself, which merging does not answer. The agent still ends at its own natural end; the merge fires there.
- A pick entry answers the parked gate with that id, recording who picked.

When the control file cannot be reset or tailed, "control channel unavailable (<reason>); daemon steering disabled" is printed and the agent runs unsteered.

### Who answers a gate

#### Context

**Problem**: a gate [6] parked with nobody to answer it hangs an agent [1] forever, and a process with nothing left to do between turns [26] would exit while parked, leaving the picks that later arrive read by nobody.

#### Business logic

A gate parks, waiting for a pick [28] from the control file [5], only when the control file is tailed and the agent is attended; an unattended [21] agent keeps its control file for stops and messages but takes the recommended option at every gate (`agent.ts`). Each parked wait is held open by the keepalive of `gate-keepalive.ts`, so the process cannot exit while a gate or a message wait is pending. A stop [29], from Stop, Ctrl+C or a stop entry, answers every parked gate with "proceed" as an automatic pick and closes the message queue, so a stopped agent never hangs on a gate.

### Live chat

#### Context

**User story**: the user types into the composer while the agent [1] works, and the message is delivered between turns; once the agent has settled [30] with nothing queued, it ends, and the dashboard reopens the conversation as a continuation when the user writes again.

#### Business logic

The message queue is handed to the agent only when the agent has an agent id [16], meaning the dashboard started it and has a place to carry the conversation on, and the control file [5] is tailed. Whether gates park has no bearing on it: an unattended [21] agent still takes the user's messages. Such an agent drains what has queued and then ends itself; it never stays open waiting for a next message, so a headless agent ends when done. The wait for the next message is held open by the same keepalive as a gate, and a stop [29] closes the queue, which releases it.

### Ctrl+C and SIGTERM

#### Context

**Problem**: letting a termination signal kill this process would leave the coding agent [13]'s own process tree running, orphaned, with nobody to stop it.

#### Business logic

While the agent [1] runs, the first Ctrl+C or SIGTERM prints "■ Interrupt: stopping the session (Ctrl+C again to force-quit)…" and aborts the agent, which drives the driver [8] to stop its coding agent and its whole process group; the agent then ends as stopped. A second signal force-quits the process with exit code 130. The trap is disarmed as soon as the agent settles.

### The journal

#### Context

**Business logic story**: every surface is a projection of the event stream [4]; this process is the one that writes it, and the epilogue reads its own state back from what it saw.

#### Business logic

Every event the agent [1] emits is rendered as a terminal line (`terminal.ts`) and appended to the store, in that order, and the journal remembers what the end of the agent needs: whether the ready for merge [31] signal was seen; the pull request title and description the agent wrote in its final message, the latest wins because the agent may revise them as the work changes; the branch the checkout [15] is on; and whether the agent ended stopped. Two things about the browser preview are held rather than emitted at once: the preview's port waits for the first session event, because the dashboard renders only what follows the last session event and an earlier line would be dropped; and the page the preview is on is emitted as soon as it changes once a session is open and re-emitted after every later session event, so a continuation's fresh slice has a browser row to host the preview.

### The branch is observed, never assumed

#### Context

**Problem**: the agent renames its own branch, in its own shell, through the `branches` skill [32]'s command, invisibly to this process; the dashboard's label, the pull request and the follow-up all need the name the branch has now.

#### Business logic

The checkout [15]'s current branch is read at start, at the end of every turn [26], and once more before the epilogue reads it. Only a change is recorded, as a branch event carrying the branch and, once the agent has named its work, the session name [33]: the branch minus its `agent-` prefix, but not while the branch is still the one the agent id [16] names. Outside a git checkout, or on a detached head, nothing is recorded but the loss is remembered, so the epilogue never publishes a branch the checkout has left.

### What the agent's record learns at start

#### Context

**Problem**: the control file [5] carries instructions, but only an event reaches the agent's record, and the record is the only thing a dashboard tab opened mid-way can read the checkboxes, the ticket and the branch back from.

#### Business logic

Before the first turn [26], three facts are emitted: the armed handoff [11], spelled out as its three stages (push, pull request, merge) derived from the rung so no two surfaces can disagree; the ticket [18] the agent implements, once, because it is a fact about why the agent exists and it lets the Overview mark that ticket as being worked; and the branch the agent actually starts on, read rather than guessed.

### The browser

#### Context

**User story**: the user ticks the browser option and the agent [1] can navigate, read the console and take screenshots in a real browser, while the dashboard shows a live preview of the page the agent is on and lets the user take over at a browser gate [6].

#### Business logic

A browser is launched only for a real, local agent whose driver [8] is Claude Code: one Chrome this process owns, shared with the preview stream that the dashboard renders, so both see the same page (`browser.ts`, `browser-stream.ts`). The preview's port travels as an event rather than a printed line, since a dashboard-started process prints to nobody. When the machine has no Chrome, "note: no Chrome found, so --browser falls back to its own browser (no preview)." is printed and the coding agent [13] launches a browser of its own with no preview. When the agent's location [9] is `actions` or `web`, "note: --browser has no effect with --run-on <location>: the browser tools are wired on this machine, and the session runs elsewhere." is printed and no browser is launched, so no headless browser leaks per agent. The agent's system channel claims browser tools only when the agent really has them: a local Claude Code agent that is not fake. The browser and its preview are closed when the agent ends, whatever the outcome.

### The driver for the location

#### Context

**User story**: the user picks where the agent [1] runs, on this machine, on a GitHub Actions runner, or as a cloud session [34] on their own claude.ai account, and the agent's turns run there.

#### Business logic

The driver [8] is built for the agent's location [9] (`target-driver.ts`):

- `actions` needs the repository's GitHub owner and name, read from the project's origin remote, and a GitHub user token from the environment or, failing that, from the `gh` CLI; never from the repo file [3], which is public. Without a remote the agent ends with "--run-on actions needs a GitHub origin remote on this repo."; without a token, with a message that says a user token with the `repo` and `workflow` scopes is needed, that it must be set in the environment the daemon runs in or obtained with `gh auth login`, and that it must belong to a user, not an App, because the agent workflow refuses a bot-triggered run. Both end the agent as described under giving up before a driver exists. The workflow driven is `framework-agent.yml`.
- `web` hands the task to a cloud session created on the user's own account by the bridge [35]'s extension. To reach the bridge, the process needs the URL of the daemon that spawned it, which the daemon put in the process's environment, and the daemon token [14] read from `~/.the-framework.json`. With both, the cloud driver asks that daemon to have the extension create the session; with either missing, the driver runs without that configuration and the agent fails saying that web agents start from the dashboard (`driver/cloud.ts`). A hands-off [36] agent's cloud session opens on the branch this process pushed, so commits never pushed are not in it.
- Any other location, or none, is `local`: the driver for the chosen coding agent [13] on this machine, with the browser tools folded into Claude Code's configuration when the browser option is on, pointed at the shared Chrome when one was launched.
- A fake agent gets the offline demo driver whatever its location.

### Giving up before a driver exists

#### Context

**Problem**: by the time the location's requirements are checked, the store already records the agent [1] as running; ending the process without saying so would leave a record that says "running" forever and a dashboard showing an agent that never moves.

#### Business logic

A configuration fault found after the store opened but before a driver [8] exists prints the reason, appends a failed end event carrying it, closes the store so the archive [37] is written, disarms the interrupt trap, closes the control file [5] watcher and the browser, and exits with code 2. Persistence is best-effort throughout: a store that cannot write its own failure still lets the process exit.

### The flow the agent opens with

#### Context

**Business logic story**: `agent.ts` runs whichever flow this process picks; the choice, the opening prompt and the shared options are decided here.

#### Business logic

A research agent's opening prompt is the Research preset rendered around the text given; a prompt agent [24] runs its text verbatim, since it may already be an edited preset that must not be re-rendered; a build agent [24] is framed by `agent.ts` and works the backlog loop [12] afterwards. A transparent [23] agent takes the prompt path whatever its kind, and its backlog loop is off; a build continuation stays a build. The agent [1] also receives: the location [9]; whether The Framework owns the checkout [15], true for an agent with an agent id [16] that runs locally, the one case where the daemon's PATH with the `branches` command is present; the driver session [17] id to resume, when continuing; the model when one was chosen; `SYSTEM.md` from the checkout as the project's own instructions; whether the built-in system prompt [27] is left out, which vanilla [22] and transparent both do; whether a browser is really attached; the in-context directories; and the session link to show in the dashboard, which is Claude Code's generic entry point, shown as "Open Claude Code", for a live Claude Code agent and nothing for a Codex or a fake agent, because Codex keeps its sessions locally with nothing equivalent to open.

### How the agent ends

#### Context

**User story**: the user sees in the agent view whether the agent [1] finished, was stopped, or failed, and the daemon reads the same from the exit code.

#### Business logic

When the agent finishes, the terminal shows the success line for its flow: "✓ done." for a build, "✓ prompt session done." for a prompt agent [24], "✓ research done: see the REVIEW-PROBLEMS / TODO files it wrote." for research, and for a hands-off [36] agent "✓ handed off. The session continues where it was sent, and opens its own pull request.", because this machine never saw what was built. Then, in this order: the branch is read once more; the on-before-mergeable follow-up [10] runs; the handoff [11] runs, so whatever the follow-up committed is part of what is published; and the store closes, which writes the archive [37], so both outcomes are in the copy the dashboard's history reads. The exit code is 0. When the agent ends by error: the store closes; if the agent was stopped [29], by Stop, Ctrl+C or a pick marked to stop, as its end event says, "■ Stopped." is printed and the exit code is 0, because a stop is not a failure; otherwise "✗ <session|research|prompt session> failed: <reason>" is printed and the exit code is 1. Either way the interrupt trap is disarmed, the control file [5] watcher closed, and the browser preview and the browser closed.

### The on-before-mergeable follow-up

#### Context

**User story**: with the on-before-mergeable option on, an agent [1] that declares its work complete gets quality follow-ups (refactoring for maintainability and readability, a security review) queued on the agent queue [19] for a later agent, and "I turned it on and nothing happened" has an answer in the agent's events.

#### Business logic

The follow-up [10] runs only when the option was on. When it was, every reason for not running it is emitted as an event: the agent never signaled ready for merge [31]; the agent was stopped [29]; the agent is fake; the agent never named its work, so there is no session name [33] for the prompt to refer to; or this process does not know its own executable. Otherwise the presets are materialized under the checkout [15] first, best-effort, so the queued entries can name their files ("  ! on-before-mergeable: could not materialize presets (<reason>)" when that fails), "◆ on-before-mergeable: queueing quality follow-ups for <session name>" is printed, and one child process runs `the-framework --agent <spec>` on the same checkout with the rendered prompt as a prompt agent [24] whose stdio is the terminal's. That child is vanilla [22], so it skips the built-in system prompt [27]'s session-naming step and stays on the agent's current branch, where its output rides to review with the work; and its spec carries no on-before-mergeable option, so a follow-up never triggers a follow-up of its own. The child is never spawned from a test entry. Its spec is removed when it exits or fails to start. The outcome event is "queued" when the child exited cleanly and "incomplete" otherwise, with "  ! on-before-mergeable queueing did not complete cleanly." on the terminal.

### The handoff

#### Context

**User story**: when the agent [1] ends, its branch is pushed and a pull request opened at the level the checkboxes were left at, the pull request is merged only when the agent itself declared the work done or the user pressed Merge, and the agent's events say exactly what happened, including why nothing did.

**Problem**: publishing work the user cut short is the opposite of what stopping meant; merging unattended on configuration alone would land undeclared work; and a plan agent [20]'s pull request must not close the ticket [18]'s issue, since the work is still undone.

#### Business logic

The handoff [11] runs at the armed level: the resolved configuration's level, moved since by handoff and merge entries on the control file [5]. Nothing is published, and the skip is an event with its reason, when the level does not include a push, when the agent was stopped [29], or when the agent is fake. The Framework commits nothing on the agent's behalf: what is published is what the agent committed, and uncommitted work stays in the checkout [15].

An armed merge must also be authorized. Unless a human pressed Merge, the merge is withheld when the agent never signaled ready for merge [31], or when the agent's own TODO file, `TODO_<session name>.agent.md` in the checkout, still has open entries (the read is `todo-loop.ts`'s); the agent queue [19] never withholds a merge, because it is decoupled from agents. A withheld merge is not a skipped handoff: the push and the pull request go ahead, the pull request opens as a draft for a human, and the event carries the reason, which the terminal words as "the session never signalled ready-for-merge" or "the session's own TODO file still has open entries".

The branch published is the branch as observed now, after any rename by the agent; a checkout on no branch skips with the reason `branch-gone`. The pull request text is what the agent wrote in its final message, when it did: its title and description, so the agent has no reason to open a pull request itself. When the agent implements a ticket [18] that tracks a GitHub issue, the issue reference rides the title as "(fix #N)", read off the ticket on the `agent-data` branch [38], so the squash-merge subject closes the issue; not on a plan agent [20], whose merge must not close it. For a plan agent both the title and the description are also defused (`closing-keywords.ts`), so no closing phrase in its prose closes the issue either. The push, the pull request and the merge themselves, and the further reasons to skip (no commits, no remote, a pull request already open, work already landed, branch already pushed), are `dashboard/agent-handoff.ts`'s; a pull request opens as a draft unless the merge is armed and authorized.

Every outcome is emitted as a handoff event, and a pull request that was opened is recorded as its own event with its number and URL, so every later surface reads the number off the agent. The terminal says "◆ Opened <url>", "◆ Pushed <branch>.", or "✗ could not open the PR: <error>" / "✗ could not push the branch: <error>". The merge half rides on the outcome rather than failing it: "◆ Auto-merge armed: the PR lands when its checks pass." when GitHub's own auto-merge took it, "◆ Merge on green: the daemon merges the PR when its checks pass." when the CI watch [39] took it, "◆ Merged the PR." when it was merged directly, "◆ Merge withheld: <reason>." as above, or "✗ could not merge the PR: <error>", after which the pull request still exists for a human to merge by hand.
