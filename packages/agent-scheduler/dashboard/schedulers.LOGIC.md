What the module knows of a project's scheduler and how it changes it: one project's row [6] per project, made from what `agent-scheduler status` printed, the spend cushion [3] in force across projects, the save of a new one, and the words the page, the section and the card say about a scheduler and its commands. The Automations page, the Scheduler section, the Scheduler card and the usage bar's stop line all read through here, and the spend cushion is saved through here.

## Context

**User story**: the user sees, per project, whether the scheduler is on and what its last tick [5] decided, and per scheduled command what it does, whether it runs on this machine, how far its runs publish here and what the scheduler last decided for it, each said in plain words ("Every 1 day", "Opens a pull request", "No work", "One is already running").

**Problem**: the module reads another process's output. A project whose command fails, or a state [1] written by an older version, must not break the page, the section or the card for every other project.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] spend cushion: how far past the quota boundary (the share of the account's quota week that may be spent by now) a scheduled run may still start, in percentage points of the week; the state's `spendOffset`. Positive is lenient, negative is strict. The dashboard calls it the spend offset.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[5] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[6] project's row: what the module holds of one project's scheduler, made from what `agent-scheduler status` printed for that project. It is not a row of a skill's `schedule` key (the key in the front matter of its `SKILL.md` where the skill says which commands it schedules), which the module never reads.

## Business logic — TL;DR

- **A project's row** - on, keep-alive, running, the model, the spend cushion [3], the last tick [5] with its decisions and its note, the schedule's commands, each with what its skill says it does and with this machine's schedule switch [2], its publish pick [4] and the last tick's decision for it folded in, and the skills whose `schedule` key the last tick could not read, each with the reason; anything that is not what the command promises reads as absent.
- **Reading every project** - `agent-scheduler status` in each project, at once; a project whose command fails is a project's row that says why and holds nothing else.
- **The spend cushion in force** - the loosest one any project holds; none when no project answered one.
- **Projects holding another cushion** - each project whose spend cushion is not the one in force, with its own, to one decimal; none when they agree.
- **A typed spend cushion** - the text of the Settings box as a whole number of points held to −50..50; none while the text is empty or no number yet (a minus sign alone).
- **Saving the spend cushion** - `agent-scheduler offset -- <points>` in every project; each failing project is named.
- **In words** - the leading status of a project's row, a command's pace as a sentence with its interval spelled out, how far a command publishes, what the scheduler last decided for a command, the labels of the publish picks, and which picks a project is offered.

## Business logic

### A project's row

#### Context

See `## Context`.

#### Business logic

A project's row [6] is made from the JSON `agent-scheduler status` printed for one project. It carries the project (id, name, whether it has a git host package), whether the scheduler is on, whether it keeps alive, whether its process is running, the model when the state names one, the spend cushion [3] when it is a finite number, and the last tick [5] when the state has one with a time: its time, its decisions (each a command, an outcome line and the run's id when one started; an entry missing its command or outcome is left out) and its note when it has one.

The commands of a project's row are the schedule as the last tick recorded it, in its order: each with its name, its interval as written when it has one, its check when it has one, the plain line saying what its check waits for when its skill gives one, and what its skill says it does, in the skill's own words, when the tick recorded it. Two things of this machine are folded in. Whether the command is on: it is on only when the state holds this machine's schedule switch [2] for it, switched on; a command nobody switched on here is off. And the command's publish pick [4]: the one the state holds for it when that is one of `nothing`, `commit`, `branch`, `pr`, `merge`, else `commit`. The last tick's decision for the command is folded in too: the first of the tick's decisions under the command's name, when there is one. A recorded command with no name is left out; an interval, a check, a waits-for line or a description that is not text is dropped; a switch that is anything but on reads as off, and a pick that is none of the known words reads as `commit`. A scheduler that has not ticked yet lists no command, and neither does one in a project where no skill schedules a command. Output that is not an object reads as an empty project's row: off, not running, no commands.

A project's row also names the skills whose `schedule` key the last tick could not read. The tick writes one decision per such skill, under the skill's name, with the outcome `unreadable schedule: <reason>`; each is listed with the skill's name and the reason. Such a skill gives no scheduled command, so its decision is never a command's. A scheduler that has not ticked names none.

