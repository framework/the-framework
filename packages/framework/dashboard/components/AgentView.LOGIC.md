Shows one agent [1] on its own page, the agent view [2], in one frame that stays put whether the agent is running, waiting for an answer or finished: an action bar with the agent's name and the state of its work, the feed of its events [4], notices for work that runs somewhere other than this machine, and the composer [5] for saying something to the agent [6]. Only what those parts say changes: while the agent runs, its events arrive over the live event stream and the bar shows what its checkout [7] has changed; once it stops, the archive [8] of its events is swapped in without blanking the screen, and the bar turns to what its branch holds and what to do with it, the next step [9].

## Context

**User story**: the user opens an agent from the Overview or from a project's history rail and reads what it is doing. The moment the agent ends is the moment the user is most likely to be reading it, so the page must not flinch: nothing is rebuilt, nothing goes blank, the output keeps its place, and the bar simply turns from "what is changing" to "what the branch holds, and what next".

**Problem**: two different things all look like "the agent is done" and the page tells them apart. The daemon's list of agents may lag a couple of seconds behind what the event stream already shows; and a finished agent's archive may be missing, empty, or older than the events already on screen.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] agent view: one agent's page.
[3] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: its status, its branch, its pull request, the coding agent and model that ran it, and what only the daemon knows, such as whether the agent is saving: ended clean while the tool that runs it still saves its record and cleans up its checkout.
[4] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[5] composer: the prompt editor, also used to say something to an agent.
[6] message: the user's own words to an agent, the next prompt of the same conversation: an agent that is working takes it when its turn ends, an ended agent is resumed with it.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[9] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[16] project home: a project's own page with the launcher (the Start form) and its composer.
[17] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[18] run slot: a place on an agent's page a module fills: the summary, a few words in the action bar, shown until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the bar. Each is told the agent, whether it is still working, and whether the bar is open.
[19] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent. A subagent opens no pull request: its main agent lands its work, which merges it into the main agent's own branch.

## Business logic — TL;DR

- **One frame for a running and a finished agent** - the same action bar, feed, notices and composer stay on screen for the agent's whole life; only their contents follow the agent's state.
- **Which events are shown** - a running agent shows the live event stream; a finished one shows its archive, swapped in behind the events already on screen, and neither an empty nor a stale archive ever replaces what the stream shows.
- **The message just sent** - a message sent to an ended agent is shown at once as the feed's last prompt, until the prompt line of its continuation arrives; switching agents drops it. So is the prompt the page just started an agent with, until the agent's first prompt line arrives: the run writes it only once its record is saved and its checkout made.
- **The working spinner** - while the agent works, or a message just sent is on its way, the feed is told to close with a spinner row.
- **The message being written** - handed to the feed only while the feed is live, so a finished agent never shows one.
- **Loading and empty states** - on a first visit the feed stays blank until the agent's own events are in, then fills in one step; a finished agent whose archive is still being read after a second says "Loading agent…"; a finished agent with no events at all says "This agent has no events."; a running agent with nothing yet simply waits for its first event.
- **Working means running** - the agent counts as working exactly while the daemon's list says it runs; everything that asks "is there more coming?" asks this, so an agent that is not working gets its next step offered. Before the list is read, whether the agent runs is not known, and nothing that depends on it is read or offered.
- **Live as the feed knows it** - the feed follows new output, and the composer offers Stop, as soon as new events stream in, even during the seconds before the daemon's list of agents notices a resumed agent.
- **What the action bar says** - the agent's name with its project as a breadcrumb; the one status word, from the events shown and the agent's card; until the branch's verdict is read, the installed modules' summaries (the Files module's count of what the checkout has changed); once not working, the verdict on what the branch holds and the offered next step; for a subagent [19], no next step, and in its place whether its main agent landed its work.
- **Switching between agents** - the bar names the agent at once and shows its facts together once its own reads are in (at most a second later); an agent seen before shows its archive, its branch verdict and its facts at once, as last read, while they are read again.
- **The disclosure** - opening the bar's disclosure adds the agent's details strip and, once stopped, the commits and files its branch holds; the installed modules' details sit under the bar in every state, told whether it is open (the Files module shows a working agent's changed files there).
- **Removing a kept checkout** - a finished agent that kept its checkout (it failed or was stopped) is offered a Remove, which disappears at once when used.
- **Notices for work that runs elsewhere** - an agent whose turns run on GitHub Actions, in a cloud session, or on a device gets a notice explaining what the feed can and cannot show.
- **The agent's subagents** - the agent's subagents [19] are handed to the feed, which gives each its rows; while any of them is `running`, what each is doing now is read every 2 seconds, and a line above the composer says how many are running; while any of them holds the agent's job (it is `running`, it is saving, or it ended less than 10 seconds ago), the agent reads as waiting for its subagents in the action bar and the composer, its next step is not offered, and its last clean end is not shown as the end.
- **The feed and the composer** - a finished feed is static and opens at its end; the composer knows how the agent ended, so it can say what the next message will do and offer a resume.

