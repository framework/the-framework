Carries out every action the user takes on an agent [1] or a project from the dashboard: stopping an agent, answering a gate [2], sending a live chat [3] message, moving the handoff [4], starting an agent, pushing its branch, opening or merging its pull request, removing a retained checkout [5], deleting an agent, opening a checkout [6] in an editor, putting a ticket or a ticket's plan on the agent queue [7], releasing a ticket's claim [8], answering the question a cloud session [9] is parked on, and showing or restarting the bridge browser [10]. For each action: what is validated, what is refused and why, and what the browser gets back. An action about an agent relayed [11] to a device [12] is carried out on the device that runs it.

## Context

**User story**: on the agent view the user presses Stop, picks an option on a gate's card, types a message in the composer, moves the handoff, and, once the agent has ended, pushes its branch, opens a pull request for it, merges it, removes the checkout it kept, or deletes the agent altogether. On the project home the user starts an agent from the launcher, puts a ticket on the agent queue, or frees a ticket a dead agent still holds. In Settings the user shows or restarts the bridge browser. Each of these is one call from the browser to the daemon, and this is what the call does before it answers.

**Business logic story**: steering a live agent is the reverse of its event stream [13]. Events flow from the agent's process through its events file to the browser; steering flows from the browser through the daemon into the agent's control file [14], which the agent's process tails and acts on: it stops, resolves the gate it is parked on, drains messages between turns [15], or re-arms its handoff. Nothing here talks to the agent's process directly.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[3] live chat: The user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[4] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[5] retained checkout: the checkout of an agent that has ended and is still on disk, kept so the user can inspect what the agent left; nothing removes it on a timer.
[6] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[8] claim: A ticket's lock file naming the holder working it, so two agents never work the same ticket.
[9] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[10] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[11] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[12] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[14] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[15] turn: One prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[16] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[17] pick: The answer to a gate: the option or options chosen, by the user or automatically.
[18] driver session: The coding agent's own conversation for one agent, which the driver can resume by its session id.
[19] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[20] build agent / prompt agent: The two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[21] preset: a canned prompt the user launches from the dashboard; the drain preset is the one that works the agent queue's first open entry.
[22] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[23] the Overview: The dashboard's cross-project page at `/`.
[24] location: Where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[25] vanilla: An agent started without the built-in system prompt but with the signal protocols kept. transparent: an agent started with nothing of The Framework's — the raw coding agent.
[26] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[27] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[28] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[29] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[30] ready for merge: The signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[31] holder: Who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **Steering lands in the agent's own control file** - every stop, pick, message, handoff change and merge authorization is one line appended to the control file of the checkout the agent id resolves to; when the project is unknown here nothing is written.
- **The steering entries and what each validates** - a stop needs nothing; a pick carries the gate's id, the option or options, and who picked; a message is trimmed and an empty one is dropped; a handoff change must name one of the four rungs or it is ignored.
- **Answering the question a cloud session is parked on** - the pick is queued for the bridge's extension to type into the session, accepted only as labels of the question actually parked, and can be withdrawn until it is collected.
- **Starting an agent** - a build or prompt agent needs a non-empty prompt, a research agent may have none; a hand-fired drain is tagged with the ticket it is about to work; the daemon's own start decides the rest and reports busy when it must.
- **Removing a retained checkout** - refused while the agent is still going, for an unsafe id, for a checkout that is not there, and whenever the work is not yet on the remote; a clean checkout is pushed first and then removed.
- **Deleting an agent** - refused while the agent is still going; the checkout goes with whatever it holds, the agent's records go, and its branch stays.
- **Opening a checkout in the file manager or an editor** - a local command against the agent's own checkout, or the project's; the editor is the one the preferences name, else the environment's, else VS Code.
- **Pushing the agent's branch** - the branch as the agent committed it is pushed to `origin`, nothing committed on its behalf; "unknown session" when the agent is not known.
- **Opening a pull request** - the agent's existing pull request is returned when it has one; a gone branch or an agent that committed nothing is refused; otherwise the branch is pushed if needed and a pull request opened ready for review and recorded on the agent's run.
- **Merging** - a live agent gets a merge authorization in its control file and merges at its own end; an ended agent's open pull request is merged directly, and "already merged" is an answer, not an action.
- **Putting a ticket on the agent queue** - the entry lands in the priority section the ticket's own priority earns, as a link back to the ticket, on the `agent-data` branch.
- **Putting a ticket's plan on the agent queue** - the plan sentence for that ticket lands by the same priority rule, deliberately not as a ticket link.
- **Releasing a ticket's claim** - only a bare ticket filename is accepted; the lock is removed as one committed, pushed change, and "no lock" is an honest answer.
- **Controlling the bridge browser** - show, hide or restart; anything else is refused.
- **Actions about a relayed agent go to the device** - steering, push, open pull request and merge are forwarded to the device that runs the agent; start, remove, delete and everything local-only never are.

