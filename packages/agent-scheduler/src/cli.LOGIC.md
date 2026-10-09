The command line, `agent-scheduler <command>`: JSON on stdout, one line for a person on stderr, and the exit code says how it went, 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read. The same contract as the skills' commands, so a person and a dashboard read it the same way. Fourteen commands: `tick`, `init`, `start [--keep-alive]`, `stop [--unless-keep-alive]`, `status`, `model <id>`, `offset <points>`, `switch <command> <on|off>`, `publish <command> <nothing|commit|branch|pr|merge>`, `pace <command> <skill|work|N<m|h|d|w|mo>> [HH:MM]`, `agents <command> <skill|N>`, `add <name> --prompt <text> [--every <N<m|h|d|w|mo>>] [--when <shell line>] [--waits-for <line>]`, `try --when <shell line>`, `cleanup`.

## Context

**User story**: the user runs `init` once so the dashboard opens and closes the scheduler, turns the scheduler on and off, reads its state, sets the model and the spend cushion for their machine, switches a scheduled command on or off for their machine, picks how far a scheduled command's runs publish on their machine, sets how often at most a scheduled command starts on their machine, sets how many agents may work on a scheduled command at once, saves a prompt of their own as an automation [10] of the project with `add`, runs a check [11] once with `try` before they save it, ticks once by hand, or runs `cleanup` to remove what this tool left in the project, all from any directory of the project, and a dashboard runs the same commands and parses the same JSON: the package's own dashboard part (`../dashboard/`) reads with `status`, saves with `offset`, `switch`, `publish`, `pace` and `agents`, and its "New automation" form tries a check with `try` and saves with `add`. Running, continuing and checking one run are `agent-runner`'s commands, not this tool's.

**Business logic story**: every command acts on the project the working directory belongs to, found by the `branches` package even from inside a checkout under `.branches/`. What each command does is `scheduler.ts`'s, `state.ts`'s, `pace.ts`'s, `automation.ts`'s and `cleanup.ts`'s; this file is the contract around them. Every command but one writes at most this tool's own files, which git does not track; `add` alone writes a file of the project, a skill file in the person's own checkout, and then takes out of the state [1] what this machine held under the new command's name, writing the state only when it held something.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches [3], pace picks [6], agents picks [8] and publish picks [4], the scheduler's pid, the last tick's decisions.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command.
[3] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the state, not in the skill that schedules the command. Every scheduled command is off on a machine until a person switches it on there. A switch that is on holds the time it was switched on.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, or one of the publish levels a run may be given (`commit`, `branch`, `pr`, `merge`); kept in the state, not in the skill. It is `commit` until the person picks.
[5] scheduled command: one command a skill of the project schedules with the `schedule` key in the front matter of its `SKILL.md`, called the skill's `schedule`; named by the skill's folder name and at most one word after it (`triage quick`). The schedule is all the scheduled commands of a project.
[6] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[7] pace: how often at most a scheduled command starts, the one in force on a machine: this machine's pace pick [6], else the interval the command's skill gives.
[8] agents pick: a person's choice, on one machine, of that machine's number for one scheduled command: the machine starts another run of the command only while fewer than that number are in flight on any machine that shares the repository. A whole number from 1 to 99; kept in the state, not in the skill. A command with no agents pick has its skill's number.
[9] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick [8] made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none.
[10] automation: a person's own prompt saved as a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries the `schedule` the person picked, an interval, a check [11] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page; from then on a skill like any other, and its command a scheduled command [5] like any other.
[11] check: the shell command line a skill's `schedule` gives a scheduled command [5] as `when`, run at the repository root on every tick [2]; its output says whether the command is due. It may read `$LAST_RUN`: the time of its command's last start, or the time the command was switched on on this machine when that is later.
[12] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.

## Business logic — TL;DR