## Business logic

### One frame for a running and a finished agent

#### Context

See `## Context`.

#### Business logic

The page for one agent [1] always holds, top to bottom: the action bar (`AgentActionBar.tsx`), the optional details strip and the changes or the branch detail behind the bar's disclosure, the notices for work that runs elsewhere, the feed of events [4] (`AgentFeed.tsx`), the subagents line while one of the agent's subagents [19] is working (see "The agent's subagents"), and the composer [5] (`AgentComposer.tsx`). None of these parts is replaced when the agent's state changes; each is told whether the agent is still running and what it has to show, and adapts its contents.

The agent's name leads the bar: the label the caller passes, the same label the history rail shows (what the user typed, else the branch, else the start time; for a subagent [19], its task: the first line of that). The project's name is shown beside it as a `project / session` breadcrumb.

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

**User story**: the user opens an agent they have not opened before. The feed used to pass through what each read still out had to say before the agent's events landed: "Waiting for the session to start…" while the daemon's list of agents was not read yet, the live event stream's events (for an agent whose checkout is gone, the project root's event file, another agent's), then "Loading agent…", then the events. Now it stays blank for that moment and fills in once.

#### Business logic

- The feed shows nothing, no events and no message, until one of these holds for the selected agent [1]: it is known to be running; its archive [8] has answered; one second has passed since it was selected. Once the feed has shown an agent, it keeps showing it: an agent that stops while the user watches keeps its events on screen while its archive is read. An agent seen before, whose archive is remembered, shows at once.
- A finished agent whose archive has not answered after that second, with no events on screen, shows "Loading agent…" centered in the page.
- A finished agent whose archive has answered but holds nothing shows the feed's empty state with the label "This agent has no events.".
- A running agent with nothing yet shows the feed waiting for its first event, with the feed's own default empty label.

### Working means running

#### Context

**Problem**: an agent that stops on a question does not stay alive waiting: it ends with the status `waiting`, and the answer resumes it. So "is the agent still running" is the whole answer to "is there anything more coming?", and an agent that is waiting for an answer is offered its next step [9] like any finished one.

#### Business logic

An agent [1] counts as working exactly while the daemon's list of agents says it is running. Everything that asks "is there anything more coming?" asks whether the agent is working:

- what the branch holds (the read in `lib/use-agent-handoff.ts`) is read once the agent is not working: a branch still being written to has nothing to offer yet. While its card [3] is marked saving, its checkout is being cleaned up, which deletes a branch that holds nothing, so a next step offered then would be gone moments later: the answer is shown then only for a branch with commits of its own, pushed or not, which the clean-up keeps, and the branch is read again the moment the mark is gone;
- the bar's action slot is empty while working — an agent that is working is still writing its branch — and holds the next step [9] once not working and no subagent [19] holds the agent's job (see "The agent's subagents");
- the modules' run slots [18] are told whether the agent works: the Files module reads the checkout [7] only while it does; the branch's commits and files take over once not working.

