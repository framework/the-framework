The dashboard's live feed of one agent: the agent's events, replayed and then followed, streamed to the browser as they happen.

## Business logic — TL;DR

- **The feed belongs to one agent** - naming an agent streams that agent's own events; naming only the project streams the project's own event log, which is where an agent without a worktree writes.
- **A relayed agent streams from memory** - an agent this daemon is relaying from a device has no event log here, so its events are forwarded live and the feed closes when that agent ends.
- **A local agent streams from its log, wherever it now lives** - the feed follows the agent's event log from its worktree into its archive without losing or repeating events, and announces once when the replay of the history is complete.
- **A feed never falls back onto another agent's events** - once an agent's own log can no longer be found, its feed goes quiet rather than switching to the project's log.

## Business logic

### The feed belongs to one agent

#### User story

Several agents work the same project at once. The user opens one of them and sees that agent's output, not a mix.

#### Business logic

A feed is subscribed for a project and, normally, one agent. With an agent named, it follows that agent's own events — from its worktree while it is running, from its archive once it has finished and its worktree is gone. With no agent named, it follows the project's own event log, which is where an agent that has no worktree writes. A subscription for a project that does not exist streams nothing and closes cleanly, rather than reporting an error to the browser.

### A relayed agent streams from memory

#### User story

The user starts an agent on another device and watches it in this dashboard as if it were running here.

#### Business logic

When the named agent is one this daemon is relaying from a device, its events are taken from that live relay rather than from disk, and the feed is closed as soon as the relayed agent ends — a finished agent has nothing more to say, and an open connection would read as a live feed that went quiet. An agent running locally is not answered by that source and is streamed from its event log instead.

### A local agent streams from its log, wherever it now lives

#### User story

The user is watching an agent when it finishes. Its event log is moved into its archive and its worktree is removed; the user must still see the agent's final events, including the one that says it ended.

#### Business logic

The feed replays everything the event log already holds, announces once that the replay is complete, and then delivers each appended event. When the log moves, the feed follows it to its new location and continues from where it left off, so the events around the move arrive exactly once. The end-of-replay announcement is sent only for a feed read from disk; a relayed feed has no such boundary to report.

#### Rationale

Without the announcement, a reconnecting dashboard cannot tell "the history is still streaming" from "the log really is this short", so it blanked a populated feed and refilled it line by line.

### A feed never falls back onto another agent's events

#### User story

The user deletes an agent while its tab is open.

#### Business logic

An agent whose worktree and archive are both gone has no log of its own left. Rather than following the project's own event log — which belongs to a different agent — the feed goes quiet. The very first attachment is deliberately permissive: an agent that legitimately has no worktree does write to the project's log, and its feed must work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
