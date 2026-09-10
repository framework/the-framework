Derives an agent's [1] current state from its event stream [2], as pure folds over the events with nothing kept beside them, so that a live agent and a replayed one show the same thing: which gates [3] it is parked on, which views [4] it has pushed, whether it is still going (which is what offers the Stop [5] button), whether it has settled [6] on the user, how it ended, whether its handoff [7] is still publishing, and the links to its GitHub Actions run or its cloud session [8].

## Context

**User story**: the user opens an agent's page while the agent works, or hours later from the list of past agents, and both times the page says the same thing: a Stop button only while something more may come, "waiting for you" once the agent has parked, the questions it is asking, the documents it wants read, how it ended, and a pull request that is moments away rather than a page that reads as finished with nothing coming.

**Business logic story**: the dashboard is a projection of the same event stream the agent appends to in its checkout [9] (`.the-framework/events.jsonl`); the rules here turn that stream into the facts the agent view, the status pill, the right rail and the actions menu render. The other folds over the same stream (the session name, ready for merge, what the handoff is armed to do, reported errors, the driver session) live in `../../src/agent-view.ts`, and the status words built on top of these facts live in `agent-status.ts`.

**Problem**: the stream the browser holds is not always exactly one agent's. The live channel keeps one subscription per project and appends everything it streams, while every agent starts its own file afresh with one opening `session` event, so a subscription that outlives an agent holds the previous agent's events before the new one's. A resumed agent also appends a second segment [10] to the same stream, after the `end` of its first. Facts that would read "was there ever an end" or "which gate is open" over the whole stream must therefore be asked of the right segment, or a fresh agent shows the prior agent's questions and a resumed agent shows as stopped while it works.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[6] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[7] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request), `merge` (also merge it).
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[10] segment: the events of one agent from one opening `session` event up to the next `session` event or the end of the stream. A resumed agent adds a segment to its stream; a live subscription that outlives an agent holds the previous agent's segment before the new agent's. The latest segment is the agent in progress.
[11] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[12] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[13] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[14] status snapshot: the small summary the daemon keeps beside an agent's event stream (`agent.json` next to `events.jsonl`): its status, cost, branch, pull request, what its handoff is armed to do and how the handoff reported. List surfaces read it instead of replaying the stream.
[15] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[16] coding agent: the CLI doing the actual work: Claude Code or Codex.
[17] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.

## Business logic — TL;DR

- **The current segment** - only the events from the latest opening `session` event onward are the agent in progress; a stream with no such event counts whole.
- **Open gates** - a question opens with its `choice` event, closes with the pick carrying the same id, is replaced in place when re-asked under the same id, and every question closes when the agent ends.
- **Views** - one entry per view id, in first-seen order; showing a view again updates it in place.
- **Still going** - the current segment has streamed something and holds no `end` yet; an empty stream is not going.
- **Settled on the user** - true from a `settled` event until the next turn starts or the agent ends.
- **How it ended** - the current segment's `end`: success or failure, whether the user stopped it, and its detail; nothing while the segment has no end.
- **Publishing** - the current segment ended clean and has no handoff report yet, and the latest arming anywhere in the stream has push on.
- **Publishing, from the status snapshot** - the same window read off the snapshot for lists: status done, push armed, no handoff report recorded.
- **The GitHub Actions run link** - the latest progress line reading `run <url>`; absent for every other agent.
- **The cloud session** - the latest progress line reading `cloud <url>`, with the session id read off the claude.ai URL.

## Business logic

### The current segment

#### Context

See `## Context`.

#### Business logic

The current segment [10] is the tail of the event stream [2] from its last `session` event, that event included, to the end of the stream. A stream holding no `session` event at all is taken whole. The right rail's views [4] tab reads only the current segment, so a fresh agent [1] never shows the previous agent's documents; the facts below that say "the current segment" are asked of this tail. The live feed shown in the agent view is cut the same way only when no agent is selected (the rule is in `use-live-events.ts`); a selected agent's feed keeps every segment.

### Open gates

#### Context

**User story**: the agent stops on a question with options; the user sees it as a card in the transcript, answers it, and the card turns into an answered one. An agent may park on several questions at once, and the user sees all of them.

**Problem**: an agent whose process died mid-question never records an answer. The question must not stay answerable forever once nobody is left to read its pick [11]; the `end` the daemon writes on such an agent's behalf is the only signal that the question's audience is gone.

#### Business logic

Gates [3] are tracked by id over the events given, in the order they first fired:

- A `choice` event opens the gate with its id, carrying everything the question needs: its title, its options, the recommended option, whether several options may be picked, the auto-accept delay, and the file under review.
- A `choice-resolved` event with the same id closes it.
- A new `choice` event with an id that is already open replaces the earlier gate in place, keeping its position in the order.
- An `end` event closes every open gate: a finished agent awaits nothing. This is what expires the question of an agent that died mid-gate.

The result is the list of gates still open. The transcript uses it to tell an open gate card from an answered one (`EventList.tsx`), and a gate card is keyed by its id so a re-fired gate starts afresh.

### Views

#### Context

**User story**: while it works, the agent pushes a plan, a summary or a diff write-up for the user to read in the right rail; showing the same document again refreshes it instead of stacking a second copy.

#### Business logic

