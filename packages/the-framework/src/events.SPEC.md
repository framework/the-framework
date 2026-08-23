The vocabulary of the event log: every kind of thing an agent can report, and the rules attached to each. Every surface — the dashboard, the terminal, an agent's archive — is a projection of this one stream, so anything a surface can show has to be an event here first.

## Business logic — TL;DR

- **One timeline out of three sources** - The Framework's own narration, the wrapped coding-agent CLI's progress forwarded verbatim, and framework-level status all arrive as the same kind of event, so a reader follows one chronological story instead of three.
- **Facts about the agent travel as events** - the branch, the ticket being implemented, the pull request number, the chosen session name, the model, the cloud session's hand-off anchor: each is announced the moment it becomes true, because only an event reaches the agent's `agent.json`, and that record is what a surface opened later reads instead of guessing.
- **A gate is an event, and so is its answer** - a choice carries its question, its options, and its recommended default; the resolution records who answered it.
- **Every decline is reported, never silent** - the end-of-agent handoff, the auto-merge, and the post-merge quality step each report why they did nothing, so "I ticked the box and nothing happened" always has an answer in the log.
- **Errors are history, not status** - an error event says what went wrong at that point and stays in the log; nothing clears it, because nothing can un-happen it.
- **The browser preview never puts pixels in the log** - only a port and a page URL travel; frames never enter the event log, because someone will type a password into that pane.

## Business logic

### One timeline out of three sources

#### User story

The user watches an agent work and wants a single story: what the framework did, what the coding agent itself is doing, and where the work stands.

#### Business logic

Three sources feed one stream. The Framework narrates its own steps (framework-level log lines and status). The wrapped coding-agent CLI's own progress is forwarded verbatim as driver events and is never gated on — The Framework reports it but never makes decisions from individual tool calls. Framework-level status (the agent settled, usage so far, the agent ended) completes the picture.

An agent opens by announcing which driver is wrapped, the workspace it is working in, whether this is the fake driver, a link into the wrapped CLI's session when one can be built, and the model the driver was started with. Once the wrapped CLI reports its real session id — which is not known at start — that id and its refreshed link are announced, and re-announced whenever the id changes, since each Claude Code prompt opens a fresh session. The full system prompt sent to the coding agent is published once as its own event, purely so the user can read the prompt that is otherwise hidden; nothing gates on it. What the agent was asked to do is published once as the agent opens.

#### Rationale

The model is recorded per opening rather than once for the agent's lifetime: a continued agent announces itself again and may run a different model, so readers take the most recent value rather than the first.

### Facts about the agent travel as events

#### User story

A user opens the dashboard in the middle of an agent's work, or comes back to a finished agent days later. Everything the surface shows — which branch, which ticket, which PR, what the agent named itself — must be readable from the record rather than re-derived.

#### Business logic

Each of these becomes an event the moment it becomes true, and is folded into the agent's `agent.json`:

- The **session name** the agent invents for its task, re-announced on a rename.
- The **branch** the agent's work is on, observed off the checkout: announced at start with the branch the agent actually begins on, and again when The Framework renames the agent branch after the agent picks its session name.
- The **ticket** the agent was started to implement, as a repo-relative `tickets/<file>.md` path — only when The Framework itself chose the ticket, which today means an agent drained from the agent queue. Its absence means nobody knows what this agent is implementing, which is the case for every hand-written prompt.
- The **pull request** the work is on, the moment one is opened for it.
- The **hand-off anchor** a `web`-target agent pushed for its cloud session to start from: an empty commit unique to this agent, so that the `claude/*` branch the cloud session actually picks is recognisable later by plain ancestry. The daemon's adoption pass matches it against the remote's `claude/*` heads.
- What the end-of-agent handoff is **armed** to do — push, open a PR, merge — announced at start and again every time the dashboard's checkboxes change it.

**Ready for merge** is its own event: the agent declares the work complete and ready for human review, which flips its dashboard status from building to ready and is what the post-merge quality prompts hang off. An agent can also ask The Framework to open its pull request for it, supplying a title, a description, or only one of the two; the end-of-agent handoff uses the most recent such request.

#### Rationale

The control channel can carry an instruction to a running agent, but only an event reaches `agent.json` — and `agent.json` is the only thing a dashboard tab opened later can read. That is why the armed handoff, the branch, the ticket and the PR number are events rather than arguments held in memory: before they were, each surface re-resolved the branch by trying up to three naming schemes and filtering pull requests by a timestamp heuristic, all standing in for one number nobody had written down. The armed handoff's merge half is included for the same reason it is displayed at all: without it, a merge-armed agent could advertise "open a draft PR" and then merge to the default branch. When that half is missing from an older record it reads as off, the conservative display.

### A gate is an event, and so is its answer

#### User story

An agent reaches a decision only the user should make — approve this plan, pick between these designs, choose which of these follow-ups to queue — and parks until it is answered. When nobody is around, autopilot answers for the user.

#### Business logic

A gate carries the question shown above the options, its own identity so the pick posts back against it, and at least one option. Each option has a stable id, the label the user sees, and optionally a one-line detail underneath (for example, why an alternative lost).

