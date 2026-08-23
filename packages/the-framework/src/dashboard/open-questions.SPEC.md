Pools every parked question, across all projects, into the dashboard's open questions list — every running agent's pending gate, plus every question a cloud session parked on and the Claude web bridge carried home — so the user answers from one place instead of hunting through each agent's view.

## User story

Several agents run at once and two of them park on a choice, while a third task, handed to a Claude Code cloud session, stops to ask something of its own. The user opens the dashboard and sees all three questions side by side, longest-waiting first, each with the full choice — every option, whether more than one option can be picked, and which option is recommended — ready to answer on the spot.

## Business logic — TL;DR

- **Only genuinely open gates are offered** - a local agent's gate is listed only if the agent's own event log still shows it unanswered; a cloud session's question is listed only while no answer is already on its way to it.
- **A cloud session's question is joined to its agent through the archive** - a `web`-target agent is finished the moment it hands off and its checkout may be long gone, so the match is made against every agent the project has a record of, archived ones included.
- **One card per bridged question** - two checkouts of the same repository share their record of finished agents, so the same cloud session appears under both; the first project to claim it gets the card.
- **Longest-waiting first** - the agent that has been blocked on its human the longest is listed first.
- **A broken project is silently absent** - anything unreadable contributes no questions rather than breaking the list.

## Business logic

### Only genuinely open gates are offered

#### User story

The user answers a question from the pooled list, or answers it inside the agent's own view; either way the question must disappear and must never be answerable twice.

#### Business logic

Each running agent that reports a pending gate is checked against its own event log, read from the agent's worktree rather than the project root. The gate counts as open only when the log records it being asked with no later record of it being answered; otherwise the agent contributes nothing to the list. Each listed question carries the whole choice as it was asked — all options, single- or multi-select, the recommended option, and the accompanying detail — because the pooled list must be able to answer it, not merely count it.

A question the bridge carried home is filtered the same way: it is offered only while the bridge holds no answer already queued for that cloud session, since the pick is then merely waiting to be typed and the question is settled.

#### Rationale

The agent's status record names only the pending gate's id and title, which is all the dashboard's badge needs; the options themselves only exist in the event log, so the log is the source of truth for both the gate's contents and whether it is still open. Offering an answer the daemon would then refuse is worse than showing one card fewer.

### A cloud session's question is joined to its agent through the archive

#### User story

A `web`-target agent handed its task to a cloud session and is already finished here. That session stops to ask something, the bridge carries the question home, and the user needs to see it as this project's question — labelled with the work it belongs to — not as a stray card from nowhere.

#### Business logic

A bridged question names the cloud session that asked it, and an agent's record names the cloud session it handed its task to; matching the two is what puts the question on the right agent's card. The match is made against every agent of the project, finished and archived ones included, rather than against the agents currently running: a `web`-target agent is finished at its hand-off and its checkout may be long gone by the time its session asks anything.

The card is answered by label rather than by option id, because a claude.ai page offers no ids and a label is the only thing that can be typed back into it. Its wait is counted from when the bridge saw the question, not from the hand-off, so the ordering reflects how long the user has actually been holding it up.

A bridged question whose cloud session matches no agent here is not offered at all. The archive is read only while there is a bridged question waiting to be joined, so the common case — nothing bridged — costs nothing.

### One card per bridged question

#### User story

The user has the same repository checked out twice and registered as two projects. One cloud session's question must show up once, not once per checkout.

#### Business logic

Both checkouts share the same record of the project's agents, so the same `web`-target agent is found under each. A bridged question is claimed by the first project that matches it, and every later match is skipped.

### Longest-waiting first

#### User story

With a handful of parked agents, the user wants to unblock whoever has been stuck longest rather than scanning timestamps.

#### Business logic

Questions are ordered by how long they have been waiting, earliest first: for a local agent that is when it last spoke, for a bridged question when the bridge first saw it.

### A broken project is silently absent

#### User story

One registered project has been deleted from disk or has an unreadable agent record; the user still expects the other projects' questions.

#### Business logic

A project whose agent list, archive or event log cannot be read contributes no questions, and the rest of the list is still returned.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