## Business logic

### Steering lands in the agent's own control file

#### Context

**Problem**: an agent tails the control file [14] inside its own checkout [6]. An instruction written at the project's root reaches nothing, and the Stop button, a pick and a message would each silently do nothing. So every steering call carries the agent id [16] and writes where that agent listens.

#### Business logic

A stop, a pick, a message, a handoff change and a merge authorization are each appended as one line to the control file of the checkout the agent id resolves to: the agent's own checkout while it exists, else the project's root, which is right for an agent that has no checkout of its own (the resolution is `context.ts`'s). Without an agent id the project's root is addressed. When the project id names no project on this machine, nothing is written at all. The call answers as soon as the line is written; whether the agent acts on it is the agent's affair, and a line written to an agent that has just ended lands unread.

### The steering entries and what each validates

#### Context

See `## Context`.

#### Business logic

- **Stop**: a stop entry, with nothing to validate. The agent's process aborts what it is doing.
- **A pick** [17]: the gate's [2] id, the pick (one option id for a single choice, or the chosen subset for a multiple choice, which may be empty), and who picked. Who picked is the user unless the caller says otherwise; the record can also say the pick was made by the dashboard's autopilot countdown or automatically, for an agent nobody is watching.
- **A message** [3]: the text is trimmed, and an empty or whitespace-only message is dropped without writing anything. The agent drains messages between turns [15], each one continuing the same driver session [18].
- **A handoff change** [4]: the level must be one of the four rungs, `local`, `push`, `pr` or `merge`; anything else is ignored and nothing is written. One rung travels, never a set of stages: a surface offering the stages as separate boxes resolves them to a rung on its own side, where an impossible combination (a pull request without a push) settles down to the rung actually asked for instead of being repaired upward into a push nobody ticked. The change is steering rather than a setting because it is about this one agent, and the agent echoes what it applied back as an event, so surfaces read the agent's own record rather than local state a reload would lose.

### Answering the question a cloud session is parked on

#### Context

**Problem**: a `web` agent's work runs in a cloud session [9]; there is no local process to steer, and the agent itself is already over by the time the session asks anything. The question reaches the dashboard through the Claude web bridge [10], and the answer goes back the same way: queued for the extension, which types it into the session's composer and submits.

#### Business logic

The pick is not a control-file write: it goes to the bridge's store of parked questions, keyed by the cloud session's id. The id must look like a cloud session id (`session_` followed by up to 128 letters or digits), else the answer is refused as "unknown session"; the labels must be a list of non-blank strings, else "answer labels are required". The store then accepts only labels of the question that session is actually parked on, each at most once, and exactly one of them unless the question allows several; a refusal comes back with the store's reason ("that session has no parked question", "every label must be one of the question options", "pick exactly one option"). The text typed into the session is composed by the daemon from the chosen labels (the rules are `dashboard/bridge-store.ts`'s), so nothing arbitrary is ever put in front of another product's agent. A queued answer can be withdrawn; that is a no-op once the extension has delivered it or a Driver tab has collected it, and an id that is not a cloud session id is ignored. These two calls are never relayed [11]: the bridge lives on the daemon the extension talks to.