Until the daemon's list of agents has been read (an agent opened from the Overview, or from a link, before its project's list has answered), whether the agent runs is not known: it counts as neither working nor ended. Its archive, its branch and the project's kept checkouts are not read, the bar offers nothing and waits (see "Switching between agents"), and the feed stays blank until the list is read or a second has passed, then shows the live event stream's events.

### Live as the feed knows it

#### Context

**Problem**: the daemon's list of agents takes up to two seconds to notice a resumed agent, but its new events are already streaming. Waiting for the list would make the continuation land all at once, or, when the list loses the race entirely, not render until a refresh.

#### Business logic

The feed and the composer [5] are told the agent [1] is live when either the daemon's list says it is running, or the stream on screen is ahead of the archive [8] and has not ended (its current segment carries no end event). That verdict decides whether the feed follows new output and whether the composer offers Stop instead of a resume, so both switch the moment the first new event lands rather than when the daemon's list catches up.

### Switching between agents

#### Context

**User story**: switching between agents in the left rail, the user used to see the bar fill in over several steps, with facts left from the previous agent under the new agent's name for a moment. Now the bar shows the name at once and the facts together, and an agent seen before shows at once while it is read again.

#### Business logic

The bar is told its facts are ready when any of these holds:

- the agent [1] is working: its live event stream is its record, nothing more to wait for;
- its archive [8] has answered, and so has the read of what its branch holds, including its pull request lookup (while the daemon reports that lookup as still out, the bar would offer nothing, so the facts wait for it rather than land in two steps), unless its card [3] is marked saving, when that read is not made;
- one second has passed since this agent was selected: a read that has not answered by then holds the bar back no longer, and the facts that are in show.

Until then the bar shows the agent's name and project only (see `AgentActionBar.tsx`).

The archive, the read of what the branch holds (`lib/use-agent-handoff.ts`), the project's list of kept checkouts and the branch facts (`GitStatusBar.tsx`) are remembered per agent for as long as the page is open (`lib/use-async.ts`). Going back to an agent seen before shows them from the first frame, so the bar is ready at once, and each is read again all the same, its fresh answer replacing the remembered one as soon as it lands.

### What the action bar says

#### Context

**User story**: the user glances at the bar and knows what state the agent's work is in, and what the one obvious next thing to do is.

#### Business logic

The bar's summary line:

- Until the agent is not working and the read of what its branch holds has answered: the summary run slot [18] of every installed module [17] the project has, each told the agent, whether it is working and whether the disclosure is open. The Files module's says what the agent's checkout [7] has changed (files changed, lines added, lines removed).
- Once the agent is not working and the read of what its branch holds has answered: the one-line verdict on the branch (`AgentHandoff.tsx`), followed, in the danger color, by the error of the last next-step [9] action the user pressed in the bar, when one failed.
- Until that read has answered, a just-stopped agent keeps showing the modules' summaries (the Files module keeps the counts the agent ended with): the summary swaps once, to the branch verdict, instead of going blank for the beat the read takes.

The bar's status word, ranked in `lib/agent-status.ts`, is read off the events shown and the agent's card [3]: the caller hands over the agent's card as the daemon's list of agents last reported it, which is what the word needs for "saving…" and "ready for merge", and the number of the agent's subagents [19] that hold its job, for "<N> subagents running"; before the list holds the agent there is no card, and the word is read off the events alone. The same card is handed to the details strip, which names the coding agent and model off it.

The bar's action slot:

- Nothing while working.
- Once not working: the next step [9] (open a pull request, or merge the one it has) with the state of the branch read (`AgentHandoff.tsx`).
- For a subagent [19], an agent whose card [3] names a parent: no next step, whatever its branch holds. The page tells the verdict and the action slot that the agent is a subagent, and the slot then says "landed" or "not landed", or names the work the subagent left uncommitted (`AgentHandoff.tsx`). The verdict never says "pushed" or "not published" for it.
- Nothing, still, while a subagent [19] holds the agent's job: the agent has ended its own turn but goes on as each subagent ends, and a next step offered then appeared and disappeared between its turns.

