Follows one agent's [1] event stream [2] live in the browser: the dashboard asks for the selected agent's stream, is sent everything already recorded and then every new line as it is written, and says so when the stream is lost so a dead connection never reads as a quiet agent.

## Context

**User story**: the user opens an agent's page and watches it work, line by line, with no reload and no refresh button. Opening the page hours later replays the whole recorded stream and reads exactly the same. Selecting another agent shows that agent's work instead. When the connection to the daemon drops, the feed says "Live stream lost — reconnecting. The session keeps running; this view may be behind." rather than going silently still.

**Business logic story**: the dashboard is a projection of the file each agent appends its events to in its checkout [3] (`.the-framework/events.jsonl`). One stream is followed at a time, shared by everything on the page that reads it, so the transcript and the right rail's documents never open a second connection or drift apart.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[5] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[6] segment: the events of one agent from one opening `session` event up to the next `session` event or the end of the stream. A resumed agent adds a segment to its stream.

## Business logic — TL;DR

- **What is followed** - the selected agent's own stream; with no agent selected, the project's stream; with no project selected, nothing.
- **Replay then live** - every subscription sends everything already recorded before it starts sending new lines, so a live agent and a past one render identically.
- **A reconnect never shows less than what is on screen** - the re-sent history is held back and swapped in whole, on the stream's end-of-replay marker or after a short deadline for streams that send none.
- **A lost stream is reported and retried** - the feed is flagged as behind reality and reconnected with a backoff that settles at one attempt every 8 seconds; an outage never clears the feed.
- **A stream the daemon ends on purpose is final** - no retry, no alarm.
- **Following stops** - when the selection changes or the page leaves the agent, the stream is dropped and the feed starts over.
- **A fresh start empties the feed at once** - the previous agent's lines are dropped the moment the user starts a new agent, without dropping the connection.
- **Only the project-wide stream is cut to the agent in progress** - an agent's own stream is shown whole, including everything before a resume.

## Business logic

### What is followed

#### Context

See `## Context`.

#### Business logic

The stream followed is the one the address selects: the selected agent's [1] own stream, identified by the project and the agent. When the address selects a project but no agent, the project's own stream is followed instead. This fallback is what a relayed [4] agent and an agent that has just been started, before the daemon has told the dashboard its id, are watched through. With no project selected there is nothing to follow and the feed is empty.

Changing either the project or the agent starts a new subscription to that stream, which is what makes selecting one agent show its work and not another's.

### Replay then live

#### Context

**User story**: opening an agent's page mid-work must not show only what happens from now on. The user sees the whole story from the agent's first line, and then the story continues in place.

#### Business logic

Every subscription first sends everything already recorded in the stream, then follows what is appended. The events arriving from a replay and the events arriving live are the same events and render identically; the only difference the dashboard keeps is that a live event is stamped with the moment it arrived, so elapsed times are shown for what the user watched happen and never invented for a past agent.

### A reconnect never shows less than what is on screen

#### Context

**Problem**: a reconnect replays the whole stream again. Clearing the feed and letting the history stream back in blanks a populated page for as long as the replay takes, which reads as an agent that lost its work.

#### Business logic

The first subscription for a selection streams into a feed that is already empty, so its replay renders as it arrives. A reconnect is treated differently: its replayed events are held back while the feed on screen stays untouched, and the whole replay then replaces the feed in one step. The swap happens when the stream reports that its replay has been delivered, or at the latest 1.5 seconds after the reconnect for streams that report no such boundary, which is the case for the streams held in memory rather than read off a file (a relayed [4] agent, and an agent on a device [5]). If the reconnected stream dies before the swap, the partial history is thrown away rather than swapped in, and the next attempt replays from the top.

### A lost stream is reported and retried

#### Context

**Problem**: the daemon restarting, or the connection dropping, simply stops the events. "The agent went quiet" and "the feed died" then look identical, and the user reads a stalled page as a stalled agent.

#### Business logic

A stream that fails to open, or that ends with an error, marks the feed as lost: the agent's feed shows a warning banner saying the live stream is lost and reconnecting, and that the agent keeps running while this view may be behind. Reconnection is attempted after 1 second, then 2, then 4, then every 8 seconds until it succeeds. A successful reconnection clears the warning and resets the backoff. The events already on screen are never cleared by an outage.

### A stream the daemon ends on purpose is final

#### Context

**Problem**: not every ended stream is an outage. The daemon closes the stream cleanly when there is nothing to follow, such as an unknown project, or when a relayed [4] agent's stream is over. Retrying those forever would hammer the daemon and show a permanent warning for a situation that is not a fault.

#### Business logic

A stream the daemon closes cleanly ends the following: the feed is marked as finished, no reconnection is attempted, and no warning is shown.

### Following stops

#### Context

See `## Context`.

#### Business logic

When the selection changes, or the page stops showing the agent [1], the stream is dropped and any pending reconnection is abandoned. The feed, the lost warning and the finished mark all start over for the new selection, so a new selection never inherits the previous one's events or its warning.

### A fresh start empties the feed at once

#### Context

**User story**: the user starts a new agent from the launcher while the previous agent's transcript is on screen. The pane must go empty and wait for the new agent, not keep showing the finished agent's lines as if they were the new one's.

#### Business logic

Starting an agent empties the feed immediately, without dropping the stream that is being followed. The new agent's checkout [3] starts its stream afresh a moment later, and the stream being followed picks the new content up on its own, so the pane waits empty until the new agent's first line arrives.

### Only the project-wide stream is cut to the agent in progress

#### Context

**Problem**: the project-wide stream outlives individual agents, since it is only dropped when the project selection changes; without a cut, a second agent's page would still show the previous agent's lines. An agent's own stream has the opposite problem: a resumed agent appends a second segment [6] to the same stream, and cutting it to the latest segment would hide everything the agent did before the resume for as long as it is live.

#### Business logic

When the fallback project-wide stream is being followed, only the events of the agent [1] in progress are shown, using the same cut as the rest of the dashboard (the rule is in `live-state.ts`). When the selected agent's own stream is being followed, every event of it is shown, resumes included.
