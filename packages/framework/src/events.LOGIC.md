Fixes the vocabulary of the event stream [1]: every kind of event an agent's [2] timeline can carry, what each one says happened, and what a reader derives from it. OpenAgent emits none of them itself — it runs no agent — so this is a reading vocabulary: the lines of an agent's diary are read as these, and the kinds no diary yields are the ones agents recorded before OpenAgent stopped running them, which still render. A kind that has left this vocabulary is not read at all: an old agent's lines of that kind show nothing. It also fixes the shape of a gate [3] as the agent emits it and of the pick [4] that answers it. The file decides nothing itself, apart from turning a pick into a list of option ids; its vocabulary is what every surface agrees on.

## Context

**User story**: the user watches an agent [2] in the agent view [6]: everything the coding agent [7] did, in order, the questions it stopped at, the views [8] it pushed, the spend so far, and finally the pull request the work is on. A tab opened while the agent runs, or after it ended, shows the same story. Everything on that page is read off the events described here; nothing about an agent is learned any other way.

**Business logic story**: the tool that runs an agent appends every line to the agent's diary in the agent's checkout [9], and copies the diary onto the `agent-data` branch [10] when the agent ends. The dashboard and the terminal are each a projection of that file, read through this vocabulary. An agent the dashboard started has no terminal anyone reads, so anything the user is to learn about it has to be a line in the diary.

**Problem**: every surface must render the same sequence whichever tool ran the agent. Owning this vocabulary, rather than exposing one tool's transport, is what makes an agent run by one tool and an agent run by another read alike — and what lets an agent recorded a year ago still render beside one working now.

## Glossary

[1] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.openagent/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[2] agent: the unit of work: one task worked by a coding agent, in its own checkout, on its own branch, keeping a card and a diary, publishing its own work only when asked to. Begun by the project's own start hook.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[6] agent view: one agent's page.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[9] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[10] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, and the lasting record of every agent — the `logs` skill's card (what was asked, the branch, the pull request, how it ended, what it cost) and diary (what the agent said).
[12] turn signals: what OpenAgent reads off a turn's final message: markdown views, reported errors, and the gate it stops at.
[13] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude-code` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[14] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[15] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[16] sweep: a background job the daemon runs on its clock: the CI watch, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[17] unattended: said of an agent nobody is watching: one the scheduler started rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.
[19] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[20] the queued work: one agent started with `/work-queue`, which takes one task off the agent queue by composing the skills in its checkout.
[22] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[23] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[24] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[25] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[28] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.

## Business logic — TL;DR

- **The opening events** - the session opening, the session id once known and the intent say what the agent is and what it was asked; a continuation opens with its own session opening, so readers keep the latest.
- **The coding agent's progress, forwarded** - every progress event the coding agent reports is forwarded verbatim onto the stream and never decided on.
- **What the agent shows the user** - a view updates in place by title, a reported error stays in the log as history, a log line narrates, and a screen a command the agent ran is showing travels as its address and a label only, never as frames.
- **A gate and its pick** - a gate is a question, at least one option and, for a single-select gate, a recommended option; a checklist pre-checks options instead; the pick is one option id or the chosen subset, and says whether the user or nobody picked.
- **Facts that must survive a reload** - the branch, the pull request once opened, and the cloud anchor each travel as events because only an event reaches a tab opened later.
- **Settled, spend and the end** - the agent says when it is parked on the user, reports the price of every turn it priced, and ends as done, stopped, failed, or waiting on an answer to the question it asked.
- **When each event was written** - any event may carry the time its diary line was written; an event read from a line with no time carries none.

## Business logic

### The opening events

#### Context

See `## Context`.

#### Business logic

Three events open an agent's [2] stream:

- The session opening, emitted once before the first turn [14]: which driver [13] runs the agent, the checkout [9] it works in, whether the driver is the fake driver, the model the agent was started on when the user chose one, and the session link when it is already known. A continuation (an agent resumed from a stopped one) emits its own session opening and may run a different model, so a reader keeps the latest model rather than the first. A model left to the coding agent's [7] own default is absent.
- The session id, emitted once the coding agent reports it, since it is not known at the start: the live driver session [15] id and, when the driver has a link template, the session link resolved from it. It is emitted again whenever the id changes, which keeps the link current.
- The intent: what the agent was asked for, emitted once as it opens; every surface titles the agent by it.

### The coding agent's progress, forwarded

#### Context

**Business logic story**: the coding agent's [7] own loop reports what it does: its text, its tool calls, the start and end of each turn [14]. OpenAgent gates on outcomes, never on those steps.

#### Business logic

Every progress event the driver [13] reports is wrapped and forwarded verbatim onto the stream, so the dashboard and the terminal can show the coding agent [7] working. OpenAgent decides nothing from these events; what it decides on is the turn's final message, read through the turn signals [12].

### What the agent shows the user

#### Context

**User story**: while the agent [2] works, the user sees a plan or a summary appear in the dashboard's right rail, an error the agent hit stays visible on the page, and a screen a command the agent ran is showing, such as its browser, is watched and used live in the agent view [6], where the agent used it.