A gate is either single-select or multi-select. A single-select names one recommended option: that is the pre-selected default, the one autopilot auto-accepts after its delay (ten seconds unless the gate says otherwise), and the one a headless agent accepts immediately. A multi-select is a checklist where every option carries whether it starts checked, and the answer is the selected subset of options rather than one of them. A gate may also name a markdown file it is asking about, which the dashboard renders beside the question.

The resolution is published as its own event, carrying what was picked and who picked it: the user, autopilot's countdown, or a headless auto-accept.

### Every decline is reported, never silent

#### User story

The user ticks "open a PR", or "merge when done", or the post-merge quality step — and then nothing appears to happen. The log must say why.

#### Business logic

**The end-of-agent handoff** publishes what it did: pushed and/or opened a pull request (with the PR's number and URL), declined, or failed — and failure names which half failed, the push or the PR. Every decline is a normal ending rather than a fault, and names its reason: nothing was armed; the branch no longer exists; the agent committed nothing the base branch does not already have; the agent's pending work could not be committed, so publishing would hand off a branch missing its last edits (the work stays in the checkout and the commit is retried at teardown); the repository has no remote; the branch already has an open pull request, since opening a second one is the one mistake this must never make; everything the agent did already reached the human, because the branch's pull request is merged or closed *and* its head is still the branch tip; the branch is already on the remote at this commit and only a push was asked for; the agent was stopped rather than finished; or this was the fake driver, with nothing real to publish.

**The auto-merge**, when armed, reports its outcome. The preferred one is arming GitHub's own auto-merge, so the pull request lands only once its checks pass. Where the repository does not allow auto-merge, the pull request is merged directly. Where GitHub cannot arm the merge and the checks have not passed yet, the pull request is handed to the daemon's CI watch instead, which merges it once the checks go green. A failed merge never fails the handoff: the pull request exists either way and a human can still merge it. A withheld merge means the merge was armed but not authorised and the pull request was opened as a draft for a human instead — either because the agent never declared the work ready for merge, or because the agent's own `TODO_<session name>.agent.md` still has open entries. The agent queue never withholds a merge; it is independent of any one agent.

**The post-merge quality step**, when it was switched on, reports whether it queued its follow-ups, queued them without finishing cleanly, or declined — because the agent never declared ready for merge, because the agent was stopped rather than finished, because this was the fake driver with no coding agent to hand a follow-up prompt to, because the agent never picked a session name that every line of the follow-up prompt refers to, or because the framework's own binary path was unavailable to spawn the follow-up with. An agent that never asked for the step stays quiet.

#### Rationale

These outcomes are events rather than console output because the surfaces that need them cannot read console output: an agent started from the dashboard has no terminal anyone is watching, so an outcome that is not an event is an outcome nobody learns.

### Errors are history, not status

#### User story

Something goes wrong that only the user can fix — a missing credential, a repository the agent cannot push to. It must be impossible to miss in a wall of prose.

#### Business logic

The agent reports such a failure as its own error event: a headline, plus optional detail underneath. It records what happened at that point in the agent's timeline and stays there permanently — nothing clears it, because nothing can un-happen it. This is distinct from project-level errors found between agents, which describe conditions that are true right now and clear themselves once the condition is gone.

### Previews and the browser

#### User story

The user wants to look at the app the agent built, and to watch (and take over) the browser the agent is driving when it hits a login wall or a captcha.

#### Business logic

When a serve command is configured, a successful agent boots the built app and publishes its URL and the command that started it; the app is kept running so the user can open the preview, and is torn down when the daemon stops.

The agent's browser preview publishes only the loopback port it listens on. The dashboard never talks to that port directly: it reaches the stream through the daemon, which proxies to it, so the agent's browser stays unreachable from the network. The page the browser is currently showing is published separately as a URL — for the first real page and again on every navigation — so the transcript can host the live preview where it happened rather than only in the side rail; it is re-published after each opening so the row survives the dashboard's most-recent-opening slice, and repeats of the same URL are folded in place instead of stacking.

Frames never enter the event log, in either case: someone will type a password into that pane.

### Views, settling, usage, and the end

#### User story

The agent wants to show the user a document without blocking on it; the user wants to know whether the agent is working or waiting for them, what it has spent, and how it ended.

#### Business logic

An agent can push an ad-hoc markdown **view** — a plan, a summary, a write-up of a diff — which the dashboard renders in the right rail. It is non-blocking, unlike a gate, and re-showing the same view updates it in place rather than stacking a duplicate.

An agent publishes that it has **settled** when the work is done and it is parked on the user: its process is still alive and it still accepts messages, but it is doing nothing until the user says something. It is published each time the agent parks and is undone by the agent's next turn starting, so "is it working or waiting for me" is answerable from the log rather than inferred from a status that only changes when the agent ends.

**Usage** is published cumulatively after every turn that reports it: input, output, cache-read and cache-creation tokens, the turn count, and the cost so far. The dashboard renders a live spend readout, and the agent stops itself once the cost reaches the budget cap when one is set. Some drivers report tokens but no price, which is exactly when no budget cap can fire.

The **end** event says whether the agent succeeded, with an optional detail, and separately marks the common non-error case where the user interrupted it — via the dashboard's Stop button or Ctrl-C — so a surface can show "stopped" rather than "failed".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
