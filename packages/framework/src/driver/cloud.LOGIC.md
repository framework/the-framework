Implements the `claude-web` driver [1]: the driver behind the `web` location [2], whose one real turn [3] hands the whole task to a cloud session [4] on claude.ai. Before the task leaves this machine the driver pushes the agent's [5] cloud anchor [6] to the project's GitHub `origin`, then asks the daemon that spawned the agent to have the Claude web bridge [7]'s extension create the session in the user's own signed-in browser, and finally reports the session link. Nothing is ever read back from the session: the work continues on claude.ai, and every later turn of the same agent only repeats where the work went.

## Context

**User story**: the user starts an agent with its location set to `web`. Instead of a coding agent [8] working on this machine, a Claude Code cloud session opens on claude.ai, bound to the project's GitHub repository, with the task as its first message. The agent view [9] shows a "cloud" link to that session; the session pushes its own branch and opens its own pull request; the user can pull the session into a terminal with `claude --teleport <session id>`. The account, the login and the quota [10] spent are the user's own, exactly as with a local agent.

**Problem**: a cloud session exposes no way to read it back: no status, no transcript, no output, only its URL. So a web agent is hands-off [11]: its first prompt is the whole agent, and following the work happens on claude.ai, through the bridge, or by teleporting the session. And only a session created through claude.ai's own repository picker, in the user's browser, is bound to the repository so that it can push and open a pull request; that is why the extension creates the session rather than the coding agent's own command line.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognizes that branch as the agent's (cloud work adoption).
[7] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents.
[8] coding agent: the CLI doing the actual work: Claude Code or Codex.
[9] agent view: one agent's page in the dashboard.
[10] quota: the account's subscription allowance, as the coding agent reports it.
[11] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[12] registry: `~/.the-framework.json`, the file that lists the projects and keeps the user's preferences.
[13] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[14] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`).
[15] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. "Session id" and "session link" are its id and URL.
[16] sweep: a background job the daemon runs on its clock.
[17] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[18] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[19] launcher: the Start form on a project's own page in the dashboard.

## Business logic — TL;DR

- **What a web agent needs before it leaves** - a daemon that spawned it, a GitHub `origin`, the bridge switched on and an extension that has spoken to the daemon recently; whichever is missing names itself in the failure.
- **The prompt the cloud session receives** - the task first, then everything The Framework injects behind a labeled rule, so a person opening the session on claude.ai reads the task before the instructions.
- **The cloud anchor is pushed before the task leaves** - an empty commit on top of the checkout's HEAD, pushed to `origin` under the driver's own session id; a push that fails fails the agent before the extension is asked anything.
- **The session is created by the extension through the daemon** - the driver queues one request (repository, pushed ref, prompt, model) with its daemon, waits for the extension's word, and gives up after two minutes.
- **The model travels with the request** - the model the agent was started with is picked in claude.ai's model menu; an agent started without one leaves the page's default.
- **One agent, one cloud session** - the first turn hands off; every later turn reports that the work is already in the cloud and spends nothing.
- **What the turn reports** - the "cloud" link the agent view opens, a final text with the session link and the `claude --teleport` line, the session's id, and the anchor by which the daemon recognizes the session's branch later.
- **Nothing is read back** - no file of the cloud workspace and no quota reading of its own; a `web` agent ends with its first prompt.
- **Stopping, timing out and disposal** - a stop, or an agent already aborted, ends the turn before anything is pushed or asked; the wait is bounded; disposing the session aborts any wait and refuses further turns.

## Business logic

### What a web agent needs before it leaves

#### Context

**Problem**: the cloud session is created on a repository the extension picks on claude.ai, in the user's browser, by way of the daemon; an agent missing any link in that chain cannot hand off, and a silent hang would be worse than a refusal that says what to fix.

#### Business logic

Checked in this order at the agent's [5] first turn [3], each failure ending the agent with the message quoted:

- **A daemon that spawned the agent.** The daemon's URL travels in the agent process's environment and the daemon's token comes from the registry [12] (the rule in `cli.ts`); without both, the driver [1] has nobody to ask: "[framework] claude-web: this run was not started by a daemon, so nothing can hand it to the browser extension — start web runs from the dashboard."
- **A GitHub remote.** The checkout's [13] `origin` must be a github.com remote (the forms `dashboard/github.ts` accepts), because the repository picker on claude.ai lists repositories by `owner/repo`: "[framework] claude-web: no GitHub remote here — the cloud session is created on a repository the browser extension picks on claude.ai, so the project needs an `origin` on GitHub." Nothing is pushed and nothing is asked of the extension.
- **The bridge switched on.** When the Claude web bridge [7] is off, the daemon answers the session request with "not found": "[framework] claude-web: the browser bridge is off — turn it on in Settings so the extension can create the cloud session."
- **An extension around.** The daemon refuses the request when no extension has spoken to it recently: "[framework] claude-web: no browser extension has spoken to this daemon recently — install or reload The Framework extension on a claude.ai tab (and keep the browser bridge on in Settings), then start the run again."

The push of the cloud anchor [6] (below) sits between the remote check and the request, so a checkout that cannot push fails before the extension is involved.

### The prompt the cloud session receives

#### Context

**Problem**: on claude.ai the first message of the session is read by a human, and the task is what they open the session to find; the standing instructions The Framework adds are long and would bury it.

#### Business logic

The message handed to the cloud session [4] is the task and then, only when something is injected, a rule of `=` signs (`===============================`) set off by blank lines, the header "Instructions from The Framework, the tool that started this session:", and the injected blocks, each separated by the same rule. Two blocks can be injected: the agent's [5] standing framing, which is the built-in system prompt [14] as the agent was started with it, and the extra framing of this one turn [3]. An empty block is dropped. With nothing injected the message is the bare task, with no rule and no header.

### The cloud anchor is pushed before the task leaves

#### Context

**Problem**: the cloud session opens on a named ref of `origin`, so the repository picker's branch list must offer this agent's starting point. The session then works on a `claude/*` branch of its own naming, which this machine can only recognize later by ancestry: a pushed ref that is HEAD itself could be any branch a person made, while an empty commit unique to the agent is recognizably the agent's.

#### Business logic

- The driver [1] mints an empty commit on top of the checkout's [13] HEAD (the same tree, HEAD as its parent) with the message `[The Framework] web hand-off <driver session id>`, and pushes it to `origin` as a branch named exactly as the driver's own id for the driver session [15]. That id is `cloud-<n>-<tag>`: a per-process counter and a random eight-character tag, so two agents [5] never collide even after a restarted process resets the counter. The name is slash-free on purpose: a ref with a `/` in its name never resolves as a cloud session's [4] revision.
- Minting and pushing are one step, and either failing fails the agent: "[framework] claude-web: could not push the hand-off ref <id> to origin (<git's reason>) — the cloud session opens on that ref, so the project needs a pushable GitHub remote." Nothing is then asked of the extension.
- The anchor's commit id is remembered and reported with the turn's [3] result (see "What the turn reports"), which is how it reaches the agent's record as its cloud anchor [6]. The `cloud-*` ref itself is scratch: the driver never deletes it, because session creation only signals "created", not "cloned", and a ref deleted in that window strands the session; the cloud scratch sweep [16] in `cloud-scratch-refs.ts` removes it once it is provably dead.

### The session is created by the extension through the daemon

#### Context

See `## Context`.

#### Business logic

- The driver [1] queues one request with the daemon that spawned the agent [5], presenting the daemon's token: the repository as `owner/repo`, the pushed ref (the driver's session id) as the branch to open on, the whole prompt of the section above, and the model when the agent was started with one. The daemon answers "accepted" with a request id; "conflict" when no extension is around and "not found" when the Claude web bridge [7] is off (both messages quoted in the first section); any other refusal ends the agent with "[framework] claude-web: the daemon refused the session request (<status>): <the daemon's reason, at most 300 characters>".
- Once the request is queued, the agent's event stream [17] gets a notice: "[framework] claude-web: asked the browser extension to create the cloud session on <owner/repo> at <ref> on <model> (request <id>)." (the "on <model>" part only when a model was set).
- The driver then asks the daemon where the request stands every 2 seconds. The extension claims the request, drives claude.ai's repository picker and reports back (the queue's own rules, including the claim that stops two tabs from creating two sessions, are in `dashboard/bridge-starts.ts`). A request reported created, with the cloud session's [4] id and URL, completes the turn [3]. A request reported failed ends the agent with "[framework] claude-web: the browser extension could not create the session — <the extension's note>." (no note, no dash). A request the daemon no longer knows ends the agent with "[framework] claude-web: lost the session request <id> (<status>)".
- The whole turn, from its start to the session's creation, is bounded by 120 seconds: past that the agent ends with "[framework] claude-web: gave up waiting for the browser extension to create the session." A stop [18] during the wait ends it too, but is reported as a stop (last section).

### The model travels with the request

#### Context

**User story**: the user picks a model in Settings or the launcher [19]; a web agent honors it as a local one does, instead of dropping it on claude.ai's default.

#### Business logic

The model the agent [5] was started with is sent with the session request, and the extension picks it in claude.ai's model menu before starting the session. When the agent was started without a model, nothing about the model is sent and the cloud session [4] opens on the page's default. The model also appears in the "asked the browser extension" notice.

### One agent, one cloud session

#### Context

**Problem**: the loop driving an agent [5] may come back round and prompt again; reading the driver's [1] own "handed off" summary as fresh progress would open a second cloud session [4] on the user's account each time.

#### Business logic

The hand-off happens at most once per driver session [15]. Once a cloud session exists, every later turn [3] emits its start event and returns at once with a report that the work is already there: "This run was already handed off to Claude Code on the web, so there is nothing further to do here." and "The work continues in that cloud session, which opens its own pull request.", followed by the same "View the session" and "Continue it here" lines as the first report. No request is queued, nothing is pushed, and the "cloud" link event is not repeated, so the agent view [9] shows one session.

### What the turn reports

#### Context

**User story**: on the agent view [9] the user clicks through to the cloud session, and reads in the agent's final text how to continue the session from a terminal.

#### Business logic

The first hand-off emits into the agent's [5] event stream [17] an action labeled `cloud <session URL>` (the counterpart of the Actions driver's `run <url>`), which the agent view links through. The turn's [3] final text is "Handed off to Claude Code on the web.", a blank line, "View the session: <URL>" and "Continue it here: claude --teleport <session id>". The turn's result event carries that text, the cloud session's [4] id as the driver session [15] id (the handle `claude --teleport` and `claude --resume` take), the session's real URL as the session link, and the anchor's commit id; the agent process records the link on the agent and the anchor as the agent's cloud anchor [6] (the fold in `agent-telemetry.ts`, the record in `store/agent-store.ts`), and the cloud work adoption sweep [16] in `cloud-work.ts` later matches `origin`'s `claude/*` branches against the anchor.

### Nothing is read back

#### Context

See `## Context`.

#### Business logic

The driver [1] offers no way to read a file of the workspace: the workspace lives in a cloud VM this machine never sees, and the branch the cloud session [4] pushes is not known until it pushes one. It offers no quota [10] reading of its own: a cloud session draws on the same subscription the local driver already reports. The `web` location [2] is the one hands-off [11] location (`local` and `actions` agents are followed like local ones), so the agent [5] ends with its first turn [3] (the rule in `agent-location.ts`).

### Stopping, timing out and disposal

#### Context

See `## Context`.

#### Business logic

- A turn [3] on an agent [5] whose stop [18] was already requested, or whose turn was already aborted, fails at once with "[framework] claude-web prompt aborted", before anything is pushed or asked.
- A stop arriving during the wait ends the wait and fails the turn with the same "[framework] claude-web prompt aborted", whatever step it interrupted.
- A wait past 120 seconds fails with the "gave up waiting" message above.
- Disposing the driver session [15] aborts every in-flight wait, and a disposed session refuses further turns with "[framework] claude-web session disposed".