### Starting an agent

#### Context

**User story**: the user fills the launcher and presses Start. The launcher's options travel with the start, the daemon spawns the agent, and the browser selects the agent it just started.

**Problem**: the daemon's start is the one place that may spawn an agent, because it keeps the guard that refuses to start the same work twice; every start from the dashboard has to go through it. And a drain [22] fired by hand is the same work the daemon's own drain does, so it must say the same thing about itself: which ticket it is about to implement, so the Overview [23] shows that ticket as being worked rather than a lane staying empty.

#### Business logic

The kind is a build agent [20] by default, a prompt agent, or a research agent. A build or a prompt agent needs a non-empty prompt after trimming ("a non-empty prompt is required"); a research agent may be started with none, its subject defaulting on the daemon's side. The options travel through untouched to the daemon's start, where their meaning is fixed (`dashboard/types.ts`): vanilla [25] or transparent, in-context directories, the on-before-mergeable follow-ups, a real browser for the agent, the handoff [4] level, the model, the driver, the location [24], unattended [19], a pre-minted agent id, the ticket it implements and whether it only plans it, the driver session [18] to resume, the agent to continue, and the device [12] to run on. The device's URL and token are memory-only relay configuration: never persisted, never a CLI flag, and stripped before the device starts the agent so it never relays onward.

One thing is resolved here rather than trusted from the browser: the ticket. When the caller names a ticket it is kept. Otherwise, when the prompt is exactly the drain preset's [21] prompt, the ticket the agent queue's [7] first open entry links to becomes the agent's ticket; any other prompt, however busy the queue, gets none, since naming the queue's next entry would show a ticket as being implemented by an agent doing something else. A queue that cannot be read yields no ticket. The daemon's start answers: started, with the agent id when the agent got its own checkout; busy, when the same work is already active; or an error saying why.

### Removing a retained checkout

#### Context

**User story**: an agent that failed or was stopped keeps its checkout so the user can look at what it was holding. Nothing removes such a checkout on a timer; the user removes it from the agent view, and expects never to lose work that exists nowhere else.

**Problem**: the daemon's removal rule (`MEMORY.md`) is that only what has been pushed to the remote may be removed, so every removal is recoverable from the remote. The dashboard's Remove and the sweep that reclaims checkouts are one implementation (`worktrees.ts`), so the button gets the same checks.

#### Business logic

The project must be known here ("this project has no local path on this server"). The removal then runs under the agent's lock, serialized with the daemon's own teardown of the same checkout, so a Remove clicked the moment an agent ends does not race the teardown's archive-commit-remove of the same directory: whichever runs second finds the state the first one left. The checks and the removal are the shared implementation's: an id unsafe for a path is refused before anything is touched ("invalid session id: …"); an agent with no checkout on disk is reported rather than claimed removed ("no worktree for session …"); an agent still going is refused ("that session is still going; stop it before removing its worktree"); a checkout holding uncommitted work is kept and the edit stays in it, nothing is committed on the agent's behalf ("session … has uncommitted work; its worktree was kept"); a branch the remote does not have is pushed first, and if it cannot be the checkout is kept ("… is not on the remote (…); its worktree was kept"); an agent whose handoff [4] was set to publish nothing keeps its checkout, since pushing it to make removal possible would publish the very branch the handoff declined to ("session … was set to publish nothing (handoff: local); its worktree was kept"); a record that exists but cannot be read keeps the checkout, because it cannot tell a publish-nothing agent from any other. When the checks pass the checkout is removed, its committed work surviving on its branch and on the remote.

### Deleting an agent

#### Context

**User story**: the user removes an agent from the dashboard for good, records and all. This is the one action that destroys history, which is why the surface asking for it confirms first.

#### Business logic

