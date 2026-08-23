Everything the dashboard does *to* an agent or a project: stopping an agent, chatting with it, answering its gate, changing its handoff level, merging it, starting a new one, pushing a finished agent's branch and opening its pull request, removing or deleting an agent's checkout, opening a project in the OS file manager or editor, putting a ticket on the agent queue, and releasing a ticket's claim.

## User story

The user watches an agent work in the dashboard and steers it: sends it a further instruction, answers the question it parked on, tells it to stop, tells it how far to publish itself. When an agent is finished, the same panel offers the next step — push the branch, open the pull request, merge it — plus the cleanup of a checkout that is no longer needed. From the project view the user starts new agents, queues tickets for the framework to work later, and opens the project on their own machine.

## Business logic — TL;DR

- **Steering is a file the agent is tailing** - Stop, chat messages, choice picks, handoff changes and Merge are appended to the control channel inside the agent's own worktree; the agent picks them up between turns.
- **An agent running on a device is steered there** - every agent-scoped action is forwarded over the relay to the device that owns the agent, instead of being applied to a checkout that does not exist here.
- **Starting an agent goes through the daemon** - the dashboard's Start is the same start the CLI makes, including the daemon's one-agent-per-project busy guard; a hand-fired drain names the agent queue entry it is about to work.
- **Finishing steps publish what the agent left** - Push and Open PR first commit whatever the agent left uncommitted in its checkout, then push; the pull request's title and body come from what the agent already recorded, and the opened pull request is written back onto the agent's archive.
- **Merge means two different things by agent state** - a running agent is told to merge at its natural end with the user's authorization recorded; a finished agent's open pull request is merged straight away.
- **Removing a checkout never loses work, and never surprises a running agent** - the work is committed and pushed before the worktree goes, a still-running agent is refused, and anything serving that checkout is stopped first.
- **Publishing a cloud session's answer goes through the bridge** - a `web`-target agent has no local session to steer, so the user's pick is queued for the browser extension to type into claude.ai; only labels of the question actually parked on are accepted, and the daemon composes what gets typed from them.
- **Queueing a ticket writes the queue directly** - the entry lands in the agent queue's matching priority section and links back to the ticket it came from.

## Business logic

### Steering is a file the agent is tailing

#### User story

See `## User story`.

#### Business logic

Stop, a live chat message, a choice pick and a handoff change are each appended as one entry to the control channel of the checkout that belongs to the named agent — the file that agent tails — and to the project's own control channel when no agent is named or the agent has no worktree. A chat message that is empty after trimming is dropped rather than queued. A choice pick carries one option id for a single-select gate or the chosen subset for a multi-select one, and records who picked: the user, or autopilot when the countdown accepted the recommendation. A handoff change carries exactly one rung of the ladder, and the agent echoes back what it applied as an event, so the dashboard reads the agent's own record rather than a local guess that a page reload would lose.

#### Rationale

A handoff change is steering rather than a settings write, because it is about this one agent: the preference decides where the ladder starts, and this is the user changing their mind for the agent in front of them.

### An agent running on a device is steered there

#### User story

The user starts an agent on another device from this dashboard, then steers it from here exactly as if it were local.

#### Business logic

Every agent-scoped action first asks whether the named agent is one this daemon is relaying from a device; if it is, the call is forwarded there and that device performs it. When the device cannot be reached, the actions that report an outcome say the device could not be reached rather than silently doing nothing locally. Actions that need a local checkout — removing or deleting one, opening the project on this machine — are never relayed, and answer with an error when the project has no local path here.

### Starting an agent goes through the daemon

#### User story

The user types a prompt in the dashboard and starts an agent, or presses "Run now" on a routine.

#### Business logic

Starting is handed to the daemon's own start, so a start from the dashboard behaves exactly like one from the CLI, busy guard included: when an agent is already active for that project the answer is that it is busy. A build or plain prompt agent needs a non-empty prompt; a research agent may be started with an empty one, and the daemon fills in what to research. When the prompt is a hand-fired drain, the agent queue entry it is about to work is looked up on this side and attached to the agent, so the agent's own record names the same work the scheduled drain would name; a caller that explicitly names a ticket wins over that lookup.

#### Rationale

The queued entry is resolved from the queue here rather than accepted from the browser, because it lands on the agent's record and is rendered as fact.

### Finishing steps publish what the agent left

#### User story

An agent finishes and the user decides to publish its work: push the branch, or open the pull request for it.

#### Business logic

