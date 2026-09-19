Serves the live event stream [1] for one selected agent [2] to the browser: everything already logged is replayed, the end of the replay is marked once, and every new event then follows as it is written, until the browser leaves or a relayed [3] agent that has finished has nothing more to say. A stream about an unknown project, or about no agent, ends cleanly at once.

## Context

**User story**: the user opens an agent and its events appear as they happen; opening an agent that has been running for a while shows everything it did so far, then continues live; a reload or a lost connection rebuilds the feed without blanking it; and an agent running on a device streams exactly like a local one.

**Business logic story**: the tool that runs an agent appends each line of the agent's diary [1] in the agent's own checkout [4]. The browser holds one stream per selected agent, and the daemon tails that agent's diary for it, turning each line into the event the dashboard draws (`store/run-record.ts`) (`events-tail.ts`), or, for a relayed agent, pumps the in-memory stream it receives from the device (`stream-forward.ts`). The mount that turns each event into one frame on the wire is `dashboard/rpc-serve.ts`.

## Glossary

[1] event stream / diary: everything an agent does, as the browser receives it, one event per line of the agent's diary: `<id>.jsonl`, written by the tool that runs the agent under the `.the-framework/` of the agent's checkout while it works, and answered whole by the project's runs provider [7] once it has ended.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[7] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents (`../store/runs.ts`).
[8] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[9] end-of-replay marker: the one wire-only event the stream sends after the events already on disk have been delivered and before any live event; it is not an agent event, is never written to any file, and the browser swallows it.

## Business logic — TL;DR

- **Which agent's events, from where** - the agent's own diary, in its checkout while it has one and from the runs provider [7] once it is finished; an unknown project, or no agent id, has nothing to stream and the stream ends cleanly.
- **A relayed agent streams from memory** - the in-memory stream the daemon receives from the device wins over any file: its buffered history is replayed, then it is followed, and the stream ends when the relayed agent ends.
- **The end of the replay is marked once** - after the on-disk replay and before any live event, so a reconnecting browser can rebuild its feed atomically; only the on-disk stream sends it.
- **The stream follows the diary when it moves** - when the agent ends, its diary becomes the finished agent's, and the tail sends the lines it had not sent yet.

## Business logic

### Which agent's events, from where

#### Context

**Problem**: a project runs several agents at once, each with a diary [1] inside its own checkout, and the daemon learns a new agent's id before that checkout exists.

#### Business logic

The file tailed is the agent's own diary, resolved by `store/agent-checkout.ts`: in the agent's checkout [4] while the checkout exists, else the finished agent's lines from the runs provider [7], else the place in the checkout where the diary will appear, for an agent started a moment ago. Each line is turned into the event it records on the way out. When the project id names no project here, or no agent id [5] is given, there is nothing to stream, and the stream ends cleanly rather than failing, which the browser reads as "done" and not as a lost connection.

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

### The stream follows the diary when it moves

#### Context

**Problem**: an agent's diary [1] does not sit still. When the agent ends, the tool that runs it records the diary and reclaims the checkout, and a stream fixed on the old path that missed the final appends went silent without ever delivering the agent's end.

#### Business logic

The stream tails through the relocating tail (`events-tail.ts`): whenever the file it follows is not there, the diary is resolved again; once it is the finished agent's lines, the tail sends the ones past what it already sent, so the browser gets exactly the lines the move would have swallowed, once. A relocation is not a new replay.