Same project check and same lock as removing a checkout. The checks and what is left behind are the shared implementation's (`worktrees.ts`): an unsafe id is refused ("invalid session id: …"); an agent still going is refused ("that session is still going; stop it before deleting it"). The checkout, if one is on disk, is removed by force, and any uncommitted work goes with it: throwing the work away is what a delete is for. The agent's records then go, as one committed and pushed change when they are the agent's run [26] on the `agent-data` branch [27], or by removing the files when they are the transient archive [28]; a half-deleted agent whose checkout was already gone still finishes cleanly. What stays is git's: the agent's branch (`agent-<id>`, or the name the agent gave it) and its commits, because deleting a branch that may carry merged work or an open pull request is not something a dashboard action does silently.

### Opening a checkout in the file manager or an editor

#### Context

**User story**: the user opens the project, or the checkout a particular agent is working in, in the OS file manager or in their editor, to look at what the agent is doing.

#### Business logic

Localhost-only by nature: the daemon spawns a local command against a registered path, never a path from the browser. When the project is unknown here the answer is "this project has no local path on this server". With an agent id the agent's own checkout is opened (the project's root when the agent has none); without one, the project's checkout. For the editor, the launcher used is the editor the preferences name, else `$FRAMEWORK_EDITOR`, else `code` (the fallback is `dashboard/open-in-app.ts`'s); a preferences read that fails counts as no preference. A launcher that is not installed comes back as a failure naming it ("… was not found on PATH"); any other failure to launch comes back as its message.

### Pushing the agent's branch

#### Context

**User story**: an agent has ended with its work on its branch; the user presses the push action to put that branch on the shared remote.

**Problem**: pushing publishes the agent's work under the user's name to a remote other people see, so it is the user's call rather than something the agent does on its way out.

#### Business logic

The target is the agent the id names, looked up in the project's records; an unknown project, an unsafe id or an unknown agent answers "unknown session". The branch pushed is the one the agent recorded (it renames its own branch after its session name [29]), else the branch it was born on, `agent-<id>`. It is pushed to `origin` with its upstream set, exactly as the agent committed it: nothing is committed on the agent's behalf first. The push runs under the agent's lock, because the daemon's teardown pushes the very same branch and two pushes racing to create the same reference make one of them fail. The answer is success, or git's own error line.

### Opening a pull request

#### Context

**User story**: an agent has ended; the user asks for a pull request for its work, and gets one without typing anything: the title and body come from what the agent already recorded.

#### Business logic

Same target rule as pushing ("unknown session"). The decision of whether and how to open is `dashboard/agent-handoff.ts`'s: the agent's existing pull request is returned as the answer when it has one, unless the agent demonstrably kept committing after that pull request merged or closed; a branch that no longer exists is refused ("branch … no longer exists"); an agent that changed nothing is refused rather than given an empty pull request ("this session produced no commits to open a PR for"); otherwise the branch is pushed when the remote lacks it and a pull request is opened ready for review, not as a draft, because a pull request a human asked for by name is asking for review. Its title is the session name [29], else the first line of what the user asked for, else the agent id; its body is what was asked and which agent did it. The call runs under the agent's lock for the same reason as the push. When a pull request was opened, its number and URL are recorded on the agent's run [26]: the agent's process is gone by then, so no event can carry the fact, and every surface reads it from the same place rather than re-deriving it from branch names.

### Merging

#### Context

**User story**: one Merge action, in either of the two states an agent can be in. While the agent is still going, the user pre-authorizes the merge; once it has ended with a pull request open, the user lands it. This is the answer to an agent that never emitted ready for merge [30] and left a draft behind.

#### Business logic

