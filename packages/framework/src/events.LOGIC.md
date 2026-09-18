Fixes the vocabulary of the event stream [1]: every kind of event an agent's [2] timeline can carry and what each one says happened. The Framework emits none of them itself — it runs no agent — so this is a reading vocabulary: the lines of an agent's diary are read as these. It also fixes the shape of a gate [3] as the agent emits it. The file decides nothing itself, apart from turning a pick [4] into a list of option ids; its vocabulary is what every surface agrees on.

## Context

**User story**: the user watches an agent [2] in the agent view [5]: everything the coding agent [6] did, in order, the question it stopped at, the spend so far, and how it ended. A tab opened while the agent runs, or after it ended, shows the same story. Everything on that page is read off the events described here.

**Business logic story**: the tool that runs an agent appends every line to the agent's diary in the agent's checkout [7], and copies the diary onto the `agent-data` branch [8] when the agent ends. The dashboard and the terminal are each a projection of that file, read through this vocabulary.

**Problem**: every surface must render the same sequence whichever tool ran the agent. Owning this vocabulary, rather than exposing one tool's transport, is what makes an agent run by one tool and an agent run by another read alike.

## Glossary

[1] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.the-framework/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[2] agent: the unit of work: one task worked by a coding agent, in its own checkout, on its own branch, keeping a card and a diary, publishing its own work when it ends. Begun by the project's own start hook.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[4] pick: the answer to a gate: the option or options chosen.
[5] agent view: one agent's page.
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, and the lasting record of every agent — the `logs` skill's card (what was asked, the branch, the pull request, how it ended, what it cost) and diary (what the agent said).
[9] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[10] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] stop: ending an agent before it finishes: the Stop button or Ctrl-C.

## Business logic — TL;DR

- **The opening events** - the session opening and the session id once known say what the agent is; a continuation opens with its own session opening, so readers keep the latest.
- **The coding agent's progress, forwarded** - every progress event the coding agent reports is forwarded verbatim onto the stream and never decided on.
- **A gate and its pick** - a gate is a question, at least one option and, for a single-select gate, a recommended option; a checklist pre-checks options instead; a pick is one option id or the chosen subset, normalized to a list wherever a list is needed.
- **Spend and the end** - the agent reports its cumulative usage after every turn that reports it, and ends as done, stopped, failed, or waiting on an answer to the question it asked.

## Business logic

### The opening events

#### Context

See `## Context`.

#### Business logic

Two events open an agent's [2] stream:

- The session opening: which driver [9] runs the agent, the checkout [7] it works in, whether the driver is the fake driver, the model the agent was started on when one was chosen, and the session link when it is already known. A continuation (an agent resumed after it ended) emits its own session opening and may run a different model, so a reader keeps the latest model rather than the first. A model left to the coding agent's [6] own default is absent.
- The session id, emitted once the coding agent reports it, since it is not known at the start: the live driver session [11] id and, when there is one, the session link. It is emitted again whenever the id changes, which keeps the link current.

### The coding agent's progress, forwarded

#### Context

**Business logic story**: the coding agent's [6] own loop reports what it does: its text, its tool calls, the start and end of each turn [10].

#### Business logic

Every progress event the driver [9] reports is wrapped and forwarded verbatim onto the stream, so the dashboard and the terminal can show the coding agent [6] working. Nothing is decided from these events.

### A gate and its pick

#### Context

**User story**: the coding agent [6] stops to ask ("Approve this plan?"). The dashboard shows the question as a card with its options, one of them recommended, and the user picks. A checklist question shows checkboxes instead and the user ticks a subset.

#### Business logic

A gate [3], emitted when the agent [2] pauses on a question and waits for a pick [4], carries:

- an id unique to this pending question; the pick is posted back against it;
- the title: the question shown above the options;
- the options, at least one, each with a stable id posted back when picked, a label, and optionally a one-line detail under the label (for instance why an alternative lost);
- for a single-select gate, the recommended option's id, pre-selected in the dashboard;
- for a checklist, a flag marking it as one. A checklist has no single recommended option: each option instead says whether it starts checked, and the pick is the chosen subset of option ids, which may be empty. An option's starting state is ignored for a single-select gate;
- optionally the markdown file under approval (a plan such as `PLAN_<slug>.agent.md`), which the dashboard renders beside the question.

A pick is normalized to a list of option ids wherever a list is needed: a subset is copied as it is, a single option id becomes a one-item list, and an empty id becomes an empty list.

### Spend and the end

#### Context

**User story**: the agent view [5] shows a live readout of what the agent [2] has cost and, once it ends, whether it finished, was stopped, failed, or waits on the user's answer.

#### Business logic

- Usage: the agent's cumulative token counts (input, output, cache reads, cache creation), its turn count and, when priced, its cost in USD, emitted after each turn [10] that reports usage; the dashboard renders it as a live spend readout. The cost is absent when the coding agent [6] reports tokens but no price. Nothing stops an agent for its cost.
- The end: the agent finished. It says whether the agent finished well; when it did not, whether it was stopped [12] by the user rather than failing, so a surface shows "stopped" rather than "failed"; whether it ended waiting on the answer to the gate [3] it asked, which resumes it; and an optional detail.
