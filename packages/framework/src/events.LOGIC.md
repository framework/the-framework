Fixes the vocabulary of the event stream [1]: every kind of event an agent [2] can emit, what each one says happened, who emits it, and what a reader derives from it. It also fixes the shape of a gate [3] as the agent emits it and of the pick [4] that answers it, the outcomes of the handoff [5] and of the on-before-mergeable follow-up, and the reasons a handoff is skipped, a merge is withheld, or the follow-up declines. The file decides nothing itself, apart from turning a pick into a list of option ids; its vocabulary is what every surface agrees on.

## Context

**User story**: the user watches an agent [2] in the agent view [6]: everything the coding agent [7] did, in order, the questions it stopped at, the views [8] it pushed, the badge flipping from building to ready, the spend so far, and finally what became of the work (a pull request, a merge, or the reason nothing happened). A tab opened while the agent runs, or after it ended, shows the same story. Everything on that page is read off the events described here; nothing about an agent is learned any other way.

**Business logic story**: the agent's process appends every event as one line to `.the-framework/events.jsonl` in the agent's checkout [9]. The dashboard, the terminal, the archive [10] and the run [11] are each a projection of that file: the dashboard's store folds the stream into the agent's current state, and that folded state is the one thing a dashboard tab opened later can read. That is why several facts below travel as events although they are known before the agent starts: a fact that is not an event is a fact a later tab never learns. In the same way, an agent the dashboard started has no terminal anyone reads, so an outcome that is not an event is an outcome nobody learns.

**Problem**: the event stream [1] unifies three sources so that every surface renders the same sequence: The Framework's own status (what the agent is, what it was asked, what became of its work), the coding agent's own progress forwarded as it comes, and what the agent tells the user through its turn signals [12]. Owning the stream, rather than exposing the coding agent's transport, is what keeps every surface identical whichever driver [13] runs the agent.

## Glossary

[1] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[6] agent view: one agent's page.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[9] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[10] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[11] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[12] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[13] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[14] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[15] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[16] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[17] autopilot: the dashboard's "Autopilot" option: while it is on, a gate's recommended option is accepted after a countdown unless the user picks first.
[18] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[19] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[20] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[21] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[22] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[23] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[24] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[25] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[26] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[27] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[28] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[29] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.

## Business logic — TL;DR

- **The opening events** - the session opening, the session id once known, the full system channel and the intent say what the agent is, what it was told and what it was asked; a continuation opens with its own session opening, so readers keep the latest.
- **The coding agent's progress, forwarded** - every progress event the coding agent reports is forwarded verbatim onto the stream and never decided on.
- **What the agent shows the user** - a view updates in place by title, a reported error stays in the log as history, a log line narrates, and the agent's browser travels as a page URL and a stream port only, never as frames.
- **A gate and its pick** - a gate is a question, at least one option and, for a single choice, a recommended option; a checklist pre-checks options instead; the pick is one option id or the chosen subset, and says whether the user, the autopilot countdown or nobody picked.
- **Ready for merge and the pull request text** - the ready-for-merge signal flips the agent from building to ready without blocking it; the pull request title and description the agent wrote travel as an event the handoff uses, the latest one winning.
- **Facts that must survive a reload** - what the handoff is armed to do, the ticket being implemented, the branch and session name, the pull request once opened, and the cloud anchor each travel as events because only an event reaches a tab opened later.
- **The on-before-mergeable outcome** - the follow-up queued its prompts, queued them without finishing cleanly, or declined for one of five reasons; it is silent when the option was off.
- **The handoff outcome** - the handoff is done (pushed, a pull request, how the merge went), skipped for one of nine reasons that are not faults, or failed at the push or at the pull request.
- **How a merge went, and why it is withheld** - GitHub's own auto-merge is preferred, a direct merge is the fallback, the CI watch takes a pull request whose checks are pending, a failed merge never fails the handoff, and a merge is withheld when the agent never said it was ready or its own to-do list is still open.
- **Settled, spend and the end** - the agent says when it is parked on the user, reports its cumulative usage after every turn that reports it, and ends as done, stopped or failed.

