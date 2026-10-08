What the module knows of a project's scheduler and how it changes it: one project's row [6] per project, made from what `agent-scheduler status` printed, the spend cushion [3] in force across projects, the save of a new one, and the words the section and the card say about a scheduler and its commands. The Scheduler section, the Scheduler card and the usage bar's stop line all read and save through here.

## Context

**User story**: the user sees, per project, whether the scheduler is on and what its last tick [5] decided, and per scheduled command whether it runs on this machine and how far its runs publish here, each said in plain words ("every 1d", "opens a pull request").

**Problem**: the module reads another process's output. A project whose command fails, or a state [1] written by an older version, must not break the section or the card for every other project.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] spend cushion: how far past the quota boundary (the share of the account's quota week that may be spent by now) a scheduled run may still start, in percentage points of the week; the state's `spendOffset`. Positive is lenient, negative is strict. The dashboard calls it the spend offset.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[5] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[6] project's row: what the module holds of one project's scheduler, made from what `agent-scheduler status` printed for that project. It is not a row of a skill's `schedule` key (the key in the front matter of its `SKILL.md` where the skill says which commands it schedules), which the module never reads.

## Business logic — TL;DR

- **A project's row** - on, keep-alive, running, the model, the spend cushion [3], the last tick [5] with its decisions and its note, and the schedule's commands, each with this machine's schedule switch [2] and publish pick [4] folded in; anything that is not what the command promises reads as absent.
- **Reading every project** - `agent-scheduler status` in each project, at once; a project whose command fails is a project's row that says why and holds nothing else.
- **The spend cushion in force** - the loosest one any project holds; none when no project answered one.
- **Projects holding another cushion** - each project whose spend cushion is not the one in force, with its own, to one decimal; none when they agree.
- **A typed spend cushion** - the text of the Settings box as a whole number of points held to −50..50; none while the text is empty or no number yet (a minus sign alone).
- **Saving the spend cushion** - `agent-scheduler offset -- <points>` in every project; each failing project is named.
- **In words** - the leading status of a project's row, a command's pace, how far a command publishes, the labels of the publish picks, and which picks a project is offered.

## Business logic

### A project's row

#### Context

See `## Context`.

#### Business logic

A project's row [6] is made from the JSON `agent-scheduler status` printed for one project. It carries the project (id, name, whether it has a git host package), whether the scheduler is on, whether it keeps alive, whether its process is running, the model when the state names one, the spend cushion [3] when it is a finite number, and the last tick [5] when the state has one with a time: its time, its decisions (each a command, an outcome line and the run's id when one started; an entry missing its command or outcome is left out) and its note when it has one.

The commands of a project's row are the schedule as the last tick recorded it, in its order: each with its name, its interval as written when it has one, its check when it has one, and the plain line saying what its check waits for when its skill gives one. Two things of this machine are folded in. Whether the command is on: it is on only when the state holds this machine's schedule switch [2] for it, switched on; a command nobody switched on here is off. And the command's publish pick [4]: the one the state holds for it when that is one of `nothing`, `commit`, `branch`, `pr`, `merge`, else `commit`. A recorded command with no name is left out; an interval, a check or a waits-for line that is not text is dropped; a switch that is anything but on reads as off, and a pick that is none of the known words reads as `commit`. A scheduler that has not ticked yet lists no command, and neither does one in a project where no skill schedules a command. Output that is not an object reads as an empty project's row: off, not running, no commands.

### Reading every project

#### Context

See `## Context`.

#### Business logic

`agent-scheduler status` is run in every project given, all at once, through the dashboard's service for running the module package's own command. The projects' rows come back in the projects' order. A project whose command failed is a project's row holding the project, the reason the dashboard gave, and nothing else: off, not running, no commands.

### The spend cushion in force

#### Context

**Problem**: the cushion is kept per project but shown as one number. A save writes every project, so they agree unless one was set by hand.

#### Business logic

The spend cushion [3] in force across the projects' rows is the largest one any project's row holds: the loosest, the one that lets scheduled work spend the furthest. When no project's row holds one (no project answered), there is none.

### Saving the spend cushion

#### Context

See `## Context`.

#### Business logic

A new cushion is saved by running `agent-scheduler offset -- <points>` in every project given, all at once; the `--` keeps a negative value from being read as an option. The save is done when every project's command succeeded. Otherwise it is stopped with every failing project named, "<project>: <why>", joined by "; "; the projects that succeeded keep the new value.

### In words

#### Context

**User story**: the user reads the Scheduler section and the Scheduler card without reading the skill that schedules the command, or its check, which is a shell line.

#### Business logic

- **The leading status of a project's row**: "not readable" (red) when the project's status could not be read; else "off" (muted) when the scheduler is off; else "on, not running" (amber) when it is on but its process is not alive; else "on" (green).
- **A command's pace**: "every <interval>" for a command with only an interval, as written ("every 1d"). For a command with only a check, the plain line its skill gives for what the check waits for ("when the queue holds a task"), or "when its check finds work" when the skill gives none. For a command with both, "every <interval> at most, " followed by those same words ("every 6h at most, when a ticket has no plan", "every 6h at most, when its check finds work").
- **How far a command publishes** on this machine, by its publish pick [4]: "commits its work" for `commit`, which is also the pick of a command nobody picked for, "publishes its branch" for `branch`, "opens a pull request" for `pr`, "opens a pull request that merges on green" for `merge`, and "publishes nothing" for a pick of nothing.
- **The publish picks' labels**: "Nothing", "Commit", "Publish branch", "Open PR", "Merge on green", in that order.
- **Which picks a project is offered**: all five where one of the project's packages provides a git host; "Nothing", "Commit" and "Publish branch" only where none does, since no pull request can be opened there. The command's pick in force, when the project is not offered it, is listed after them, so a menu always shows what is in force.
- The bound of the spend cushion as the dashboard's controls set it, 50 points either side of the quota boundary, is the dashboard's own number, handed on from `@openagt/dashboard/module`.