- **The contract** - one JSON document on stdout per command that ran, `ok` on every object; a refusal exits 1 with `{"ok":false,"reason":…}` and one line on stderr; a failure exits 1 with `{"ok":false,"reason":"failed","detail":…}` and the detail on stderr; a command line that cannot be read exits 2 with the usage on stderr and nothing on stdout.
- **The project** - found from the working directory, from inside a checkout too; outside a git repository every command refuses `not-a-repo`, `not inside a git repository`.
- **`tick`** - one tick of the project now, each due command started as a run of `agent-runner`, its decisions told on stderr, its record answered with `ok: true`.
- **`init`** - this tool's lines written into the dashboard's hooks file, a line already there kept; answered with the file and which keys gained a line; refused `no-dashboard` where the project has no `.openagent/` directory and `unreadable` where the file is not a YAML map (`init.ts`).
- **`start`, `stop`, `status`** - the state answered after each; `start --foreground` makes this process the scheduler's; `start --keep-alive` writes keep-alive on; `stop --unless-keep-alive` leaves a keep-alive scheduler running, says so on stderr, and answers `kept: true`.
- **`model <id>`, `offset <points>`** - the state's model (the one every scheduled run starts on) or spend cushion written for this user and the state answered; `offset` with something that is not a number is a usage error, `<value> is not a number of percentage points`.
- **`switch <command> <on|off>`** - this machine's schedule switch [3] for one scheduled command [5], named by its whole name (quoted when it holds a word after the skill's name: `switch "triage quick" on`), written and the state answered; `on` is refused `not-scheduled` when no skill of the project schedules the command, and `unreadable-schedule` when the skill's `schedule` cannot be read; `off` is taken for any name; `on` writes the time the command is switched on, and a command already on keeps the time it holds; `on` also counts the time of day of the command's pace pick [6], when it has one, from now; a value neither `on` nor `off` is a usage error.
- **`publish <command> <nothing|commit|branch|pr|merge>`** - this machine's publish pick [4] for one scheduled command [5], named the same way, written and the state answered; refused `not-scheduled` when no skill of the project schedules the command, and `unreadable-schedule` when the skill's `schedule` cannot be read; any other value is a usage error.
- **`pace <command> <skill|work|N<m|h|d|w|mo>> [HH:MM]`** - this machine's pace pick [6] for one scheduled command [5], named the same way, written and the state answered: an interval (`15m`, `6h`, `2d`, `2w`, `1mo`, a count from 1 to 9999), with a time of day beside days, weeks or months (`2d 10:00`); `work` for whenever its check finds work, refused `no-check` for a command with no check; `skill` takes the pick back, for any name; an interval and `work` are refused `not-scheduled` and `unreadable-schedule` as `publish` is; the same pace picked again keeps the time it counts from; a value that is none of these, a time that is none, and a time beside anything but days, weeks or months are usage errors.
- **`agents <command> <skill|N>`** - this machine's agents pick [8] for one scheduled command [5], named the same way, written and the state answered: a whole number from 1 to 99; `skill` takes the pick back, for any name; a number is refused `not-scheduled` and `unreadable-schedule` as `publish` is; any other value is a usage error.
- **`add <name> --prompt <text> [--every …] [--when …] [--waits-for …]`** - a person's own automation [10] saved as the skill file `.claude/skills/<name>/SKILL.md` of the project, in the person's own checkout, nothing committed; answered with the command, the file and where a run's checkout starts (`origin/main`, or `HEAD`); after a save, this machine's schedule switch [3], pace pick [6], agents pick [8] and publish pick [4] held under that name are taken out of the state [1], which is written only when it held one, so the new command starts switched off, at its own pace; refused `taken` for a name either skills folder of the project already holds, whatever its capitals, `no-prompt` for a blank prompt, `bad-name` for a name that is no command's name or is longer than 64 characters, and `bad-schedule` when the tick could not read the `schedule` as written or the file would not read back as typed; no `--prompt` is a usage error (`automation.ts`).
- **`try --when <shell line>`** - a check [11] run once in the project as a tick [2] would run it, within 20 seconds, less than the minute a tick gives a check, asking what is new since a day ago; answered with the time it was given, whether it ran, whether an agent would start, what it printed, cut as a run is handed it, and, when it failed, that it took longer than 20 seconds or its error's last line; a check that fails is an answer, exit 0; no `--when`, or a blank one, is a usage error; nothing is saved or started (`automation.ts`).
- **`cleanup`** - what this tool left in the project removed: the state file and the scheduler's log, then `.agent-scheduler/` once it is empty, then the rule hiding it from git once no checkout of the repository has one; answered with what was removed and what was kept, each kept path with its reason; refused `running` with the pid while the state names a live scheduler, with the line `the scheduler is running here (pid <pid>): stop it first with agent-scheduler stop` (`cleanup.ts`).

## Business logic

### The contract

#### Context

**Problem**: the same output is read by a program parsing it (a dashboard, a hook) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

