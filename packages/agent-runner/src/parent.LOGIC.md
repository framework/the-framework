Telling a run's [1] parent [2] that the run ended: one line saying which run, how it ended, where its work is and its last words, handed to the parent the way a person's message reaches a run: into its inbox [3] while it works, as a resume once it has ended. Nothing waits for a child: the parent's agent ends its turn, and the line is its next prompt.

## Context

**User story**: the user asks one agent for a piece of work it splits up; that agent starts other agents for the parts and ends its turn; each time one of them ends, the first agent goes on by itself, knowing which one ended, how, and what it said last, without the user passing anything along.

**Business logic story**: a run is started for a parent with `run --parent <id>` (`cli.ts`), by the parent's own agent: this tool starts nothing on its own. The parent is on the child's record, in the tool's mark (`records.ts`). The run's process tells the parent once the child's record is written (`run.ts`); the sweep tells it for a child whose process died (`sweep.ts`). How an ended parent is continued, a process of its own, is given by the caller (`runner.ts`).

**Problem**: a process that waited for its children would hold state in memory, and a coding agent's command cannot wait an hour; a parent polling the records would spend turns on nothing.

## Glossary

[1] run: one agent this tool starts: a process of the tool's own (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[2] parent: the run another run was started for (`run --parent <id>`), named on that run's record for its whole life; the run started for it is its child.
[3] inbox: `.openagent/inbox.jsonl` in a run's checkout: the lines from outside the agent, messages and answers, the session sends into the conversation when a turn ends.
[4] live card: the card `<id>.json` under `.openagent/` in a run's checkout, written by the session as the agent works; carries the tool's mark with the run's pid and host.

## Business logic — TL;DR

- **The line** - `The run <id>, started for this run, ended <status>.`, with `: <detail>` before the full stop when the end has one; then, each on its own line and only when there is one: the question a waiting run stopped on, the branch its work is on, its pull request; then, after an empty line, `Its last words:` and the agent's answer on its last turn.
- **A parent that is working** - its live card [4] says `running`, on this machine, under a live process: the line is appended to its inbox [3] as a message, and becomes its next turn when the current one ends.
- **A parent that has ended** - anything else, a parent with no checkout left among them: the parent is continued with the line as its text, in a process of its own; when the caller gave no way to continue a run, nothing is done.
- **A parent that ends meanwhile** - the parent is looked at again after the write to its inbox; when it no longer works, everything still in the inbox is taken back and continues the parent instead, in order, a message as a text and an answer as an answer.
- **Never the child's failure** - anything that goes wrong is one line on the log; the child ended as it ended.

## Business logic

### The line

#### Context

**Problem**: the parent's agent reads the line as a prompt, with nothing else to go by: it must know which of the runs it started this is, whether the work is usable, and where it is.

#### Business logic

The first sentence is `The run <the child's id>, started for this run, ended <status>.`; when the end has a detail (why a run failed, that it was stopped), it reads `ended <status>: <detail>.`. Then, each on a line of its own and only when the end has it:

- `It is waiting on a question: <the question's title>`, its line breaks and runs of white space made single spaces.
- `Its work is on the branch <branch>.`
- `Its pull request: <url>`

When the agent's answer on its last turn is not empty, an empty line follows, then `Its last words:`, then that answer, trimmed.

### A parent that is working

#### Context

See `## Context`.

#### Business logic

The parent is working when the live card [4] in its checkout says `running`, the card's mark names this machine, and the pid in the mark is a live process here. The line is then appended to the parent's inbox [3] as a message. The parent's session takes it when its current turn ends and sends it as the next turn of the same conversation (`agent-driver`'s rule).

### A parent that has ended

#### Context

**Problem**: a parent that started its children and ended its turn has no process and, once reclaimed, no checkout; only its record is left.

#### Business logic

When the parent is not working (its card says it ended, there is no card, the card is another machine's, or its process is dead), it is continued with the line as its text, through the function the caller gave: for the real project, `agent-runner run --resume <parent> <line>` spawned in a process of its own (`runner.ts`), which waits for the parent's lock, so two children ending together continue the parent one after the other. When the caller gave no such function, nothing is done.

### A parent that ends meanwhile

#### Context

**Problem**: a parent that ends between the look at its card and the write to its inbox leaves the line in an inbox nobody reads.

#### Business logic

After the line is appended to the inbox, the parent is looked at again. When it still works, the line is its to take. When it no longer does, the inbox is taken back, every line still there, a person's among them, and each continues the parent in order: a message as a text, an answer as an answer. The parent's own process sends what reached its inbox before its card said ended (`run.ts`), so a line is never sent twice: taking the inbox moves the file aside in one step.

### Never the child's failure

#### Context

See `## Context`.

#### Business logic

Telling the parent never throws. Whatever goes wrong (a parent the project has no record of, a process that cannot be spawned) is logged as `[agent-runner] the parent run <id> could not be told: <the error>`, and the child's status, record and outcome stay as they were.
