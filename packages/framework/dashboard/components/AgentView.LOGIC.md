Shows one agent [1] on its own page, the agent view [2], in one frame that stays put whether the agent is running, settled [3] or finished: an action bar with the agent's name and the state of its work, the feed of its events [4], notices for work that runs somewhere other than this machine, and the composer [5] for live chat [6]. Only what those parts say changes: while the agent runs, its events arrive over the live event stream and the bar shows what its checkout [7] has changed; once it stops, the archive [8] of its events is swapped in without blanking the screen, and the bar turns to what its branch holds and what to do with it, the handoff [9].

## Context

**User story**: the user opens an agent from the Overview or from a project's history rail and reads what it is doing. The moment the agent ends is the moment the user is most likely to be reading it, so the page must not flinch: nothing is rebuilt, nothing goes blank, the output keeps its place, and the bar simply turns from "what is changing" to "what the branch holds, and what next".

**Problem**: three different things all look like "the agent is done" and the page tells them apart. The agent's process may still be alive while its work has settled and it waits for the user; the daemon's list of agents may lag a couple of seconds behind what the event stream already shows; and a finished agent's archive may be missing, empty, or older than the events already on screen.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] agent view: one agent's page.
[3] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[4] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[5] composer: the prompt editor, also used for live chat.
[6] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[9] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[10] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[13] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[14] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[15] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[16] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[17] project home: a project's own page with the launcher (the Start form) and its composer.

## Business logic — TL;DR

- **One frame for a running and a finished agent** - the same action bar, feed, notices and composer stay on screen for the agent's whole life; only their contents follow the agent's state.
- **Which events are shown** - a running agent shows the live event stream; a finished one shows its archive, swapped in behind the events already on screen, and neither an empty nor a stale archive ever replaces what the stream shows.
- **Loading and empty states** - a finished agent whose archive is still being read says "Loading agent…"; a finished agent with no events at all says "This agent has no events."; a running agent with nothing yet simply waits for its first event.
- **Working is not the same as alive** - the agent counts as working only while it runs and has not settled; everything that asks "is there more coming?" asks this, so a settled agent gets its handoff offered instead of arming checkboxes for ever.
- **Live as the feed knows it** - the feed follows new output, and the composer offers Stop, as soon as new events stream in, even during the seconds before the daemon's list of agents notices a resumed agent.
- **What the action bar says** - the agent's name with its project as a breadcrumb; while working, the counts of what the checkout has changed; once stopped, the verdict on what the branch holds, any failed automatic handoff, and the offered next step.
- **What the handoff is armed to do** - the armed levels are read off the events and seeded from the agent's record, so a tab opened halfway through a run reads the same as one that watched it start.
- **The disclosure** - opening the bar's disclosure adds the agent's details strip and, while working, the changes in its checkout, or, once stopped, the commits and files its branch holds.
- **Removing a kept checkout** - a finished agent that kept its checkout (it failed or was stopped) is offered a Remove, which disappears at once when used.
- **Notices for work that runs elsewhere** - an agent whose turns run on GitHub Actions, in a cloud session, or on a device gets a notice explaining what the feed can and cannot show.
- **The feed and the composer** - a finished feed is static and opens at its end; the composer knows how the agent ended, its driver session, and its session name, so it can offer a resume or a follow-up message.

## Business logic

### One frame for a running and a finished agent

#### Context

See `## Context`.

#### Business logic

The page for one agent [1] always holds, top to bottom: the action bar (`AgentActionBar.tsx`), the optional details strip and changes or handoff [9] detail behind the bar's disclosure, the notices for work that runs elsewhere, the feed of events [4] (`AgentFeed.tsx`), and the composer [5] (`AgentComposer.tsx`). None of these parts is replaced when the agent's state changes; each is told whether the agent is still running and what it has to show, and adapts its contents.

The agent's name leads the bar: the session name [10] the caller passes (the same label the history rail shows), or, when none is passed, the session name read off the agent's own events once the agent has named its branch. The project's name is shown beside it as a `project / session` breadcrumb.

### Which events are shown

#### Context

**Problem**: while an agent runs, its events reach the browser over the live event stream and that stream is the whole truth. Once it ends, the archive [8] is the durable copy, and some events only ever exist there: a clean agent's handoff [9] report is written after its checkout [7], and the event file inside it, are gone. But reading the archive at the wrong moment shows the wrong thing: right after a stop [16] the archive may not be written yet, and right after a resume the stream is already ahead of it.

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

### Working is not the same as alive

#### Context

**Problem**: a settled [3] agent stays alive to take the user's next message, so the daemon reports it as running long after it finished. If the page keyed the handoff [9] off "is the process up", a plainly finished agent would show its arming checkboxes for ever and never offer the action they describe.

#### Business logic

An agent [1] counts as working only while it is running and its events say it has not settled. An agent is settled once its events carry the settled signal, and un-settled again when a new turn starts or when the agent ends outright (the rules in `lib/live-state.ts`). Everything that asks "is there anything more coming?" asks whether the agent is working:

- what the branch holds (the handoff read in `lib/use-agent-handoff.ts`) is only read once the agent is not working: a branch still being written to has nothing to hand off yet, but a settled agent's branch is finished work;
- the bar's action slot shows the arming checkboxes while working, and the handoff's next step once not working;
- the changes panel reads the checkout [7] while working; the handoff detail replaces it once not working.

### Live as the feed knows it

#### Context

