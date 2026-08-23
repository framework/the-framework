Reads an agent's live status straight off its event log: which gates it is parked on, which views it has pushed, whether it is still working, how it ended, and where its work is running. The dashboard holds no separate status of its own — every one of these answers is a projection of the same `events.jsonl` the agent writes, so a tab opened mid-way reconstructs the identical picture by replaying the stream.

## Glossary

- **current segment** - the tail of the event log belonging to the agent's newest stretch of work. The log opens with a session boundary marker, and a resumed agent appends a second one, so an event log can hold a previous stretch followed by the current one.
- **settled** - the agent has stopped working and is waiting on the user, as opposed to its process having exited. A settled agent's conversation stays alive to take the user's next message, so it still counts as running.
- **publishing** - the window after an agent finishes cleanly while its armed handoff is still pushing the branch, opening the PR, or merging.

## Business logic — TL;DR

- **Only the current segment counts** - every "is it still going / how did it end" answer is read from the newest session boundary onward, never from the whole log.
- **Open gates** - all gates the agent is currently parked on, in the order they fired; a resolved gate disappears, a re-fired gate replaces itself, and the agent's end closes all of them.
- **Agent views** - every markdown view the agent pushed to the right rail, one entry per view, in first-seen order.
- **Still working** - an agent is live until its current segment carries an end.
- **Settled ≠ exited** - an agent that parked on the user is reported as settled; the next turn un-settles it.
- **How it ended** - success, user-stopped, and the failure detail, taken from the current segment's end.
- **Publishing** - a cleanly finished agent whose armed handoff has not reported back yet is still publishing, both when read from its event log and when read from its `agent.json`.
- **Where the work runs** - the live GitHub Actions run link and the Claude Code cloud session link are recovered from the driver's own progress lines.

## Business logic

### Only the current segment counts

#### User story

The dashboard keeps one long-lived live subscription per project and appends everything that streams in. A new agent truncates `events.jsonl` and opens with a fresh session boundary, so a subscription that spans an agent boundary ends up holding the previous agent's log followed by the new one. Separately, resuming an agent appends a second session boundary to the same log.

#### Business logic

Everything after the last session boundary is the current segment; a log with no boundary yet is taken whole. Whether an agent is still working, how it ended, and whether it is publishing are all answered from the current segment alone.

#### Rationale

Without the cut, a freshly started agent's live view and right rail would show the previous agent's gates and views. And reading "was there ever an end" across the whole log made a resumed, actively working agent look finished — hiding its Stop button — and kept it labelled as user-stopped for ever, even after it later finished cleanly.

### Open gates

#### User story

An agent parks on a gate awaiting the user's pick. It can park on several gates at once, and the dashboard shows them all together in the right rail.

#### Business logic

A gate opens when the agent signals a choice and closes when that same choice is resolved. A gate that fires again while already open replaces the earlier one in place rather than stacking. When the agent ends, every open gate closes at once.

#### Rationale

An agent that dies mid-gate never resolves its choice, and the surrogate end the dashboard records is the only signal that the question's audience is gone. Leaving the gate rendered past that point left a panel that stayed answerable for ever while nobody read the picks.

### Agent views

#### User story

An agent can push an ad-hoc markdown view into the dashboard's right rail to show the user something.

#### Business logic

Every view the agent has shown is kept, in the order first seen. Re-showing a view under the same identity updates that entry in place, so the rail holds one entry per view instead of duplicates.

### Still working, and settled

#### User story

The user needs to know whether an agent is still going — worth offering a Stop button — and, separately, whether it has finished its work and is waiting on them while its conversation stays open for the next message.

#### Business logic

An agent is live from the moment anything streams until its current segment carries an end. It is settled once it signals that it has parked on the user; a new turn from the driver clears that, and an outright end clears it too, since ending already says the agent is gone.

#### Rationale

A settled agent's status stays "running" long after its work is done, because its conversation is kept alive to accept the user's next message. Anything asking "is there more coming?" — whether to offer the handoff, whether to read the branch — must ask whether the agent is settled rather than whether its process is up, or an agent that is plainly done would offer nothing to do with it.

### How it ended

#### User story

A finished agent's most important fact is whether it succeeded, was stopped by the user, or failed — and why.

#### Business logic

The current segment's end carries the outcome: whether it succeeded, whether the user stopped it, and the failure detail when there is one. While the agent is still going there is no outcome at all.

#### Rationale

The overview pill previously said "finished" for a crash and a clean pass alike, with the failure visible only in one small feed line.

### Publishing

#### User story

In the seconds after an agent finishes, its armed handoff is still pushing the branch, opening the PR, and merging. Showing "finished" through that window reads as done-with-nothing-coming while the PR link is moments away.

#### Business logic

An agent is publishing when its current segment ended cleanly, its handoff was affirmatively armed to push, and no handoff report has arrived. The handoff report of an earlier segment never closes the current window. Arming, unlike the report, is agent-level configuration, so the most recent arming applies wherever it sits in the log.

The same window is derivable from an agent's `agent.json` alone, for the list surfaces such as the Recent-sessions rail that never hold the event log: an agent counts as publishing while its status is done, its handoff is armed to push, and its handoff report is missing.

#### Rationale

Arming must be affirmative rather than assumed: treating a missing arming record as armed would leave every archive predating the handoff mechanism stuck at "publishing…" for ever. On the meta side, status flips to done the instant the agent ends while the handoff report only lands when the epilogue answers, so without this rule a list would say "done" while the agent's own pill still said "publishing…".

### Where the work runs

#### User story

An agent running on the `actions` target should link through to its live GitHub Actions run, and a `web`-target agent to the cloud session it handed its task to — including from a tab opened part-way through, while the transcript is still replaying.

#### Business logic

Both links are recovered from the driver's own progress lines rather than from the agent's meta, so that they replay with the stream. The Actions link appears once the driver has located its workflow run; the cloud session link, together with its session id, appears once the hand-off has landed. In both cases the most recent one wins, so an agent that handed off more than once points at its latest destination. Neither link exists before the driver reports it, nor for agents on other run targets.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