A command that ran prints exactly one JSON document on stdout, an object with `ok`, and exits 0. A refusal, a rule saying no (the working directory is not inside a repository), prints `{"ok":false,"reason":…}` on stdout, one line on stderr, and exits 1. Anything else that fails (git, the file system, a driver) prints `{"ok":false,"reason":"failed","detail":<the error's message>}` on stdout, the detail on stderr, and exits 1. A command line that cannot be read is rejected before anything runs: no command or an unknown one (`agent-runner`'s `run` and `check` among them) prints the usage on stderr and exits 2; an unknown flag or the wrong number of arguments (`model`, `offset` and `add` take exactly one, `switch`, `publish` and `agents` exactly two, `pace` two or three, the others none) prints what was wrong (`expected 1 argument(s), got 0`, `expected 2 to 3 argument(s), got 1`) followed by the usage on stderr, nothing on stdout, and exits 2. The usage names the fourteen commands and the contract.

### The project

#### Context

See `## Context`.

#### Business logic

Every command first finds the project the working directory belongs to, by the `branches` package's rule, so a command run from inside a checkout under `.branches/`, or from a subdirectory, still acts on the project's root. Only git's own "not a git repository" is read as being outside a repository, refused as `not-a-repo` with `not inside a git repository`; every other git error stays the failure it is.

### `tick`

#### Context

See `tick.ts` and `scheduler.ts`.

#### Business logic

`tick` runs one tick [2] of the project now, the way the scheduler's process would, a due command started as a run of `agent-runner`, its lines told on stderr, and answers the tick's record (`at`, `decisions`, `schedule`, `note`) with `ok: true`. It runs whether or not the state is on: an off state answers the note `off` after the pull and the sweep.

### `start`, `stop`, `status`

#### Context

See `scheduler.ts`.

#### Business logic

`start` turns the scheduler on and answers the state [1] with the scheduler's pid; `--keep-alive` writes keep-alive on; `--foreground` runs the loop in this process, which is how the detached scheduler is started, and answers the state once stopped. `stop` turns it off, signals the scheduler's process, and answers the state with `kept: false`. `stop --unless-keep-alive` is the line a dashboard runs when it closes: when the state's keep-alive is on it changes nothing, prints `keep-alive is on, the scheduler keeps running` on stderr and answers the state as it is with `kept: true`; when keep-alive is off it is `stop`. `status` answers the state plus `running`.

### `init`

#### Context

**User story**: the user runs `npx agent-scheduler init` in a project the dashboard knows; from then on the dashboard starts the project's scheduler when it opens and stops it when it closes. The Start's lines are `agent-runner init`'s.

#### Business logic

`init` takes no argument. It writes this tool's lines into the project's `.openagent/hooks.yml`, keeping every line already there (`init.ts`), and answers `{"ok":true,"file":…,"added":[…],"kept":[…]}`. Where the project has no `.openagent/` directory it refuses `{"ok":false,"reason":"no-dashboard","file":…}` with `no .openagent/ here: add the project in the dashboard first` on stderr, exit 1; a file that is not YAML, or not a map, is refused `unreadable`, with the file and the parser's first line on stderr, exit 1.

### `model <id>`, `offset <points>`

#### Context

See `## Context`.

#### Business logic

`model <id>` writes the model every scheduled run of this user starts on and answers the state. `offset <points>` writes how far past the spend boundary a run may still start, in percentage points, and answers the state; a value that is not a finite number is a usage error, `<value> is not a number of percentage points`, exit 2.

### `switch <command> <on|off>`

#### Context

**User story**: the user wants the clean-up after merges, which the project's `post-merge-cleanup` skill schedules, to run on their own machine. Like every scheduled command [5] it starts switched off, so they check its checkbox on the dashboard's Automations page, which flips its schedule switch [3] by running this command in the project, or type `agent-scheduler switch post-merge-cleanup on`; no tracked file changes, and no other machine runs it.

#### Business logic

`switch` takes exactly two arguments: a command's name and `on` or `off`; any other value is a usage error, `<value> is neither on nor off`, exit 2. `switch <command> off` needs no scheduled command: it removes this machine's schedule switch [3] for that name, whatever the name, and answers the state with `ok: true`. So a switch left on for a skill that is gone from the project, or whose `schedule` cannot be read any more, can always be switched off, and switching off a name nobody ever heard of takes nothing away and is no error. The state is written all the same: in a project where the tool has written nothing yet, that first write makes `.agent-scheduler/`, a state file holding the defaults, and the rule hiding the folder from git.

`switch <command> on` first reads the project's schedule as `schedule.ts` reads it. When a skill of the project schedules a command of exactly that name, it writes this machine's schedule switch [3] for the command, as the time now, by `state.ts`'s rule (only a command switched on is kept) and answers the state with `ok: true`. A command that is already on on this machine keeps the time its switch holds: asking twice changes nothing. That time is what the command's check is given as `$LAST_RUN` until the command starts after it (`tick.ts`). Otherwise it is refused, exit 1, in one of two ways. The skill is the name's first word. When that skill's `schedule` cannot be read, the refusal is `{"ok":false,"reason":"unreadable-schedule","skill":<skill>,"detail":<the reason>}` with `the schedule of <skill> cannot be read: <the reason>` on stderr, the reason being `schedule.ts`'s (`unknown key evry`). In every other case it is `{"ok":false,"reason":"not-scheduled","command":<name>}` with `no skill of this project schedules <name>` on stderr. The name is the whole name: for a skill whose scheduled commands each carry a word (`triage quick`, `triage consensual`), the skill's name alone (`triage`) is refused `not-scheduled`. A command whose skill is only under `.agents/skills` is a scheduled command here, so it can be switched on, though the tick never starts it (`tick.ts`).

Switching a command on also touches its pace pick [6]: when the command was off on this machine and its pace pick has a time of day, the time that time of day counts from is set to now (`pace.ts`); a command that was already on is left as it is, so asking twice does not put a missed time off. So a command switched on at 11:00 with "every day at 10:00" waits for tomorrow's 10:00 as it would had the pace been picked at 11:00. A pace pick with no time of day, and a command with no pace pick, have nothing else written. Switching a command off changes nothing of its pace pick.

### `publish <command> <nothing|commit|branch|pr|merge>`

#### Context

**User story**: the user wants the queue's runs on their own machine to open a pull request and not merge it, so they press "Edit" on the command on the dashboard's Automations page, pick "Open PR" and save, which runs this command in the project, or type `agent-scheduler publish work-queue pr`; no tracked file changes, and every other machine keeps its own publish pick [4]. Until they pick, the command's runs on their machine commit their work and push nothing.

#### Business logic

`publish` takes exactly two arguments: a command's name and one of `nothing`, `commit`, `branch`, `pr`, `merge`; any other value is a usage error, `<value> is none of nothing, commit, branch, pr, merge`, exit 2. When no skill of the project schedules a command of exactly that name, it is refused as `switch <command> on` is: `unreadable-schedule` with `the schedule of <skill> cannot be read: <the reason>` when the `schedule` of the name's skill cannot be read, else `not-scheduled` with `no skill of this project schedules <name>`, exit 1. Otherwise it writes that value as this machine's publish pick [4] for the command, by `state.ts`'s rule (a pick of `commit` is kept like any other), and answers the state with `ok: true`. A pick is never removed: another pick replaces it.

### `pace <command> <skill|work|N<m|h|d|w|mo>> [HH:MM]`

#### Context

**User story**: the project's `triage` skill says `every: 6h`, which the user finds too often for their laptop. They press "Edit" on the command on the dashboard's Automations page, pick "Every 2 days at 10:00" and save, which runs this command in the project, or type `agent-scheduler pace "triage quick" 2d 10:00`; no tracked file changes, and every other machine keeps its own pace [7]. The command's last start is shared, so where another machine has the command switched on at a faster pace, the work still runs at that faster pace: a slower pace slows only the starts this machine makes. `agent-scheduler pace "triage quick" skill` gives the skill's pace again.

#### Business logic

`pace` takes two or three arguments: a command's name, what the pace is, and an optional time of day. The second argument is one of:

- `skill`: the pace pick [6] this machine holds under that name is taken back, and the command runs at its skill's pace again.
- `work`: whenever the command's check finds work, with no interval.
- An interval as `pace.ts` reads it: a whole number from 1 to 9999 and a unit, `m`, `h`, `d`, `w` or `mo` (`15m`, `6h`, `2d`, `2w`, `1mo`).

The third argument is a time of day as `pace.ts` reads it, `HH:MM` on a 24-hour clock, in this machine's time. It goes only with an interval in days, weeks or months.

Three usage errors, exit 2, are told before the project is read:

- The second argument is none of the three (`often`, `0h`, `10000d`): `<value> is none of skill, work, or an interval like 15m, 6h, 2d, 2w, 1mo`.
- The third argument is no time of day: `<value> is no time of day like 10:00`.
- A time of day beside `skill`, `work`, minutes or hours: `a time of day goes with days, weeks or months`.

`skill` needs no scheduled command: it removes the pace pick this machine holds under that name, whatever the name, and answers the state with `ok: true`. So a pace pick left for a skill that is gone from the project, or whose `schedule` cannot be read any more, can always be taken back, and taking back one for a name nobody ever heard of takes nothing away and is no error. The state is written all the same: in a project where the tool has written nothing yet, that first write makes `.agent-scheduler/`, a state file holding the defaults, and the rule hiding the folder from git.

For `work` and for an interval, when no skill of the project schedules a command of exactly that name, it is refused as `publish` is: `unreadable-schedule` with `the schedule of <skill> cannot be read: <the reason>` when the `schedule` of the name's skill cannot be read, else `not-scheduled` with `no skill of this project schedules <name>`, exit 1. `work` for a command whose skill gives it no check is refused `{"ok":false,"reason":"no-check","command":<name>}` with `<name> has no check, so nothing would say when there is work` on stderr, exit 1. A refusal writes nothing.

Otherwise it writes this machine's pace pick for the command by `state.ts`'s rule and answers the state with `ok: true`. `work` is kept as "whenever there is work". An interval is kept as its text without a leading zero, with the time of day when one was given, the hour in two digits (`9:05` is kept as `09:05`), and with the time its time of day counts from, which `pace.ts` uses so that a pace with a time of day starts nothing before its first such time. That time is now, with one exception: the same pace picked again, the same interval and the same time of day as the pace pick the state already holds, keeps the time that pick counts from, so picking it again does not put off a time that was missed. Another interval or another time of day is a new pick and counts from now. A saved value that is no pace pick at all, in a state file edited by hand, is simply replaced.

### `agents <command> <skill|N>`

#### Context

**User story**: the project's `work-queue` skill lets one agent work the queue at a time. The user wants three at once, so they press "Edit" on the command on the dashboard's Automations page, pick "Up to 3 agents at once" and save, which runs this command in the project, or type `agent-scheduler agents work-queue 3`; no tracked file changes. `agent-scheduler agents work-queue skill` gives the skill's number again.

**Problem**: the number is held against the command's runs on every machine that shares the repository, and every other machine keeps its own number. So it is this machine's cap [9], not a share of the work: where machines hold different numbers, no more run at once than the largest number among the machines whose scheduler is on with the command switched on (`tick.ts`). That is a ceiling, not a count: a run still starts only when the command is due.

#### Business logic

`agents` takes exactly two arguments: a command's name and either `skill` or a whole number from 1 to 99 (`names.ts`), written in digits alone (`3`; `099` reads as 99). Any other value (`0`, `1.5`, `100`, `many`) is a usage error, `<value> is neither skill nor a whole number from 1 to 99`, exit 2, and writes nothing. A value that starts with a dash (`-2`) never gets that far: the reader of the command line takes it for an unknown flag and says so, also exit 2.

`skill` needs no scheduled command: it removes the agents pick [8] this machine holds under that name, whatever the name, and answers the state with `ok: true`. So an agents pick left for a skill that is gone from the project, or whose `schedule` cannot be read any more, can always be taken back, and taking back one for a name nobody ever heard of takes nothing away and is no error. The state is written all the same: in a project where the tool has written nothing yet, that first write makes `.agent-scheduler/`, a state file holding the defaults, and the rule hiding the folder from git.

For a number, when no skill of the project schedules a command of exactly that name, it is refused as `publish` is: `unreadable-schedule` with `the schedule of <skill> cannot be read: <the reason>` when the `schedule` of the name's skill cannot be read, else `not-scheduled` with `no skill of this project schedules <name>`, exit 1. Otherwise it writes the number as this machine's agents pick for the command, by `state.ts`'s rule, and answers the state with `ok: true`. A number of 1 is kept like any other, also where the skill says 1. The number may be above the skill's or below it.

### `add <name> --prompt <text> [--every …] [--when …] [--waits-for …]`

#### Context

**User story**: the user wants an agent to answer each new comment on the project's issues, and no skill of the project does that. They fill in the "New automation" form on the dashboard's Automations page and press Save, which runs this command in the project, or type `agent-scheduler add answer-comments --prompt "Answer each new comment below." --every 15m --when '<a shell line that lists the new comments>' --waits-for "when someone commented"`. The project then has the skill file `.claude/skills/answer-comments/SKILL.md`, theirs to commit, and `/answer-comments` is a scheduled command [5] like any skill's: switched off on this machine, whatever a command of that name left there, with its own schedule switch [3], pace pick [6], agents pick [8] and publish pick [4].

**Problem**: every other command of this tool changes at most the state [1], which git does not track. This one writes a file of the project into the person's own checkout, and a scheduled run's checkout is made from the start point [12], not from there. The person must be told where the file is and where it has to get to, and nothing may be committed for them.

#### Business logic

`add` takes exactly one argument, the automation's [10] name, and four flags that each take a text:

- `--prompt`: what the agent is told. It is required: without it the command is a usage error, `add needs --prompt, what the agent is told`, exit 2, told before the project is read.
- `--every`: an interval as a skill writes it (`15m`, `6h`, `2d`, `2w`, `1mo`).
- `--when`: the check [11], a shell line.
- `--waits-for`: one plain line saying what the check waits for.

A text that opens with a dash is written together with its flag (`--prompt=- Answer each new comment below.`): then it is the flag's own text. Written apart from its flag (`--prompt "- Answer…"`), the reader of the command line cannot tell it from a flag and refuses it: a usage error, exit 2.

What is saved, and what is refused, is `automation.ts`'s. A save that is taken writes `.claude/skills/<name>/SKILL.md` at the project's root, also when the command is run from inside a checkout under `.branches/`, and answers `{"ok":true,"command":<name>,"file":<the file, from the repository root>,"startsFrom":<origin/main, or HEAD in a repository with no remote>}`, exit 0. Nothing is committed.

After the file is written, and before the answer, whatever this machine's state [1] holds under the new command's name is taken out of it (`state.ts`): its schedule switch [3], its pace pick [6], its agents pick [8] and its publish pick [4]. A command of that name may have been in the project before, a skill since deleted, and a switch left on for it would start the new command unasked. So a command saved anew starts switched off on this machine, at its own pace, one agent at a time, committing its work, like any command nobody set anything for. The state is written only when it held something under the name. When it holds nothing there, as for a name no command ever had, the state is read and not written: the state file stays byte for byte as it is, and in a project where the tool has written nothing yet none is made. A dashboard's own save (a switch, a pick) may be writing the state at that very moment, and a write that changes nothing could put an older state over it. Other machines keep what they hold.

A refusal writes nothing, neither a file nor the state, prints its JSON on stdout and one line on stderr, exit 1:

- `{"ok":false,"reason":"taken","folder":<where>}` with `the project already has a skill there: <where>` (`.claude/skills/answer-comments`, `.agents/skills/plan`): a name either skills folder of the project already holds, whatever its capitals (the folder is named as it is spelled there), an automation saved before among them.
- `{"ok":false,"reason":"no-prompt"}` with `the prompt is empty`: a prompt of whitespace alone.
- `{"ok":false,"reason":"bad-name","detail":<why>}` with the detail as the line: `a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit` (`Answer Comments`, `a---b`), or `a name is 64 characters at most`.
- `{"ok":false,"reason":"bad-schedule","detail":<why>}` with `it cannot run as written: <why>`, the reason being `schedule.ts`'s (`neither every nor when says when` for an automation given neither `--every` nor `--when`), or `it would not read back as typed`.

The project's schedule is read from the skill files on disk, so `switch <name> on` is taken right after `add`. The command still starts no run before its skill's file is on the start point [12] (`tick.ts`).

### `try --when <shell line>`

#### Context

**User story**: before saving an automation [10], the user wants to see what its check [11] prints and whether it would start an agent. They press "Try it" in the "New automation" form, which runs this command in the project, or type `agent-scheduler try --when '<the shell line>'`.

#### Business logic

`try` takes no argument and one flag, `--when`, the shell line to run. Without the flag, or with a line of whitespace alone, it is a usage error, `try needs --when, the shell line to run`, exit 2.

Otherwise the line, its surrounding whitespace removed, is tried once at the project's root as `automation.ts` says: run as a tick [2] would run a check, given the time a day ago as `$LAST_RUN`, and given 20 seconds, less than the minute a tick gives a check and less than the 30 seconds a dashboard waits for a command it runs. The answer is `{"ok":true,"lastRun":<that time>,"ran":<whether the check ran to its end>,"due":<whether an agent would start>,"printed":<what it printed, cut as a run is handed it when it is longer than 8000 characters>}`, exit 0, with `"error":<why>` when it did not run: `it took longer than 20 seconds`, or the last line of its error, at most 500 characters. A check that fails is an answer, not a failure of the command: `ran` is false, the exit code is still 0, and stderr stays empty. The line needs no scheduled command and no automation. Nothing is saved and nothing is started: no file is written and the state [1] stays as it is.