## Business logic

### The opening events

#### Context

See `## Context`.

#### Business logic

Four events open an agent's [2] stream:

- The session opening, emitted once before the first turn [14]: which driver [13] runs the agent, the checkout [9] it works in, whether the driver is the fake driver, the model the agent was started on when the user chose one, and the session link when it is already known. A continuation (an agent resumed from a stopped one) emits its own session opening and may run a different model, so a reader keeps the latest model rather than the first. A model left to the coding agent's [7] own default is absent.
- The session id, emitted once the coding agent reports it, since it is not known at the start: the live driver session [15] id and, when the driver has a link template, the session link resolved from it. It is emitted again whenever the id changes, which keeps the link current.
- The system channel's full text, emitted once at the start: exactly what the coding agent was framed with, so the dashboard can show the normally hidden prompt. The per-turn prompts are not repeated here; they arrive inside the forwarded progress events, which carry their text. Shown for transparency, never decided on.
- The intent: what the agent was asked for, emitted once as it opens; every surface titles the agent by it.

### The coding agent's progress, forwarded

#### Context

**Business logic story**: the coding agent's [7] own loop reports what it does: its text, its tool calls, the start and end of each turn [14]. The Framework gates on outcomes, never on those steps.

#### Business logic

Every progress event the driver [13] reports is wrapped and forwarded verbatim onto the stream, so the dashboard and the terminal can show the coding agent [7] working. The Framework decides nothing from these events; what it decides on is the turn's final message, read through the turn signals [12].

### What the agent shows the user

#### Context

**User story**: while the agent [2] works, the user sees a plan or a summary appear in the dashboard's right rail, an error the agent hit stays visible in the timeline, and the agent's browser, when it has one, is watched live in the agent view [6].

#### Business logic

- A view [8]: a markdown document the agent [2] pushed, with a title and an id that is stable per title, so pushing a view with the same title again updates it in place rather than adding a duplicate. Non-blocking: the agent goes on.
- An error: something went wrong that only the user can fix, reported by the agent itself through its error signal, with a headline (the first line) and an optional detail (the rest). It is an event, not a status: it says what happened at that point and stays in the log as history, and nothing clears it, because nothing can undo it. Conditions that are true now and clear themselves once gone (the project-level errors a sweep [16] finds between agents) are a different thing, in `project-errors.ts`.
- A log line: one line of The Framework's own narration ("Finishing the session (await limit reached).", "Handed off: …").
- The browser's page: the URL the agent's browser is showing, emitted for the first real `http` or `https` page and again on every change of page, so the timeline can host the live preview at the point it was used. Only the URL travels. It is emitted again after each session opening, because the dashboard shows only the events since the latest session opening; readers fold repeats of the same URL in place, like a re-shown view.
- The browser stream: the agent's browser preview is up and listening on a loopback port. Only the port travels: the dashboard reaches the stream through the daemon, which proxies to that port, so the agent's own browser endpoint is never reachable from the web. Frames never enter the log, because someone will type a password into that pane.
- A preview: a generated app booted and serving at a URL, with the command that serves it, so the user can open it. The vocabulary defines it and the terminal renders it; no part of the agent's lifecycle emits it today.

### A gate and its pick

#### Context

**User story**: the coding agent [7] stops to ask ("Approve this plan?"). The dashboard shows the question as a card with its options, one of them recommended, and the user picks; or the autopilot [17] countdown accepts the recommended option; or nobody is watching and the recommended option is taken. A checklist question shows checkboxes instead and the user ticks a subset.

#### Business logic

A gate [3], emitted when the agent [2] pauses on a question and waits for a pick [4], carries:

