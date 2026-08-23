The dashboard's live view of what an agent is doing: it follows the agent's event log and pushes each newly appended event onto the screen as it happens. Every dashboard surface that shows live agent activity — the main event view and the open questions in the right rail — reads this one shared feed rather than each opening its own. Alongside the events, the feed reports two facts the surfaces need: whether it is currently lost and being retried (so what is shown may be behind reality), and whether the daemon has deliberately finished with it (so there will be nothing more).

## User story

- The user watches an agent work and sees its output appear live, without refreshing.
- The user selects a different agent and sees that agent's output, not the previous one's.
- If the daemon dies, the user must be told the feed is lost — never left staring at a screen that has simply stopped moving, unable to tell that from an agent that has gone quiet.
- Reconnecting must not make the user lose their place: the feed must never show less than it was already showing.

## Business logic — TL;DR

- **One feed per agent** - the selected agent decides which event log is followed, and selecting another agent switches to that agent's log. With no agent named, the project's own log is followed instead.
- **A lost feed says so and retries** - a feed that dies, or that cannot be subscribed to at all, is reported as lost and retried after one, two, four, then eight seconds.
- **A feed the daemon closes on purpose is final** - it neither retries nor alarms; it simply reports that there is nothing more.
- **A reconnect never shrinks the view** - re-subscribing replays the log from the top, and that replay is held back and swapped in as a whole, so the feed never briefly shows less than it already showed.
- **Starting a new agent empties the pane immediately** - without dropping the subscription, so the pane waits empty for the new agent instead of showing the finished one.
- **A project-wide feed is scoped to the agent in progress** - the fallback feed outlives individual agents, so only the current agent's part of it is shown; an agent's own feed is never sliced this way.

## Business logic

### One feed per agent

#### User story

See `## User story`.

#### Business logic

Each agent appends to its own event log inside its own worktree, so the agent the user selected decides which log the dashboard follows; selecting a different agent switches the subscription to that agent's log, which is what makes two agents show two different outputs. When no agent can be named — an agent relayed from another device, or one just started whose identity is not yet known — the project's own event log is followed instead. Selecting a different project resets the feed entirely: the events, the lost state, and the finished state all start over.

Each event is stamped with the moment it arrived, so the surfaces can show how long ago something happened.

### A lost feed says so; a finished one does not

#### User story

The user must be able to tell "the daemon is not answering" from "the agent is thinking".

#### Business logic

A feed that dies mid-stream, or that could not be subscribed to in the first place, is reported as lost and retried — after one second, then two, four, and eight, staying at eight thereafter. The retry counter resets as soon as a subscription succeeds. A feed the daemon closes cleanly means the daemon is finished with it on purpose — a relayed stream that ended, a project it does not know — so it is reported as finished: no retry, and no alarm raised to the user.

#### Rationale

A dead feed used to be silent: events simply stopped, and there was no way to tell a dead feed from a quiet agent. Making the difference explicit is the whole reason the feed reports lost and finished as separate facts.

### A reconnect never shows less than what is already on screen

#### User story

An agent has been running for a while and its output fills the pane. The daemon blips; the feed reconnects. The user must not watch their scrollback empty out and refill.

#### Business logic

Every subscription replays the whole log before following live. The very first subscription streams into a pane that is already empty, so its events simply render as they arrive. A reconnect, however, has a populated pane on screen: its replay is collected out of sight and swapped in as one piece, so the visible feed goes straight from the old content to the complete new content. The swap happens on the daemon's own end-of-replay signal, or, for the in-memory sources that have no replay boundary to report — a relayed feed, an agent relayed from another device — after a grace period of one and a half seconds, by which time their buffered history has long since arrived. If the feed dies part-way through a replay, the partial replay is thrown away rather than swapped in, since showing it would be exactly the collapse this is meant to prevent, and the next attempt replays from the top regardless.

### Starting a new agent empties the pane

#### User story

The user starts a new agent in a project where one just finished. The pane must not keep showing the finished agent's output.

#### Business logic

When the dashboard knows an agent boundary has occurred — the user started a fresh agent — the accumulated feed is dropped straight away, without tearing down the subscription. The new agent truncates the event log a beat later, so until its first event arrives the accumulated feed would otherwise still hold the finished agent's output, which the jump-to-live view would then present as current. The pane waits empty instead, and the follow notices the log was rewritten and streams the new agent in.

### Scoping the project-wide feed to the agent in progress

#### User story

The user watches successive agents in a project through the fallback feed, and must see the agent that is running now — not the one before it.

#### Business logic

The project-wide fallback feed outlives individual agents: it is only reset when the project changes. So what it accumulated is trimmed to the agent currently in progress, or a second agent would keep showing the previous agent's output until it finished. An agent's own feed is never trimmed this way, because it contains nothing but that agent — including the second session boundary a resumed agent appends to the very same log, where trimming would wrongly hide everything from before the resume for as long as the agent stayed alive.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
