Derives an agent's [1] current state from its event stream [2], as pure folds over the events with nothing kept beside them, so that a live agent and a replayed one show the same thing: which gates [3] it is parked on, whether it is still going (which is what offers the Stop [4] button), how it ended, and the links to its GitHub Actions run or its cloud session [5].

## Context

**User story**: the user opens an agent's page while the agent works, or hours later from the list of past agents, and both times the page says the same thing: a Stop button only while something more may come, the questions it is asking, and how it ended.

**Business logic story**: the dashboard is a projection of the same event stream the agent's tool writes as the agent works — the agent's diary, in its checkout [6] and then on the data branch; the rules here turn that stream into the facts the agent view, the status pill and the actions menu render. The other fold over the same stream (the driver session) lives in `../../src/agent-view.ts`, and the status words built on top of these facts live in `agent-status.ts`.

**Problem**: an agent that is continued — its question answered, a message said to it after it ended — writes on into the same event stream [2], after the `end` of its earlier leg. Facts that would read "was there ever an end" or "which gates are open" off the whole stream would answer with a leg the agent has since left behind, so they are asked of the current segment [7]. Older records open each leg with a `session` event instead, and are cut there.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, in order, as the dashboard reads it off the agent's diary: the file the agent's tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded. Every surface is a projection of it.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[4] stop: ending an agent before it finishes: the Stop button or Ctrl-C.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] segment: one leg of an agent: the events from where the agent was last continued to the end of the stream. The boundary is the last `end` the agent went on after, or, in older records, the last opening `session` event. The latest segment is the agent in progress.
[8] pick: the answer to a gate: the option or options the user chose.
[9] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[10] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[11] status snapshot: the small summary kept beside an agent's event stream, its card: its status, cost, branch and pull request. List surfaces read it instead of replaying the stream.
[12] location: where an agent's turns ran, as its own record names it: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session). Only `local` and a device are offered today; the other two are read off agents recorded before they left the launcher.
[13] coding agent: the CLI doing the actual work: Claude Code or Codex.
[14] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.

## Business logic — TL;DR

- **The current segment** - only the events after the last `end` the agent went on after (or from the latest opening `session` event, in older records) are the agent in progress; a stream with no such boundary counts whole.
- **Open gates** - a question opens with its `choice` event and stays open through an `end` that says the agent is waiting on it; it closes when the agent goes on, and when the agent ends for good. The rule is shared with the daemon.
- **Still going** - the current segment has streamed something and holds no `end` yet; an empty stream is not going.
- **How it ended** - the current segment's `end`: success or failure, whether the user stopped it, whether it waits on an answer, and its detail; nothing while the segment has no end.
- **The GitHub Actions run link** - the latest progress line reading `run <url>`; absent for every other agent.
- **The cloud session** - the latest progress line reading `cloud <url>`, with the session id read off the claude.ai URL.

## Business logic

### The current segment

#### Context

See `## Context`.

#### Business logic

The current segment [7] is the tail of the event stream [2] from its latest boundary to the end of the stream. Reading the stream backwards, the boundary is whichever comes first:

- an `end` event that is followed by an event of the agent's own (its text, its actions, its result): the agent went on after that end, so the end belongs to a leg it has left behind, and the segment starts right after it;
- a `session` event, which opens each leg in older records: the segment starts at it.

An `end` with nothing of the agent's own after it is no boundary: it is how the current leg ended. A stream holding no boundary at all is taken whole. So an agent that ended waiting [3], was answered, and is working again reads as working, and once it finishes it reads by its new end, not by "waiting". The facts below that say "the current segment" are asked of this tail. The live feed shown in the agent view keeps every segment.

### Open gates

#### Context

**User story**: the agent's turn ends on a question with options; the agent ends waiting, and the user sees the question as a card in the transcript and among the open questions, answers it, and the agent goes on.

**Problem**: the agent has ENDED by the time the user reads its question, so "an end closes every question" would make every question unanswerable. But an agent that died or was stopped while holding a question must not stay answerable forever: nobody is left to read its pick [8].

