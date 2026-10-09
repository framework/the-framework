The runs a scheduled command [1] has, read off the run records [2] on the project's `agent-data` branch [3], so every machine that shares the branch counts the same ones against a skill's command's cap [4] and its interval; the runs of an automation kept on this machine [7] are counted on the machine that started them alone. A record names only what its run was asked, its prompt; which command of the schedule [5] that is, is decided here, when the records are counted. Only the runs `agent-runner` started, which carry its mark [6], are counted.

## Context

**User story**: two of the user's machines run the same schedule; a command with a cap of 1 runs on one of them at a time, whichever ticked first, and the other's state says `cap reached (1 in flight: <id> on <host>)`; a command scheduled with `every: 6h` starts at most every six hours across both machines; a run the user started by hand from the dashboard with `/work-queue` counts against the scheduled command `work-queue` like a scheduled run.

**User story**: the user keeps an automation on this machine [7], `answer-comments`, and a teammate keeps another one under the same name on theirs. Both machines' runs are on the shared branch with the same prompt, the name. Each machine counts its own: the teammate's run in flight does not hold the user's automation back, and does not move the time the user's check asks from.

**Business logic story**: the scheduler starts every run through `agent-runner`, which writes the run record, marker first, and names no command on it: the card's intent is the prompt. The scheduler's own runs have the prompt `/<command>`, or, for an automation kept on this machine [7], the automation's name with no slash, so reading the command back off the prompt gives the scheduled command they were started for; a person's run, from a dashboard or a shell, is counted by the same rule. The rule reads the schedule as it is at the time of the count.

## Glossary

[1] command: a scheduled command, one command a skill schedules: the skill's folder name and at most one word the skill takes as its argument (`triage quick`). An automation kept on this machine [7] is a scheduled command too, named as its file, with no word after the name: no skill schedules it, and a run of it has that name as its prompt, with no slash, and is handed its text with it. Its runs are counted on this machine alone.
[2] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`), written by `agent-runner` as a marker before the agent exists and again when the run ends.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none.
[5] the schedule: all the scheduled commands of a project. A skill of the project brings its own with the `schedule` key in the front matter of its `SKILL.md`, called the skill's `schedule`. An automation kept on this machine [7] is one more scheduled command, read from its own file.
[6] `agent-runner`'s mark: `caller.runner` on a card, with the machine that started the run.
[7] automation: a person's own prompt saved as a scheduled command, with the `schedule` the person picked (the key where a skill says when its command is due), an interval, a check (a shell line whose output says whether the command is due) or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.

## Business logic — TL;DR

- **The command a run counts for** - for a card with `agent-runner`'s mark [6] and a prompt: the skill's command a prompt that opens with a slash names, else the one its first word is; the automation kept on this machine [7] whose name a prompt with no slash is, and only for a run this machine started (`schedule.ts`); none for a prompt that names no scheduled command, and none for any other card.
- **In flight** - the running cards that count for one command on the branch: whatever the machine for a skill's command, this machine's alone for an automation kept on this machine; a running card without the mark, a dashboard's own run for instance, is not counted.
- **The last start** - the newest start time among the cards that count for one command on the branch, whatever became of the run, whatever the machine for a skill's command and this machine's alone for an automation kept on this machine, a card whose start time is no time left out, for the schedule's interval, for the pace a person set for the command on this machine (`pace.ts`), and for the time the command's check is given as `$LAST_RUN` (`tick.ts`); nothing when the command never started.

## Business logic

### The command a run counts for

#### Context

**Problem**: the run record carries the prompt, not the scheduled command it was started for, and a run a person starts with a scheduled command's prompt must hold that command's cap like a scheduled one.

**Problem**: an automation kept on this machine [7] is one person's, and another person may keep another one under the same name on their machine. Both machines' runs are on the same branch, with the same prompt.

#### Business logic

A card counts for a command only when it carries `agent-runner`'s mark [6] and a prompt (its intent). Which command the prompt names is `schedule.ts`'s rule. A prompt that opens with a slash names a skill's command: the skill's scheduled command whose name it is without the slash (`/triage quick` → `triage quick`), else the one its first word is (`/work-queue now` → `work-queue`, `/post-merge-cleanup <id>` → `post-merge-cleanup`, `/triage other` → `triage` where the skill schedules `triage` too). A prompt with no slash names an automation kept on this machine [7], and only when it is that automation's name and nothing else (`answer-comments`). Any other prompt names no command, and its card counts for none: `Read the docs`, `work-queue` typed with no slash, `/review the open pull requests` where nothing schedules `review`, and every prompt in a project with no scheduled command. A card without the mark, or without a prompt, counts for no command either.

A card whose prompt names a skill's command counts for it whichever machine started the run. A card whose prompt names an automation kept on this machine counts for it only when the mark names this machine, by its host name, as the one that started the run. A run another machine started under that name is another person's automation, and counts for nothing here.

So the runs of an automation kept on this machine count for it by its name, whatever its text was when they ran: a person who changes the text keeps the automation's last start and its runs in flight. A run a person started with that very text as a plain prompt, with a prompt that only starts with the name, or with the name typed as a command (`/answer-comments`), is no run of the automation.

### In flight

#### Context

See `## Context`.

#### Business logic

The runs of one command in flight are the cards on the branch whose status is `running` and that count for that command (above): on any machine for a skill's command, started by this machine for an automation kept on this machine [7].

### The last start

#### Context

**User story**: `triage quick`, scheduled with `every: 6h`, starts at most every six hours, whichever machine started the last one, and whether that run ended done, failed or stopped. A command's check that asks what is new since `$LAST_RUN` is given this same last start (`tick.ts`).

**Business logic story**: the start time on a scheduled run's card is the moment the tick turned to the run's command, before the command's check ran, not the seconds later the run's process began: the tick writes that moment on the marker and gives it to the run, which keeps it as its record's start (`tick.ts`, `agent-runner`'s `run --started`). So a check that asks what is new since the last start misses nothing that came in between.

**Problem**: a run record is a file on a branch, which a person can write by hand. A card whose start time is no time must not stop the tick.

#### Business logic

The last start of a command is the newest start time among every card on the branch that counts for the command (above), whatever its status: whatever the machine for a skill's command, this machine's cards alone for an automation kept on this machine [7]. A command no card counts for has none. A card whose start time is not a time as `names.ts` reads one (an ISO date and time; the word `yesterday` is none) is not counted. The same last start is what a command's pace is counted from (`pace.ts`) and what its check is given as `$LAST_RUN`, unless this machine switched the command on later (`tick.ts`).
