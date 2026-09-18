Shows one agent [1] on its own page, the agent view [2], in one frame that stays put whether the agent is running, waiting for an answer or finished: an action bar with the agent's name and the state of its work, the feed of its events [4], notices for work that runs somewhere other than this machine, and the composer [5] for saying something to the agent [6]. Only what those parts say changes: while the agent runs, its events arrive over the live event stream and the bar shows what its checkout [7] has changed; once it stops, the archive [8] of its events is swapped in without blanking the screen, and the bar turns to what its branch holds and what to do with it, the next step [9].

## Context

**User story**: the user opens an agent from the Overview or from a project's history rail and reads what it is doing. The moment the agent ends is the moment the user is most likely to be reading it, so the page must not flinch: nothing is rebuilt, nothing goes blank, the output keeps its place, and the bar simply turns from "what is changing" to "what the branch holds, and what next".

**Problem**: two different things all look like "the agent is done" and the page tells them apart. The daemon's list of agents may lag a couple of seconds behind what the event stream already shows; and a finished agent's archive may be missing, empty, or older than the events already on screen.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] agent view: one agent's page.
[3] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: its status, its branch, its pull request, and what only the daemon knows, such as whether the agent is publishing: ended clean while the tool that runs it still records it and pushes its branch.
[4] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[5] composer: the prompt editor, also used to say something to an agent.
[6] message: the user's own words to an agent, the next prompt of the same conversation: an agent that is working takes it when its turn ends, an ended agent is resumed with it.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[9] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[10] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[16] project home: a project's own page with the launcher (the Start form) and its composer.

## Business logic — TL;DR

- **One frame for a running and a finished agent** - the same action bar, feed, notices and composer stay on screen for the agent's whole life; only their contents follow the agent's state.
- **Which events are shown** - a running agent shows the live event stream; a finished one shows its archive, swapped in behind the events already on screen, and neither an empty nor a stale archive ever replaces what the stream shows.
- **Loading and empty states** - a finished agent whose archive is still being read says "Loading agent…"; a finished agent with no events at all says "This agent has no events."; a running agent with nothing yet simply waits for its first event.
- **Working means running** - the agent counts as working exactly while the daemon's list says it runs; everything that asks "is there more coming?" asks this, so an agent that is not working gets its next step offered.
- **Live as the feed knows it** - the feed follows new output, and the composer offers Stop, as soon as new events stream in, even during the seconds before the daemon's list of agents notices a resumed agent.
- **What the action bar says** - the agent's name with its project as a breadcrumb; the one status word, from the events shown and the agent's card; while working, the counts of what the checkout has changed; once not working, the verdict on what the branch holds and the offered next step.
- **The disclosure** - opening the bar's disclosure adds the agent's details strip and, while working, the changes in its checkout, or, once stopped, the commits and files its branch holds.
- **Removing a kept checkout** - a finished agent that kept its checkout (it failed or was stopped) is offered a Remove, which disappears at once when used.
- **Notices for work that runs elsewhere** - an agent whose turns run on GitHub Actions, in a cloud session, or on a device gets a notice explaining what the feed can and cannot show.
- **The feed and the composer** - a finished feed is static and opens at its end; the composer knows how the agent ended, so it can say what the next message will do and offer a resume.

## Business logic

### One frame for a running and a finished agent

#### Context

See `## Context`.

#### Business logic

The page for one agent [1] always holds, top to bottom: the action bar (`AgentActionBar.tsx`), the optional details strip and the changes or the branch detail behind the bar's disclosure, the notices for work that runs elsewhere, the feed of events [4] (`AgentFeed.tsx`), and the composer [5] (`AgentComposer.tsx`). None of these parts is replaced when the agent's state changes; each is told whether the agent is still running and what it has to show, and adapts its contents.

The agent's name leads the bar: the label the caller passes, the same label the history rail shows (what the user typed, else the session name [10], else the branch, else the start time). The project's name is shown beside it as a `project / session` breadcrumb.

