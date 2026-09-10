Serves the live event stream [1] for one selected agent [2] to the browser: everything already logged is replayed, the end of the replay is marked once, and every new event then follows as it is written, until the browser leaves or a relayed [3] agent that has finished has nothing more to say. A stream about an unknown project ends cleanly at once.

## Context

**User story**: the user opens an agent and its events appear as they happen; opening an agent that has been running for a while shows everything it did so far, then continues live; a reload or a lost connection rebuilds the feed without blanking it; and an agent running on a device streams exactly like a local one.

**Business logic story**: an agent appends each event to the events file in its own checkout [4]. The browser holds one stream per selected agent, and the daemon tails that agent's file for it (`events-tail.ts`), or, for a relayed agent, pumps the in-memory stream it receives from the device (`stream-forward.ts`). The mount that turns each event into one frame on the wire is `dashboard/rpc-serve.ts`.

## Glossary

[1] event / event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[6] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[7] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[8] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[9] end-of-replay marker: the one wire-only event the stream sends after the events already on disk have been delivered and before any live event; it is not an agent event, is never written to any file, and the browser swallows it.

## Business logic — TL;DR

- **Which agent's events, from where** - with an agent id the agent's own file, in its checkout while it is live and in its archive once it has ended; without one the project root's file; an unknown project has nothing to stream and the stream ends cleanly.
- **A relayed agent streams from memory** - the in-memory stream the daemon receives from the device wins over any file: its buffered history is replayed, then it is followed, and the stream ends when the relayed agent ends.
- **The end of the replay is marked once** - after the on-disk replay and before any live event, so a reconnecting browser can rebuild its feed atomically; only the on-disk stream sends it.
- **The stream follows the file when it moves** - the file moves into the archive at teardown, and the tail follows it there carrying its position; the one place it never follows to is the project root's file, which belongs to another agent.

## Business logic

### Which agent's events, from where

#### Context

**Problem**: a project runs several agents at once, each writing inside its own checkout, so without the agent id [5] a stream would be a mix, or, for an agent in its own checkout, empty. Once an agent has ended and its checkout is gone, its events live in its archive [6]; tailing the project root there would stream some other agent's events.

#### Business logic

With an agent id the file tailed is the agent's own: the events file in the checkout it works in while that checkout exists, else the agent's archived events (the resolution is `store/agent-checkout.ts`'s). Without an agent id the project root's events file is tailed. When the project id names no project here there is nothing to stream, and the stream ends cleanly rather than failing, which the browser reads as "done" and not as a lost connection. Once an agent has ended, the file tailed is its run's [7] diary, and each of its lines is turned back into the event it records on the way out; a live file's lines are events as written.

### A relayed agent streams from memory

#### Context

**Problem**: an agent relayed to a device [8] writes no file on this machine. What the daemon has is the stream of events it receives from the device, buffered in memory for as long as it relays the agent.

#### Business logic

When the daemon holds an in-memory stream for the agent (only ever a relayed agent; a local agent has none), that stream is the source: its buffered history is replayed first, then every event is forwarded as it arrives. When the relayed agent ends, the stream ends and the response is closed, so the browser sees a finished stream rather than a live feed gone quiet. An in-memory stream has no replay boundary to report, so no end-of-replay marker [9] is sent; the browser then falls back to a grace deadline before swapping its feed.

### The end of the replay is marked once

#### Context

**Problem**: a subscribe replays the whole log before following live, and without a boundary a reconnecting browser cannot tell "the replay is still streaming" from "the log is genuinely this short"; it would blank a populated feed and refill it line by line.

#### Business logic

After everything already on disk has been delivered, and before any live event, the stream sends the end-of-replay marker [9], once per subscription. It is wire-only: not an agent event, never written to any file, and swallowed by the browser, which uses it to buffer the replay and swap its feed in one step. A relocation of the file (below) is not a new replay and never sends it again.

### The stream follows the file when it moves

#### Context

**Problem**: an agent's events file does not sit still. When the agent ends, the daemon's teardown copies the file into the archive and removes the checkout, and a stream fixed on the old path that missed the final appends went silent without ever delivering the agent's end.

#### Business logic

The stream tails through the relocating tail (`events-tail.ts`): when the file it follows disappears after having existed, the file is re-resolved (the archive, once the checkout is gone) and the tail carries its position across the move, so the browser gets exactly the lines the move would have swallowed, once. The one place a stream about an agent must never relocate to is the project root's file, which is where resolution falls back once a delete has removed both the checkout and the archive; that file is another agent's stream, so a deleted agent's stream goes quiet instead. The initial attach stays permissive: an agent that legitimately lives in the project root (a project that is not a git repository) streams from there.