- an id unique to this pending question; the pick is posted back against it;
- the title: the question shown above the options;
- the options, at least one, each with a stable id posted back when picked, a label, and optionally a one-line detail under the label (for instance why an alternative lost);
- for a single choice, the recommended option's id: pre-selected in the dashboard, accepted by the autopilot [17] countdown, and taken when nobody can answer;
- for a checklist, a flag marking it as a multiple choice. A checklist has no single recommended option: each option instead says whether it starts checked, and the pick is the chosen subset of option ids, which may be empty. An option's starting state is ignored for a single choice;
- optionally the delay after which the autopilot countdown accepts the recommended option, 10 seconds by default;
- optionally the markdown file under approval (a plan such as `PLAN_<slug>.agent.md`), which the right rail renders beside the question.

The resolution of a gate is emitted as its own event: the gate's id, what was picked (one option id, or the subset for a checklist), and who picked: the user, the autopilot countdown, or nobody, which is an unattended [18] agent taking the recommended option. A pick that arrives without saying who picked counts as the user's.

A pick is normalized to a list of option ids wherever a list is needed: a subset is copied as it is, a single option id becomes a one-item list, and an empty id becomes an empty list.

### Ready for merge and the pull request text

#### Context

**User story**: the agent view's [6] badge flips from building to ready when the agent [2] believes its work is complete, and the pull request opened at the end carries the title and description the agent wrote.

#### Business logic

- Ready for merge [19]: the agent [2] signaled that it believes the work is complete and ready for human review. Non-blocking: it flips the agent's badge from building to ready, and the on-before-mergeable follow-up hangs off it.
- The pull request text: the title and description the agent asked for through its open-pr signal. This is how an agent opens a pull request through The Framework instead of running `gh pr create` itself, so the ticket's issue reference and the recording of the pull request number still apply. The title is the agent's name for the work and the description is what changed; either may be absent when the agent wrote only the other. Non-blocking; the handoff [5] uses the latest one.

Both are read off a turn's [14] final message as turn signals [12]; the parsing rules are `turn-gate.ts`'s.

### Facts that must survive a reload

#### Context

**Problem**: the dashboard's checkboxes, the ticket an agent [2] was started for and the branch it works on are known to the process that started the agent, but a dashboard tab opened later can only read the agent's folded state, which is built from events alone. Anything that is not an event is lost to that tab.

#### Business logic

- What the handoff [5] is armed to do: whether a push and whether a pull request are armed, and whether a merge is. Emitted at the start and again whenever the dashboard's checkboxes change it, which is what makes the boxes survive a reload. The merge flag has no checkbox and never changes during the agent [2], so every re-emit repeats it; when it is absent it reads as off, the conservative display. It is carried so the armed line can say the most consequential half of the plan: without it, a merge-armed agent would advertise "open a draft PR" and then merge.
- The ticket the agent was started to implement, as a path `tickets/<file>.md` on the `agent-data` branch [20]. Emitted once at the start, and only when The Framework itself chose the ticket: the drain [21] agent whose queue entry links back to the ticket it was queued from. Absent means nobody knows what the agent is implementing, which is the case for every hand-written prompt.
- The branch the agent's work is on, observed off the checkout [9] rather than guessed: emitted at the start with the branch the agent actually begins on, and again whenever a later read finds it changed, since the agent renames its own branch through `branches name`. When the branch carries a session name [22], the event carries it too. The session name is read off the branch by the agent's process, the one writer that knows which branch the checkout was created on; a reader of the stream alone cannot tell that birth branch from a named one. Every surface resolves the branch and the session name from this event first.
- The pull request the agent's work is on, its number and URL, the moment one is opened for it, so that no surface has to guess the pull request from the branch afterwards.
- The cloud anchor [24]: the empty commit an agent whose location [23] is `web` pushed before its task left this machine, unique to the agent. The branch the cloud session [25] later works on is a `claude/*` name of the cloud's own choosing, never the agent's designated branch, and is recognized as the agent's by descending from this commit; the daemon's cloud work adoption matches the anchor against the remote's `claude/*` heads once the cloud session has pushed.

### The on-before-mergeable outcome

#### Context

**User story**: the user ticks the on-before-mergeable option; when the agent [2] says it is ready for merge, a follow-up queues the quality prompts. "I turned it on and nothing happened" must have an answer in the log.

#### Business logic

Emitted only when the option was on, so an agent [2] that never asked for the step stays quiet. One of:

- queued: the follow-up queued the quality prompts;
- incomplete: it queued them but did not finish cleanly;
- skipped, with the reason: the agent never signaled ready for merge [19], so there is nothing to follow up; the agent was stopped [26] rather than finished; the driver [13] is the fake driver, so there is no coding agent [7] to hand the follow-up to; the agent never named its work, so its branch is still the birth branch while every line of the follow-up prompt names the session name [22]; or The Framework cannot find its own program to start the follow-up with.

The step itself is `on-before-mergeable-prompt.ts`'s.

### The handoff outcome

#### Context

**User story**: when an agent [2] ends, the user finds its branch pushed and a pull request opened, or reads in the timeline why nothing was published: a normal end, never a fault. A dashboard-started agent has no terminal anyone reads, so the outcome must be an event.

#### Business logic

What the handoff [5] actually did, as one of:

- done: whether the branch was pushed, the pull request's URL and number when one was opened, and how the merge went when a merge was armed (next section);
- skipped, with the reason and optionally how the merge went. The reasons: the handoff is not armed, since neither a push nor a pull request was asked for (the `local` rung); the branch no longer exists (deleted, or never created); the agent [2] committed nothing the base branch does not already have; the repository has no remote to push to; the branch already has a pull request, and opening a second one is the one mistake this must not make; the branch's pull request is merged or closed and its head is still the branch tip, so everything the agent did already reached a human and there is nothing left to publish (only that exact case: an agent that kept committing after its pull request merged gets a fresh pull request instead); the branch is already on the remote at this commit and only a push was asked for; the agent was stopped [26] rather than finished; or the driver [13] is the fake driver, so there is nothing real to publish;
- failed, at the push step or at the pull request step, with the error.

The handoff itself is `cli.ts`'s.

### How a merge went, and why it is withheld

#### Context

**Problem**: a pull request that merges before its checks pass lands broken code; a merge that fails must not cost the pull request; and a merge the user armed is still only a plan, because the agent's [2] configuration arms the merge while the authorization is the agent's, not the configuration's.

#### Business logic

When the agent [2] was armed for the `merge` rung of the handoff [5], the merge half of the handoff ends in one of:

- auto-armed, the preferred outcome: GitHub's own auto-merge takes the pull request, so it lands when its checks pass rather than before them;
- merged: the fallback where the repository does not allow auto-merge, and the pull request was merged directly;
- watched: GitHub cannot arm the merge and the pull request's checks have not passed yet, so the CI watch [27] takes the pull request and merges it once its checks go green, because merging directly there would land before CI;
- failed, with the error: never a failed handoff, since the pull request exists either way and a human can still merge it by hand;
- withheld: the merge never ran, because it was armed but not authorized, and the pull request opened as a draft for a human instead. The two reasons: the agent never signaled ready for merge [19], so the work was never declared done; or the agent's own to-do list, `TODO_<SESSION_NAME>.agent.md`, still has open entries. The agent queue [28] never withholds a merge: it is decoupled from any one agent.

### Settled, spend and the end

#### Context

**User story**: the agent view [6] shows whether the agent [2] is working or waiting for the user, a live readout of what it has cost, and, once it ends, whether it finished, was stopped or failed.

#### Business logic

- Settled [29]: the work has settled and the agent [2] is parked on the user. Its process is still alive and takes messages, but it does nothing until told. Emitted each time the agent parks and undone by the coding agent's [7] next turn [14] start, so "working or waiting for me" is answerable from the stream rather than from a status that only changes when the agent ends.
- Usage: the agent's cumulative token counts (input, output, cache reads, cache creation), its turn count and, when priced, its cost in USD, emitted after each turn that reports usage; the dashboard renders it as a live spend readout. The cost is absent when the coding agent reports tokens but no price. Nothing stops an agent for its cost: there is no per-agent cost cap.
- The end: the agent finished. It says whether the agent finished well; when it did not, whether it was stopped [26] by the user rather than failing, so a surface shows "stopped" rather than "failed"; and an optional detail.