Same target rule ("unknown session"). For an agent that is still running, a merge authorization is appended to its control file [14] and the call answers success at once: the agent arms the full handoff [4] ladder, records that a human authorized the merge (so the merge gate honors that instead of demanding the agent's ready-for-merge signal), and merges at its own natural end. For an agent that has ended, its pull request is merged directly (`dashboard/agent-handoff.ts`), a draft being marked ready on the way: refused when the agent has no pull request ("this session has no pull request to merge") or when it is no longer open ("this session's PR is already merged", or closed), since "already merged" is an answer, not an action; and the answer carries the pull request's number and URL. If the agent ends between the status check and the write, the authorization lands unread; the ended view then offers the direct merge, so the next press still gets there.

### Putting a ticket on the agent queue

#### Context

**User story**: from a ticket, the user queues it so the next drain [22] works it, without spending an agent turn on appending one line.

**Problem**: the drain works the agent queue [7] front to back, so an entry appended at the end would wait behind everything; and an entry carrying only a title loses the ticket it came from the moment it is queued.

#### Business logic

The entry text is trimmed and must not be empty ("a ticket is required"); the project must be known ("no such project"). When the entry comes from a ticket, it is written as a markdown link to `tickets/<file>` so the agent draining it has the ticket to open, and it is placed in the `## Priority N` section the ticket's own priority earns: the ticket's priority as written when it is a whole number from 0 to 10, and 5 for anything else (unmarked, a word, out of range), so a typo is not hidden by a guess. Without a ticket the entry is appended at the end. The queue is the project's `TODO_AGENTS.md` on the `agent-data` branch [27], written as one committed and pushed change; a write that cannot land is "the queue could not be written", and a success names the file written.

### Putting a ticket's plan on the agent queue

#### Context

**User story**: the user asks for a ticket's plan to be written by the next drain, the way the plan-tickets preset would ask for it.

#### Business logic

The filename must be a bare ticket filename ("not a ticket filename"); the project must be known ("no such project"). The entry is the one plan sentence used everywhere plan work is asked for, `Create tickets/<stem>.plan.md`, placed by the ticket's priority under the same rule as a queued ticket. It is deliberately not a link to the ticket: a leading ticket link is what every reader takes as "queued for implementation", and a plan ask must not read as that.

### Releasing a ticket's claim

#### Context

**User story**: an agent died holding a ticket's claim [8], and no timer frees claims; the user frees it by hand from the ticket.

**Problem**: the filename comes from the browser. A path segment could address another directory, and a sibling name could delete a plan instead of a lock, so the name is checked before any project is even resolved. And a release only this machine could see would leave the ticket claimed everywhere the claim matters, so it must land on the `agent-data` branch [27].

#### Business logic

Only a bare ticket filename is accepted: a `.md` name with no path separators, not starting with a dot, and not a ticket's own `.plan.md` or `.lock.md` sibling; anything else is "not a ticket filename". An unknown project is "no such project". The lock file is removed as one committed, pushed change on the `agent-data` branch, whoever the holder [31] was. A ticket that holds no claim answers "this ticket holds no lock", and a release that could not be committed answers "the release could not be committed" and changes nothing.

### Controlling the bridge browser

#### Context

**User story**: in Settings the user shows the daemon's bridge browser [10] window for the one-time sign-in to claude.ai, hides it again, or restarts it.

#### Business logic

The action must be one of show, hide or restart; anything else is refused ("unknown action"). A browser that is not running ignores show and hide (the behavior is `bridge-browser.ts`'s). The call answers success once the action is handed over.

### Actions about a relayed agent go to the device

#### Context

**Problem**: an agent relayed [11] to a device [12] has no checkout on this machine; its control file, its branch and its pull request all live on the device. The daemon holds the device's token, so it forwards the action there and the device runs it against its own checkout (the forwarding is `relay-agent.ts`'s, the device side `relay-dispatch.ts`'s).

#### Business logic

Stop, a pick, a message, a handoff change, the push, opening a pull request and the merge are forwarded when the agent id names an agent this daemon relays; for an ordinary local agent they run here unchanged. When the device cannot be reached, or refuses, the steering calls answer nothing, exactly as they do after a successful write, so a stop or a pick sent to an unreachable device is lost silently; the push, the pull request and the merge answer "could not reach the device". Starting an agent, removing a checkout, deleting an agent, opening a checkout in an app, the queue and claim actions and the bridge actions are never forwarded: a device runs its own guarded start, and destroying a device's history or checkouts is not something a relaying daemon may do.