**Problem**: the daemon's list of agents takes up to two seconds to notice a resumed agent, but its new events are already streaming. Waiting for the list would make the continuation land all at once, or, when the list loses the race entirely, not render until a refresh.

#### Business logic

The feed and the composer [5] are told the agent [1] is live when either the daemon's list says it is running, or the stream on screen is ahead of the archive [8] and has not ended (its current segment carries no end event). That verdict decides whether the feed follows new output and whether the composer offers Stop instead of a resume, so both switch the moment the first new event lands rather than when the daemon's list catches up.

### What the action bar says

#### Context

**User story**: the user glances at the bar and knows what state the agent's work is in, and what the one obvious next thing to do is. If an automatic handoff [9] failed, the user must see that it was tried, not just that the buttons are back.

#### Business logic

The bar's summary line:

- While the agent [1] is working: the counts of what its checkout [7] has changed (files changed, lines added, lines removed), reported by the changes panel (`AgentChanges.tsx`).
- Once the agent is not working and the read of what its branch holds has answered: the one-line verdict on the branch (`AgentHandoff.tsx`), followed, in the danger color, by "auto-handoff failed: <error>" when the armed handoff reported a failure, and by the error of the last handoff action the user pressed in the bar, when one failed.
- Until that read has answered, a just-stopped agent keeps showing the counts it ended with: the summary swaps once, from the live counts to the branch verdict, instead of going blank for the beat the read takes.

The bar's action slot:

- Nothing at all while the agent has no id yet, which is the case right after Start until the daemon's list adopts the new agent.
- While working: the checkboxes arming the handoff (`AgentHandoff.tsx`).
- Once not working: the handoff's next step (push, open a pull request, merge) with the state of the branch read.

### What the handoff is armed to do

#### Context

**Problem**: the agent writes its "handoff armed" event as its very first event, before the live event stream has attached, so a tab that opens on a running agent misses it. Read off the stream alone, an agent the launcher armed push-only would show as armed to open a pull request.

#### Business logic

The armed handoff [9] levels are folded from the agent's events, latest wins, and seeded from the agent's record when the caller passes it: the record's mirror of the armed push and pull-request levels. Without a record the defaults apply (push and pull request armed, merge not). An arming event in the stream still wins over the seed, since it is newer than any record snapshot. The folded state also carries the handoff's result once it has run: done (with the pull request's URL when there is one), skipped (with a reason), or failed (with the error).

### The disclosure

#### Context

**User story**: the user opens the bar's disclosure to see the facts about this agent [1] (which coding agent, which driver session [11], what it cost) and what it touched.

#### Business logic

The disclosure toggles open and closed from the bar. While open it shows, above the feed:

- the details strip (`AgentDetails.tsx`) with the agent's session and spend facts, in every state;
- while the agent is working: the changes in its checkout [7] (`AgentChanges.tsx`). The changes panel is only shown when the agent's id is known: a read without an id falls back to the project root and would report the user's own uncommitted files as the agent's. A relayed [14] agent's checkout lives on the device [13], and its changes are read there, so it is shown like a local agent's;
- once the agent is not working: the commits and files its branch holds (`AgentHandoff.tsx`).

The changes panel also reports its counts to the bar's summary while the disclosure is closed.

### Removing a kept checkout

#### Context

**Problem**: a finished agent [1] that failed or was stopped keeps its checkout [7] so the user can look at it; a clean one had its checkout removed when it finished. The user needs to be offered the removal exactly when there is something to remove.

#### Business logic

Once the agent is no longer running, the project's list of kept checkouts is read. The bar offers a Remove when that list names this agent. Using it marks the checkout as removed locally at once, so the offer disappears without waiting for the list to be read again. Switching to another agent clears that local mark, so one agent's removal never hides the next agent's offer.

### Notices for work that runs elsewhere

#### Context

**User story**: the user started an agent [1] whose turns run on a GitHub Actions runner, in a cloud session [15], or on a device [13], and the feed does not look like a local agent's. The page says why.

#### Business logic

Where the agent runs is one of: this machine, a GitHub Actions runner, a device the agent is relayed [14] to, or a cloud session. Three notices sit between the disclosure and the feed, each shown only for its own case and absent otherwise:

- a GitHub Actions agent replays its events in a burst at the end, so the feed looks stalled; the notice says the wait is expected and links to the live Actions run (`ActionsRunNotice.tsx`);
- a cloud agent's work happens in a cloud session this machine cannot stream; the notice points at where it is instead of showing an empty feed (`CloudAgentNotice.tsx`), and a mirror row rides the tail of the feed where the story continues;
- a relayed agent's notice only flags that the browser preview stays local, since its changes, handoff [9] and push relay to the device (`RemoteAgentNotice.tsx`).

### The feed and the composer

#### Context

See `## Context`.

#### Business logic

- The feed follows new output while the agent [1] is live as the feed knows it. A finished agent's feed is static: it does not follow, and it opens at its end, where the outcome, the final spend and the last changes are.
- The health of the live event stream is passed to the feed, which shows a banner over the events when the stream is lost.
- The composer [5] is told: whether the agent is live as the feed knows it; the driver session [11] id and the driver, read off the events, so it can offer to resume; the session name [10]; and, once the agent is finished, how it ended: cleanly, with an error, or by a stop [16], with the detail the end event carries. The composer uses the ending for its note and its resume offer.
- When the composer starts another agent (a preset or a continuation), the page jumps to it. When the bar's menu deletes this agent, the page leaves for the project home [17].