### The disclosure

#### Context

**User story**: the user opens the bar's disclosure to see the facts about this agent [1] (which coding agent, which driver session [11], what it cost) and what it touched.

#### Business logic

The disclosure toggles open and closed from the bar. While open it shows, above the feed:

- the details strip (`AgentDetails.tsx`) with the coding agent and model off the agent's card [3] and the spend off its events, in every state;
- once the agent is not working: the commits and files its branch holds (`AgentHandoff.tsx`).

Under the bar, in every state and whether the disclosure is open or not, sits the details run slot [18] of every installed module [17] the project has, told the agent, whether it is working and whether the disclosure is open; each decides what it shows. The Files module's lists a working agent's changed files while the disclosure is open. A relayed [13] agent's checkout lives on the device [12], and a module's reads about it are made there, so it is shown like a local agent's. A module's slot that throws shows its own error line and leaves the rest of the page standing.

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

### The agent's subagents

#### Context

**User story**: the user asked one agent for work it split across subagents [19] (the `orchestration` skill). On that agent's page the user follows every subagent without leaving: a row per subagent in the transcript, saying what it is doing at this moment, and a line above the composer [5] counting the ones still working.

**Problem**: the main agent ends its turn after starting its subagents, so its own page went quiet while they worked.

#### Business logic

The caller hands the page the agent's subagents, oldest first, as the project's list of agents last reported them, and how to open another agent of the project; an agent with no subagents gets none, and nothing below shows.

- The subagents, and the way to open one, are passed to the feed, whose transcript gives each subagent a row where it was started and reads the message that told the agent a subagent ended as the subagent's row (`EventList.tsx`).
- While at least one subagent's status is `running`, the daemon is asked every 2 seconds, the pace of the project's list of agents, what each running subagent is doing now, and the answer is passed to the feed and to the subagents line. When the set of running subagents changes, the last answer stays on screen until the next one lands. While none is running, nothing is asked.
- Between the feed and the composer sits the subagents line (`SubagentLine.tsx`): "Subagents · N of M running", opening to one line per subagent, shown only while a subagent is `running`. It is folded until the user opens it, per agent: opened for one main agent, it is folded again on the next agent's page.
- The subagents that hold the agent's job are counted (the rule in `lib/subagents.ts`: a subagent holds it while it is `running`, it is saving, or it ended less than 10 seconds ago). A main agent never waits in a process: it ends its turn after starting its subagents and is continued each time one of them ends, a few seconds after that subagent's card says it ended. So its record says `done` while the work it was asked for is still going, and the page said "finished" and "Agent ended" and offered "Publish & Open PR" between its turns. While the count is above zero: the action bar's status word reads "<N> subagents running" for an agent that ended clean (`lib/agent-status.ts`); the composer's line above the box reads "Waiting for its subagents — it continues as each one ends, or now with your next message." (`AgentComposer.tsx`); the bar's action slot offers no next step [9]; and the feed is told the job is still going, so the transcript does not show the agent's last clean end as its end (`EventList.tsx`).
- The line above the composer and the reading of what subagents are doing count only the subagents whose status is `running`, not the ones that merely hold the job.

A click on a subagent, in the transcript or in the subagents line, opens that subagent's own page.

### The feed and the composer

#### Context

See `## Context`.

#### Business logic

- The feed follows new output while the agent [1] is live as the feed knows it. A finished agent's feed is static: it does not follow, and it opens at its end, where the outcome and the last changes are.
- The health of the live event stream is passed to the feed, which shows a banner over the events when the stream is lost.
- The composer [5] is told: whether the agent is live as the feed knows it; and, once the agent is finished, how it ended: cleanly, with an error, by a stop [15], or waiting on a question, with the detail the end event carries. The composer uses the ending for its note and its resume offer.
- When the composer's message continues this agent after it ended, the shell is told, and the page stays on the same agent as it goes on. When the bar's menu deletes this agent, the page leaves for the project home [16].