### Which events are shown

#### Context

**Problem**: while an agent runs, its events reach the browser over the live event stream and that stream is the whole truth. Once it ends, the archive [8] is the durable copy, and some events only ever exist there: an agent's last lines are recorded after its checkout [7], and the event file inside it, are gone. But reading the archive at the wrong moment shows the wrong thing: right after a stop [15] the archive may not be written yet, and right after a resume the stream is already ahead of it.

#### Business logic

- While the agent [1] is running, the events shown are the live event stream's. The archive is not read.
- Once the agent is no longer running and its id is known, the archive is read, and it replaces the events on screen only when it holds at least one event. An empty archive never replaces what is on screen: the archive read answers "no events" both for an agent that is gone and for one whose archive is not written yet, and a stop races the archive write.
- A stale archive never wins either. When the stream holds more events than the archive, the stream is shown, and the archive is read again each time the stream outgrows the copy on screen. The archive takes over once it has caught up. This is how a resumed agent's new events render one at a time instead of landing in one jolt, and how the events written only to the archive (the handoff report) reach the screen without the user refreshing the page.
- "The stream holds more" is trusted only when the stream is this agent's own record. It is not always: for an ended agent whose checkout is gone, the live stream is served from the project root's event file, which holds whatever agent last ran there. The archive's first event is the fingerprint the stream's first event has to match; a stream that does not match is never preferred over the archive. An archive that is not loaded yet, or is empty, cannot be checked, and the stream is shown meanwhile.
- Switching to another agent resets the catch-up bookkeeping, so one agent's state never swallows the next one's re-read.

### Loading and empty states

#### Context

**Problem**: "nothing to show yet" means different things for a running and a finished agent, and the two must not share one message.

#### Business logic

- A finished agent [1] whose archive [8] has not answered yet, with no events on screen, shows "Loading agent…" centered in the page.
- A finished agent whose archive has answered but holds nothing shows the feed's empty state with the label "This agent has no events.".
- A running agent with nothing yet shows the feed waiting for its first event, with the feed's own default empty label.

### Working means running

#### Context

**Problem**: an agent that stops on a question does not stay alive waiting: it ends with the status `waiting`, and the answer resumes it. So "is the agent still running" is the whole answer to "is there anything more coming?", and an agent that is waiting for an answer is offered its next step [9] like any finished one.

#### Business logic

An agent [1] counts as working exactly while the daemon's list of agents says it is running. Everything that asks "is there anything more coming?" asks whether the agent is working:

- what the branch holds (the read in `lib/use-agent-handoff.ts`) is only read once the agent is not working: a branch still being written to has nothing to offer yet;
- the bar's action slot is empty while working — an agent that is working publishes its own work — and holds the next step [9] once not working;
- the changes panel reads the checkout [7] while working; the branch's commits and files replace it once not working.

### Live as the feed knows it

#### Context

**Problem**: the daemon's list of agents takes up to two seconds to notice a resumed agent, but its new events are already streaming. Waiting for the list would make the continuation land all at once, or, when the list loses the race entirely, not render until a refresh.

#### Business logic

The feed and the composer [5] are told the agent [1] is live when either the daemon's list says it is running, or the stream on screen is ahead of the archive [8] and has not ended (its current segment carries no end event). That verdict decides whether the feed follows new output and whether the composer offers Stop instead of a resume, so both switch the moment the first new event lands rather than when the daemon's list catches up.

### What the action bar says

#### Context

**User story**: the user glances at the bar and knows what state the agent's work is in, and what the one obvious next thing to do is.

#### Business logic

The bar's summary line:

