The runs a scheduled command [1] has, read off the run records [2] on the project's `agent-data` branch [3], so every machine that shares the branch counts the same ones against a command's cap [4] and its interval. A record names only what its run was asked, its prompt; which command of the schedule [5] that is, is decided here, when the records are counted. Only the runs `agent-runner` started, which carry its mark [6], are counted.

## Context

**User story**: two of the user's machines run the same schedule; a command with `cap 1` runs on one of them at a time, whichever ticked first, and the other's state says `cap reached (1 in flight: <id> on <host>)`; a command with `every 6h` starts at most every six hours across both machines; a run the user started by hand from the dashboard with `/work-queue` counts against the `work-queue` line like a scheduled one.

**Business logic story**: the scheduler starts every run through `agent-runner`, which writes the run record, marker first, and names no command on it: the card's intent is the prompt. The scheduler's own runs have the prompt `/<command>`, so reading the command back off the prompt gives the line that started them; a person's run, from a dashboard or a shell, is counted by the same rule. The rule reads the schedule as it is at the time of the count.

## Glossary

[1] command: a schedule line's name, a skill folder's name under `.claude/skills/` and at most one word the skill takes as its argument (`triage quick`).
[2] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`), written by `agent-runner` as a marker before the agent exists and again when the run ends.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] cap: how many runs of one command may be in flight at once, across every machine that shares the repository.
[5] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command.
[6] `agent-runner`'s mark: `caller.runner` on a card, with the machine that started the run.

## Business logic — TL;DR

- **The command a run counts for** - for a card with `agent-runner`'s mark [6] and a prompt: the schedule line the prompt names without its slash, else the prompt's first word without its slash (`schedule.ts`); none for any other card.
- **In flight** - the running cards that count for one command on the branch, whatever the machine; a running card without the mark, a dashboard's own run for instance, is not counted.
- **The last start** - the newest start time among the cards that count for one command on the branch, whatever the machine and whatever became of the run, for the schedule's interval; nothing when the command never started.

## Business logic

### The command a run counts for

#### Context

**Problem**: the run record carries the prompt, not the schedule line that asked for it, and a run a person starts with a scheduled command's prompt must hold that command's cap like a scheduled one.

#### Business logic

A card counts for a command only when it carries `agent-runner`'s mark [6] and a prompt (its intent). The command is then the prompt, trimmed and without a leading `/`, when the schedule has a line of exactly that name (`/triage quick` → `triage quick`); otherwise the prompt's first word without its slash (`/triage` → `triage`, `/work-queue now` → `work-queue`, `/post-merge-cleanup <id>` → `post-merge-cleanup`, `Read the docs` → `Read`); with no schedule file, always the first word. A card without the mark, or without a prompt, counts for no command.

### In flight

#### Context

See `## Context`.

#### Business logic

The runs of one command in flight are the cards on the branch whose status is `running` and that count for that command, on any machine.

### The last start

#### Context

**User story**: `- triage quick: every 6h` starts at most every six hours, whichever machine started the last one, and whether that run ended done, failed or stopped.

#### Business logic

The last start of a command is the newest start time among every card on the branch that counts for the command, whatever its status and whatever the machine; a command no card counts for has none.