Every `view` event in the events given contributes one entry, keyed by the view's [4] id, in first-seen order. A later `view` event with the same id replaces the earlier entry's title and markdown in place, keeping its position. The right rail reads these off the current segment [10] only.

### Still going

#### Context

**User story**: the Stop [5] button is offered only while stopping still means something, and the status pill reads as at work while the agent [1] is going.

**Problem**: a resumed agent's stream carries its earlier segment's [10] `end`, so asking "was there ever an end" over the whole stream hides Stop and settles the pill while the agent works.

#### Business logic

An agent is still going when its current segment holds at least one event and none of them is an `end`. An empty stream is not going. This fact drives:

- the actions menu: whether Stop is offered, and whether the agent still has a checkout [9] of its own (a going agent always does; a finished one only while its work has not reached the remote), which decides whether the menu's folder item opens the agent's own folder;
- the agent view's own verdict that its feed is live, so a resumed agent's continuation renders and Stop takes over from Resume the moment its first event lands, before the daemon's agent list notices;
- the status words in `agent-status.ts`.

### Settled on the user

#### Context

**User story**: an agent [1] whose work has stopped stays alive as a conversation so the user can send the next message; the page tells "working" from "waiting for you" even though the agent's status stays running either way.

**Problem**: anything that asks "is there anything more coming?", such as whether to offer the handoff [7] or whether to read what the branch holds, must ask this rather than whether the process is up, or a plainly finished agent offers nothing to do with it.

#### Business logic

Read over the whole stream, latest event deciding: a `settled` event marks the agent settled [6]; a driver [13] `start` event (a new turn [12] begins) clears it; an `end` clears it too, since the agent ended outright and "still going" already says so. The agent view treats an agent as working only while its feed is live and it is not settled; once it is not working, the handoff bar reads the branch and offers the handoff.

### How it ended

#### Context

**User story**: a finished agent's [1] status pill and composer note say whether it finished, failed or was stopped by the user, instead of one "finished" for a crash and a clean pass alike.

**Problem**: a resumed agent's stream holds its stopped segment's [10] `end`; reading the first end ever would keep a resumed agent "stopped" forever, even after it later finished clean.

#### Business logic

The outcome is read off the first `end` event of the current segment: whether it succeeded, whether the user stopped [5] it (only when the end says so explicitly; an end that does not say counts as not stopped), and the end's detail text when it carries one. While the current segment has no `end`, because the agent is still going or has just been resumed, there is no outcome at all. The agent view reads the outcome only for an agent that is no longer live.

### Publishing

#### Context

**User story**: after an agent [1] finishes clean, its handoff [7] still pushes the branch, opens the pull request and maybe merges it; for those seconds the status pill says the agent is publishing rather than finished, which would read as done with nothing coming while the pull request link is moments away.

#### Business logic

An agent is publishing exactly when all three hold:

- the current segment's [10] `end` reports success;
- the current segment holds no `handoff` event yet. Every handoff reports, whether done, skipped or failed, so its report closes the window. Only the current segment is checked, because a resumed agent's earlier segment carries its own report, which must not hide the new window;
- the latest `handoff-armed` event anywhere in the stream has push on. Arming is agent-level configuration rather than segment state, so it is read across segments.

A stream with no `handoff-armed` event at all is not publishing. The "absent means armed" default that the handoff fold applies elsewhere is deliberately not applied here, or an agent recorded before arming events existed would show as publishing forever.

### Publishing, from the status snapshot

#### Context

**Problem**: the list of recent agents holds only each agent's [1] status snapshot [14], never its event stream. The snapshot's status flips to done the moment the `end` lands, while the handoff [7] report reaches the snapshot only when the handoff answers, so between the two a list would say done while the agent's own page says publishing.

#### Business logic

Off the status snapshot, an agent is publishing when its status is done, the handoff it is armed for has push affirmatively on (an absent arming reads as nothing to wait for, the same rule as the event-side check), and no handoff report has been recorded yet. The list of recent agents shows the same publishing state the agent's own page shows.

### The GitHub Actions run link

#### Context

**User story**: an agent [1] whose location [15] is `actions` shows a link to its live workflow run on GitHub, so the user can watch it there while the transcript is still catching up at the end.

#### Business logic

The link is read off the coding agent's [16] progress lines: the Actions driver [13] emits a progress line reading `run <url>` once it has found its workflow run, and the URL must start with `http://` or `https://`. The last such line wins, so an agent with several turns [12] points at its most recent run. The link is absent until the driver has found the run, and absent for every agent not running on GitHub Actions.

### The cloud session

#### Context

**User story**: a hands-off [17] agent's [1] page shows which claude.ai session its task was handed to, as a link. It is read off the events rather than the status snapshot [14] so that a tab opened mid-agent, which replays the events, sees it too.

#### Business logic

The cloud driver [13] emits a progress line reading `cloud <url>` once the cloud session [8] exists, where the URL is a claude.ai code session URL of the form `https://claude.ai/code/session_<id>`; the session id is the `session_<id>` part of that URL. The last such line wins, so an agent handed off more than once points at its latest cloud session. Absent until the handoff to the cloud has landed. The notice the agent view shows for a `web` agent reads it (`CloudAgentNotice.tsx`), and only for an agent whose location [15] is `web`.