- While the agent [1] is working: the counts of what its checkout [7] has changed (files changed, lines added, lines removed), reported by the changes panel (`AgentChanges.tsx`).
- Once the agent is not working and the read of what its branch holds has answered: the one-line verdict on the branch (`AgentHandoff.tsx`), followed, in the danger color, by the error of the last next-step [9] action the user pressed in the bar, when one failed.
- Until that read has answered, a just-stopped agent keeps showing the counts it ended with: the summary swaps once, from the live counts to the branch verdict, instead of going blank for the beat the read takes.

The bar's status word, ranked in `lib/agent-status.ts`, is read off the events shown and the agent's card [3]: the caller hands over the agent's card as the daemon's list of agents last reported it, which is what the word needs for "publishing…" and "ready for merge"; before the list holds the agent there is no card, and the word is read off the events alone.

The bar's action slot:

- Nothing while working.
- Once not working: the next step [9] (open a pull request, or merge the one it has) with the state of the branch read (`AgentHandoff.tsx`).

### The disclosure

#### Context

**User story**: the user opens the bar's disclosure to see the facts about this agent [1] (which coding agent, which driver session [11], what it cost) and what it touched.

#### Business logic

The disclosure toggles open and closed from the bar. While open it shows, above the feed:

- the details strip (`AgentDetails.tsx`) with the agent's session and spend facts, in every state;
- while the agent is working: the changes in its checkout [7] (`AgentChanges.tsx`). The changes panel is only shown when the agent's id is known: a read without an id falls back to the project root and would report the user's own uncommitted files as the agent's. A relayed [13] agent's checkout lives on the device [12], and its changes are read there, so it is shown like a local agent's;
- once the agent is not working: the commits and files its branch holds (`AgentHandoff.tsx`).

The changes panel also reports its counts to the bar's summary while the disclosure is closed.

### Removing a kept checkout

#### Context

**Problem**: a finished agent [1] that failed or was stopped keeps its checkout [7] so the user can look at it; a clean one had its checkout removed when it finished. The user needs to be offered the removal exactly when there is something to remove.

#### Business logic

Once the agent is no longer running, the project's list of kept checkouts is read. The bar offers a Remove when that list names this agent. Using it marks the checkout as removed locally at once, so the offer disappears without waiting for the list to be read again. Switching to another agent clears that local mark, so one agent's removal never hides the next agent's offer.

### Notices for work that runs elsewhere

#### Context

**User story**: the user started an agent [1] whose turns run on a GitHub Actions runner, in a cloud session [14], or on a device [12], and the feed does not look like a local agent's. The page says why.

#### Business logic

Where the agent runs is one of: this machine, a GitHub Actions runner, a device the agent is relayed [13] to, or a cloud session. Three notices sit between the disclosure and the feed, each shown only for its own case and absent otherwise:

- a GitHub Actions agent replays its events in a burst at the end, so the feed looks stalled; the notice says the wait is expected and links to the live Actions run (`ActionsRunNotice.tsx`);
- a cloud agent's work happens in a cloud session this machine cannot stream; the notice points at where it is instead of showing an empty feed (`CloudAgentNotice.tsx`), and a mirror row rides the tail of the feed where the story continues;
- a relayed agent's notice only flags that the browser preview stays local, since its changes and its next step [9] relay to the device (`RemoteAgentNotice.tsx`).

### The feed and the composer

#### Context

See `## Context`.

#### Business logic

- The feed follows new output while the agent [1] is live as the feed knows it. A finished agent's feed is static: it does not follow, and it opens at its end, where the outcome, the final spend and the last changes are.
- The health of the live event stream is passed to the feed, which shows a banner over the events when the stream is lost.
- The composer [5] is told: whether the agent is live as the feed knows it; and, once the agent is finished, how it ended: cleanly, with an error, by a stop [15], or waiting on a question, with the detail the end event carries. The composer uses the ending for its note and its resume offer.
- When the composer's message continues this agent after it ended, the shell is told, and the page stays on the same agent as it goes on. When the bar's menu deletes this agent, the page leaves for the project home [16].