Both actions address the agent's own branch as recorded on its agent meta, and act on the agent's own checkout, because for an agent that never committed, its checkout is the only place its work exists. Whatever the checkout left uncommitted is committed onto the agent branch first; if that commit cannot be made, the action reports that it could not commit the work rather than pushing a partial result. Opening a pull request pushes the branch first when the remote does not have it, and takes its title and body from what the agent already recorded — the session name it chose and the intent the user asked for — inventing nothing and asking the user for nothing. The number and URL of the opened pull request are written onto the agent's archive on the data branch, so every surface reads the same fact from the same place instead of re-deriving it from branch names.

#### Rationale

The commit and the push are performed while holding that checkout's lock. Clicked the instant an agent flips to finished, they otherwise race the daemon's own teardown of the same checkout: two commits against one tree, and two pushes creating the same remote branch, where the loser fails and the checkout is kept instead of retired.

### Merge means two different things by agent state

#### User story

The user decides the work is good and presses Merge — sometimes while the agent is still working, sometimes long after it ended.

#### Business logic

For a running agent, Merge is a control entry: the agent arms the full publish ladder, records that a human authorized the merge, and merges at its own natural end. That recorded authorization is what lets the merge happen without the agent's own ready-for-merge signal. For an agent that has already finished, there is no process to steer, so its open pull request is merged directly. An agent that ends between the two checks receives an entry nobody reads; its view then offers the direct merge, so a second click still lands.

### Removing a checkout never loses work, and never surprises a running agent

#### User story

An agent failed or was stopped and its checkout was kept so the user could look at it. The user is done looking and removes it — or removes the agent from the dashboard entirely, records and all.

#### Business logic

Removing a retained worktree and deleting an agent share the same rules: the project must have a local path here, the work in the checkout is committed and pushed before the directory goes, a still-running agent is refused, an unsafe agent id is refused, and an agent id with no worktree is reported as such instead of answered with a false success. Both hold the checkout's lock, so a click landing at the same moment as the daemon's teardown of that checkout runs after it and acts on the state it left. Before the directory comes off disk, a preview serving that checkout is stopped, rather than having its tree pulled out from under it. Deleting an agent removes its dashboard record too; its branch and commits stay.

### Publishing a cloud session's answer goes through the bridge

#### User story

A `web`-target agent's cloud session parks on a question. The Claude web bridge carries it into the dashboard, the user picks an answer there, and the extension types it back into claude.ai.

#### Business logic

The pick is queued in the bridge for the extension to collect, not written to a control channel, because a cloud session has no local session to steer. Only a well-formed cloud session id is accepted, and the pick must be labels of the question that session is currently parked on — one of them, or a multi-select's subset. Nothing else is accepted: an answer that is not a list of non-empty labels is refused outright, and the text the extension eventually types is composed by the daemon from the labels it validated, so this can never put arbitrary text in front of another product's agent. A queued answer can be withdrawn until the extension has delivered it, after which withdrawing does nothing. This action is never relayed: the bridge lives on the daemon the extension talks to.

### Queueing a ticket writes the queue directly

#### User story

The user sees a ticket worth doing and queues it, so the next drain agent picks it up.

#### Business logic

The entry is written straight into the project checkout's agent queue file. Given the ticket it came from, the entry is placed in the agent queue section matching that ticket's own priority rather than appended at the end, and is written as a link back to the ticket, so the drain agent working the queue front to back can open it. An empty entry is refused, and so is a project with no local path here.

#### Rationale

A direct file write rather than an agent: the agent queue is a plain file the dashboard already reads, and asking an agent to append one line would cost a turn and could do anything else besides.

### Releasing a ticket's claim

#### User story

An agent died holding a ticket's claim, and nothing frees claims on a timer. The user releases it from the dashboard so the ticket can be worked again.

#### Business logic

Only a real ticket filename is accepted. The claim file is deleted in the project checkout, committed, and pushed as far as it can be — a release only this machine can see would leave the ticket claimed everywhere the claim matters. A ticket that holds no claim, and a release that could not be committed, are each reported as such.

### Opening a project on this machine

#### User story

The user wants to look at the files an agent is changing, in their own file manager or editor.

#### Business logic

The project's registered path is opened in the OS file manager or in an editor. Naming an agent opens that agent's own checkout instead, since what the user wants to see is what the agent is doing, which is not in the project's tree. The editor is the one saved in preferences, falling back to the environment's configured editor and then to a default. A host with no local path for the project returns an error rather than spawning anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