#### Business logic

- A view [8]: a markdown document the agent [2] pushed, with a title and an id that is stable per title, so pushing a view with the same title again updates it in place rather than adding a duplicate. Non-blocking: the agent goes on.
- An error: something went wrong that only the user can fix, reported by the agent itself through its error signal, with a headline (the first line) and an optional detail (the rest). It is an event, not a status: it says what happened at that point and stays in the log as history, and nothing clears it, because nothing can undo it. Conditions that are true now and clear themselves once gone (the project-level errors a sweep [16] finds between agents) are a different thing, in `project-errors.ts`.
- A log line: one line of OpenAgent's own narration ("Finishing the session (await limit reached).", "Handed off: …").
- A screen: a live page something the agent ran is showing (a browser, say), with its address and a label naming what it showed at that moment ("browser · <page address>"). The line is not written by the tool that runs the agent: the command itself appends it to the diary, whose path the agent's environment carries (`AGENT_DIARY`, agent-driver's rule), and OpenAgent knows nothing of what the page is. The same address with `ended` says the screen has gone. The dashboard shows the newest line at an address as the live page when the address is on this machine's loopback and neither an `ended` line for that address nor an end of the agent follows it; only the address and the label travel, never frames.

### A gate and its pick

#### Context

**User story**: the coding agent [7] stops to ask ("Approve this plan?"). The dashboard shows the question as a card with its options, one of them recommended, and the user picks; or nobody is watching and the recommended option is taken. A checklist question shows checkboxes instead and the user ticks a subset.

#### Business logic

A gate [3], emitted when the agent [2] pauses on a question and waits for a pick [4], carries:

- an id unique to this pending question; the pick is posted back against it;
- the title: the question shown above the options;
- the options, at least one, each with a stable id posted back when picked, a label, and optionally a one-line detail under the label (for instance why an alternative lost);
- for a single-select gate, the recommended option's id: pre-selected in the dashboard, and taken when nobody can answer;
- for a checklist, a flag marking it as one. A checklist has no single recommended option: each option instead says whether it starts checked, and the pick is the chosen subset of option ids, which may be empty. An option's starting state is ignored for a single-select gate;
- optionally the markdown file under approval (a plan such as `PLAN_<slug>.agent.md`), which the right rail renders beside the question.

The resolution of a gate is emitted as its own event: the gate's id, what was picked (one option id, or the subset for a checklist), and who picked: the user, or nobody, which is an unattended [17] agent taking the recommended option. A pick that arrives without saying who picked counts as the user's.

A pick is normalized to a list of option ids wherever a list is needed: a subset is copied as it is, a single option id becomes a one-item list, and an empty id becomes an empty list.

### Facts that must survive a reload

#### Context

**Problem**: the branch an agent [2] works on is known to the process that started the agent, but a dashboard tab opened later can only read the agent's folded state, which is built from events alone. Anything that is not an event is lost to that tab.

#### Business logic

- The branch the agent's work is on, observed off the checkout [9] rather than guessed: emitted at the start with the branch the agent actually begins on, and again whenever a later read finds it changed, since the agent renames its own branch through `branches name`. Every surface resolves the branch from this event first.
- The pull request the agent's work is on, its number and URL, the moment one is opened for it, so that no surface has to guess the pull request from the branch afterwards.
- The cloud anchor [23]: the empty commit an agent whose location [22] is `web` pushed before its task left this machine, unique to the agent. The branch the cloud session [24] later works on is a `claude/*` name of the cloud's own choosing, never the agent's designated branch, and is recognized as the agent's by descending from this commit; the daemon's cloud work adoption matches the anchor against the remote's `claude/*` heads once the cloud session has pushed.

### Settled, spend and the end

#### Context

**User story**: the agent view [6] shows whether the agent [2] is working or waiting for the user, a live readout of what it has cost, and, once it ends, whether it finished, was stopped or failed.

#### Business logic

- Settled [28]: the work has settled and the agent [2] is parked on the user. Its process is still alive and takes messages, but it does nothing until told. Emitted each time the agent parks and undone by the coding agent's [7] next turn [14] start, so "working or waiting for me" is answerable from the stream rather than from a status that only changes when the agent ends.
- Usage: the price of one turn [14] in USD, one event per turn the coding agent [7] priced, as the agent's record keeps it; the record keeps no token counts, so a turn without a price has no usage event. The dashboard adds the events up into its spend readout. Nothing stops an agent for its cost: there is no per-agent cost cap.
- The end: the agent finished. It says whether the agent finished well; when it did not, whether it was stopped [25] by the user rather than failing, so a surface shows "stopped" rather than "failed"; and an optional detail.

### When each event was written

#### Context

**User story**: the agent view [6] shows when each thing happened, and shows the same times while the agent [2] runs, after a reload, and once it has ended.

#### Business logic

Every kind of event may carry `at`: the time its diary line was written, as an ISO 8601 timestamp. An event read from a diary line that has `at` carries it; an event read from a line written before the diary kept times carries none.