#### Business logic

The rule is the daemon's own, shared with it (`../../src/open-choices.ts`), so the transcript, the open-questions list and the daemon's check of an incoming pick can never disagree. Gates [3] are tracked by id over the events given, in the order they were first asked:

- A `choice` event opens the gate with its id, carrying everything the question needs: its title, its options, the recommended option, whether several options may be picked, and the file under review. Asked again under an id that is already open, the later one replaces the earlier in place.
- An `end` event that says the agent is waiting closes nothing: the agent ended ON the question, and the answer resumes it.
- Any later event of the agent's own (its text, its actions, its result) closes every open gate: the agent went on, so the question was answered, or the user's message took its place.
- Any other `end` — done, stopped, failed — closes every open gate: nobody would read the pick.

The result is the list of gates still open. The transcript uses it to decide which gate rows are answerable cards (`EventList.tsx`), and a gate card is keyed by its id so a re-asked gate starts afresh.

### Still going

#### Context

**User story**: the Stop [4] button is offered only while stopping still means something, and the status pill reads as at work while the agent [1] is going.

**Problem**: a resumed agent's stream carries its earlier segment's [7] `end`, so asking "was there ever an end" over the whole stream hides Stop and settles the pill while the agent works.

#### Business logic

An agent is still going when its current segment holds at least one event and none of them is an `end`. An empty stream is not going. This fact drives:

- the actions menu: whether Stop is offered, and whether the agent still has a checkout [6] of its own (a going agent always does; a finished one only while its work has not reached the remote), which decides whether the menu's folder item opens the agent's own folder;
- the agent view's own verdict that its feed is live, so a resumed agent's continuation renders and Stop takes over from Resume the moment its first event lands, before the daemon's agent list notices;
- the status words in `agent-status.ts`.

### How it ended

#### Context

**User story**: a finished agent's [1] status pill and composer note say whether it finished, failed or was stopped by the user, instead of one "finished" for a crash and a clean pass alike.

**Problem**: a resumed agent's stream holds its stopped segment's [7] `end`; reading the first end ever would keep a resumed agent "stopped" forever, even after it later finished clean.

#### Business logic

The outcome is read off the first `end` event of the current segment: whether it succeeded, whether the user stopped [4] it (only when the end says so explicitly; an end that does not say counts as not stopped), whether it ended waiting on a question (it then reads as waiting, not as failed), and the end's detail text when it carries one. While the current segment has no `end`, because the agent is still going or has just been resumed, there is no outcome at all. The agent view reads the outcome only for an agent that is no longer live.

### The GitHub Actions run link

#### Context

**User story**: an agent [1] whose location [12] is `actions` shows a link to its live workflow run on GitHub, so the user can watch it there while the transcript is still catching up at the end.

#### Business logic

The link is read off the coding agent's [13] progress lines: the Actions driver [10] emits a progress line reading `run <url>` once it has found its workflow run, and the URL must start with `http://` or `https://`. The last such line wins, so an agent with several turns [9] points at its most recent run. The link is absent until the driver has found the run, and absent for every agent not running on GitHub Actions.

### The cloud session

#### Context

**User story**: a hands-off [14] agent's [1] page shows which claude.ai session its task was handed to, as a link. It is read off the events rather than the status snapshot [11] so that a tab opened mid-agent, which replays the events, sees it too.

#### Business logic

A `web` agent's diary carries a progress line reading `cloud <url>`, written by the cloud driver [10] (since removed; such agents are read off their records) once the cloud session [5] existed, where the URL is a claude.ai code session URL of the form `https://claude.ai/code/session_<id>`; the session id is the `session_<id>` part of that URL. The last such line wins, so an agent handed off more than once points at its latest cloud session. Absent when no such line was written. The notice the agent view shows for a `web` agent reads it (`CloudAgentNotice.tsx`), and only for an agent whose location [12] is `web`.