### Reading every project

#### Context

See `## Context`.

#### Business logic

`agent-scheduler status` is run in every project given, all at once, through the dashboard's service for running the module package's own command. The projects' rows come back in the projects' order. A project whose command failed is a project's row holding the project, the reason the dashboard gave, and nothing else: off, not running, no commands, no skill named.

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

**User story**: the user reads the Automations page and the Scheduler card without reading the skill that schedules the command, or its check, which is a shell line.

**Problem**: a tick's decision is at most a minute old, and a person may have flipped a command's schedule switch [2] since. The words for the last decision must follow the switch as it stands, not a line the last tick wrote before the flip.

**Problem**: the tick's lines are written for the state file. Some are a rule's shorthand that a person has to decode (`cap reached (1 in flight: <id> on <host>)`, `not due (last start 2h ago, every 6h)`), and are said in plain words. Others carry a reason only the tool knows (`quota: …`, `check failed: …`), and are kept.

#### Business logic

- **The leading status of a project's row**: "not readable" (red) when the project's status could not be read; else "off" (muted) when the scheduler is off; else "on, not running" (amber) when it is on but its process is not alive; else "on" (green).
- **An interval, spelled out**: an interval as the skill writes it, a whole number of 1 or more followed by `m`, `h` or `d`, reads as that number of minutes, hours or days: `15m` is "15 minutes", `1h` is "1 hour", `7d` is "7 days". Anything else (`0d`, `d`, `-3h`, `2w`) is shown as written.
- **A command's pace**, as a sentence with a capital: "Every <interval>" for a command with only an interval, the interval spelled out ("Every 1 day"). For a command with only a check, the plain line its skill gives for what the check waits for ("When the queue holds a task"), or "When its check finds work" when the skill gives none. For a command with both, "Every <interval> at most, " followed by those same words without the capital ("Every 15 minutes at most, when a ticket has no plan", "Every 6 hours at most, when its check finds work").
- **How far a command publishes** on this machine, by its publish pick [4], as a sentence with a capital: "Commits its work" for `commit`, which is also the pick of a command nobody picked for, "Publishes its branch" for `branch`, "Opens a pull request" for `pr`, "Opens a pull request that merges on green" for `merge`, and "Publishes nothing" for a pick of nothing.
- **What the scheduler last decided for a command**, for a person, by the first rule that holds:
  1. The last tick's decision for the command is `not a command of the coding agent: its skill is only under <folder>, …`: "Cannot start: its skill is only in <folder>, which Claude Code does not read" ("Cannot start: its skill is only in .agents/skills, which Claude Code does not read"), whether the command is switched on or off on this machine, since switching it on would start nothing.
  2. The command is off on this machine: "Off", whatever the last tick said.
  3. The command is on and the last tick decided nothing for it, or still said `switched off on this machine` (it was switched on since): nothing is said.
  4. The decision is `not due`, the check found no work: "No work".
  5. The decision starts with `started `: "Started a run".
  6. The decision is `not due (last start <age> ago, …)`, the command's interval has not passed: "Started <age> ago, not due yet", the age as the tick wrote it ("Started 2h ago, not due yet", "Started less than a minute ago, not due yet").
  7. The decision is `cap reached (<N> in flight: …)`: "One is already running" when N is 1, else "<N> are already running" ("3 are already running").
  8. Any other decision: the tool's own line with a capital ("Quota: …", "Check failed: …", "Not ready: …").
- **The publish picks' labels**: "Nothing", "Commit", "Publish branch", "Open PR", "Merge on green", in that order.
- **Which picks a project is offered**: all five where one of the project's packages provides a git host; "Nothing", "Commit" and "Publish branch" only where none does, since no pull request can be opened there. The pick a menu shows, when the project is not offered it, is listed after them, so a menu always lists the entry it shows.
- The bound of the spend cushion as the dashboard's controls set it, 50 points either side of the quota boundary, is the dashboard's own number, handed on from `@openagt/dashboard/module`.
