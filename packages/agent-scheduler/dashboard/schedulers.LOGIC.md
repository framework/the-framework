What the module knows of a project's scheduler and how it changes it: one project's row [6] per project, made from what `agent-scheduler status` printed, the spend cushion [3] in force across projects, the save of a new one, the words the page, the section and the card say about a scheduler and its commands, and what the Automations page's Edit box holds of a pace [7] and of a number of agents at once while a person picks them. The Automations page, the Scheduler section, the Scheduler card and the usage bar's stop line all read through here, and the spend cushion is saved through here.

## Context

**User story**: the user sees, per project, whether the scheduler is on and what its last tick [5] decided, and per scheduled command what it does, whether it runs on this machine, how often at most it starts here, how many agents may work on it at once, how far its runs publish here and what the scheduler last decided for it, each said in plain words ("Every 2 days at 10:00", "Up to 3 at once", "Opens a pull request", "No work", "One is already running", "Next: Saturday 10:00"). A command the user switched on, whose skill they wrote in their own checkout and that is not on the start point [11] yet, reads "Cannot start yet: its skill is not on origin/main" once the scheduler would otherwise have started it.

**Problem**: the module reads another process's output. A project whose command fails, or a state [1] written by an older version, must not break the page, the section or the card for every other project.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches, pace picks, agents picks and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] spend cushion: how far past the quota boundary (the share of the account's quota week that may be spent by now) a scheduled run may still start, in percentage points of the week; the state's `spendOffset`. Positive is lenient, negative is strict. The dashboard calls it the spend offset.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[5] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[6] project's row: what the module holds of one project's scheduler, made from what `agent-scheduler status` printed for that project. It is not a row of a skill's `schedule` key (the key in the front matter of its `SKILL.md` where the skill says which commands it schedules), which the module never reads.
[7] pace: how often at most a scheduled command starts, the one in force on this machine: this machine's pace pick [8] for the command, else the interval its skill gives; an interval (a count of minutes, hours, days, weeks or months), with a time of day when it has one. A command its check alone paces has no pace.
[8] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[9] agents pick: a person's choice, on one machine, of that machine's number for one scheduled command: the machine starts another run of the command only while fewer than that number are in flight on any machine that shares the repository. A whole number from 1 to 99; kept in the state, not in the skill. A command with no agents pick has its skill's number.
[10] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick [9] made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none.
[11] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.

## Business logic — TL;DR

- **A project's row** - on, keep-alive, running, the model, the spend cushion [3], the last tick [5] with its decisions and its note, the schedule's commands, each with what its skill says it does and with this machine's schedule switch [2], its pace pick [8] when it has one, its agents pick [9] when it has one, its skill's number of agents at once when that is more than one, its publish pick [4] and the last tick's decision for it folded in, and the skills whose `schedule` key the last tick could not read, each with the reason; anything that is not what the command promises reads as absent.
- **Reading every project** - `agent-scheduler status` in each project, at once; a project whose command fails is a project's row that says why and holds nothing else.
- **The spend cushion in force** - the loosest one any project holds; none when no project answered one.
- **Projects holding another cushion** - each project whose spend cushion is not the one in force, with its own, to one decimal; none when they agree.
- **A typed spend cushion** - the text of the Settings box as a whole number of points held to −50..50; none while the text is empty or no number yet (a minus sign alone).
- **Saving the spend cushion** - `agent-scheduler offset -- <points>` in every project; each failing project is named.
- **In words** - the leading status of a project's row, a command's pace [7] as a sentence with its interval spelled out, whether that pace is a person's own, how many agents at once and whether that is worth saying, how far a command publishes, what the scheduler last decided for a command, a coming time, the labels of the publish picks, and which picks a project is offered.
- **A number of agents in the Edit box** - the draft the box opens with, what a draft is as the words of `agent-scheduler agents`, none while its count is no whole number from 1 to 99, and the command as it would read with the draft saved.
- **A pace in the Edit box** - the draft the box opens with, what a draft is as the words of `agent-scheduler pace`, none while its count or its time is half typed, what to tell the person then, and the command as it would read with the draft saved.

## Business logic

### A project's row

#### Context

See `## Context`.

#### Business logic

A project's row [6] is made from the JSON `agent-scheduler status` printed for one project. It carries the project (id, name, whether it has a git host package), whether the scheduler is on, whether it keeps alive, whether its process is running, the model when the state names one, the spend cushion [3] when it is a finite number, and the last tick [5] when the state has one with a time: its time, its decisions (each a command, an outcome line and the run's id when one started; an entry missing its command or outcome is left out) and its note when it has one.

The commands of a project's row are the schedule as the last tick recorded it, in its order: each with its name, its interval as written when it has one, its check when it has one, the plain line saying what its check waits for when its skill gives one, and what its skill says it does, in the skill's own words, when the tick recorded it. Four things of this machine are folded in. Whether the command is on: it is on only when the state holds this machine's schedule switch [2] for it, switched on, which the state writes as the time it was switched on, an ISO date and time (`../src/names.ts`); a command nobody switched on here is off. And the command's publish pick [4]: the one the state holds for it when that is one of `nothing`, `commit`, `branch`, `pr`, `merge`, else `commit`. And the command's pace pick [8], when the state holds one for it that reads as one: "whenever there is work", or an interval the tool reads (`../src/pace.ts`); a command with none carries none, and a pace pick held for a command the schedule does not list is not shown. And the command's agents pick [9], when the state holds one for it that is a whole number from 1 to 99 (`../src/names.ts`); any other value there (0, 100, text) reads as none, and one held for a command the schedule does not list is not shown. Beside it the command carries its skill's number of agents at once, as the tick recorded it, only when that is a whole number above 1: a skill's 1 is carried as no number. The last tick's decision for the command is folded in too: the first of the tick's decisions under the command's name, when there is one. A recorded command with no name is left out; an interval, a check, a waits-for line or a description that is not text is dropped; a switch that holds anything but a time reads as off, a publish pick that is none of the known words reads as `commit`, and a pace pick whose interval is no interval reads as none. A scheduler that has not ticked yet lists no command, and neither does one in a project where no skill schedules a command. Output that is not an object reads as an empty project's row: off, not running, no commands.

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
- **An interval, spelled out**: an interval as written, a whole number from 1 to 9999 followed by `m`, `h`, `d`, `w` or `mo` (`../src/pace.ts`), reads as that number of minutes, hours, days, weeks or months: `15m` is "15 minutes", `1h` is "1 hour", `7d` is "7 days", `2w` is "2 weeks", `1mo` is "1 month", and a leading zero is dropped (`06h` is "6 hours"). Anything else (`0d`, `d`, `-3h`, `2y`, a count above 9999) is shown as written.
- **A command's pace** [7], as a sentence with a capital, by the pace in force as `../src/pace.ts` works it out from this machine's pace pick [8] and the skill's interval and check:
  - A pace without a time of day, for a command with no check: "Every <interval>", the interval spelled out ("Every 1 day", "Every 2 weeks").
  - A pace without a time of day, for a command with a check: "Every <interval> at most, " followed by what the check waits for ("Every 30 minutes at most, when a ticket has no plan").
  - A pace with a time of day, for a command with no check: "Every <interval> at <time of day>" ("Every 1 month at 09:05").
  - A pace with a time of day, for a command with a check: "Every <interval> from <time of day>, " followed by what the check waits for ("Every 2 days from 10:00, when a ticket has no plan"). It says "from" and not "at": the command starts once its check finds work, which may be later that day.
  - No pace, the check alone says when (the skill gives no interval, or this machine's pace pick is "whenever there is work"): what the check waits for, with a capital ("When the queue holds a task").
  - What the check waits for is the plain line its skill gives, or "when its check finds work" when the skill gives none.
  - A pace pick that cannot be followed leaves the skill's pace: "whenever there is work" for a command with no check reads "Every 1 day", the skill's interval.
  - A skill's interval the tool would not have read, on a command with no pace pick, is shown as written ("Every 2y").
- **Whether a command's pace is a person's own**: it is when the draft its Edit box opens with (below) is not "as the skill says". So a pace pick that changes nothing does not count: "whenever there is work" for a command its check alone paces already, or for a command with no check.
- **How many agents at once**: this machine's cap [10] for a command, which is its agents pick [9] when it has one, else its skill's number, 1 when the tick recorded none. As a sentence with a capital: "One at a time" for 1, "Up to <N> at once" otherwise ("Up to 3 at once"). The number is worth saying when it is more than one, or when a person set it, even to one; a command at its skill's one at a time says nothing.
- **How far a command publishes** on this machine, by its publish pick [4], as a sentence with a capital: "Commits its work" for `commit`, which is also the pick of a command nobody picked for, "Publishes its branch" for `branch`, "Opens a pull request" for `pr`, "Opens a pull request that merges on green" for `merge`, and "Publishes nothing" for a pick of nothing.
- **What the scheduler last decided for a command**, for a person, by the first rule that holds:
  1. The last tick's decision for the command is `not a command of the coding agent: its skill is only under <folder>, …`: "Cannot start: its skill is only in <folder>, which Claude Code does not read" ("Cannot start: its skill is only in .agents/skills, which Claude Code does not read"), whether the command is switched on or off on this machine, since switching it on would start nothing.
  2. The command is off on this machine: "Off", whatever the last tick said.
  3. The command is on and the last tick decided nothing for it, or still said `switched off on this machine` (it was switched on since): nothing is said.
  4. The decision is `not due`, the check found no work: "No work".
  5. The decision starts with `not on <start point>: `, or with `not on <start point> as this clone last saw it: ` (`not on origin/main: a run's checkout starts from origin/main, and the command's skill is not there`): the scheduler would have started the command, and its skill is not on the start point [11]. "Cannot start yet: its skill is not on <start point>", the start point as the tick named it ("Cannot start yet: its skill is not on origin/main"), followed by ", as this machine last saw it" when the tick's line says so, origin not having been reached ("Cannot start yet: its skill is not on origin/main, as this machine last saw it"); or, when the tick named `HEAD`, as in a repository with no remote, "Cannot start yet: its skill is not committed". A command switched off on this machine says "Off" by rule 2, like any other.
  6. The decision starts with `started `: "Started a run".
  7. The decision is `not due (last start <age> ago, …)`, the interval of the command's pace [7] has not passed: "Started <age> ago, not due yet", the age as the tick wrote it ("Started 2h ago, not due yet", "Started less than a minute ago, not due yet").
  8. The decision is `not due (next start from <YYYY-MM-DD HH:MM>, …)`, the command waits for its time of day: "Next: " and that time as a coming time, below ("Next: Saturday 10:00").
  9. The decision is `cap reached (<N> in flight: …)`: "One is already running" when N is 1, else "<N> are already running" ("3 are already running").
  10. Any other decision: the tool's own line with a capital ("Quota: …", "Check failed: …", "Not ready: …").
- **A coming time**, for a person, from a local time and the time now, by how many local days lie between the two days: "today 10:00" on the same day, "tomorrow 10:00" on the next, the weekday from the second to the sixth day after ("Saturday 10:00"), else the day and the month ("15 Oct 10:00"). The time is written in 24 hours with two digits each. A time that is now or already past reads "as soon as the scheduler looks": it was read off an old tick, and the scheduler has not ticked since ("Next: as soon as the scheduler looks").
- **The publish picks' labels**: "Nothing", "Commit", "Publish branch", "Open PR", "Merge on green", in that order.
- **Which picks a project is offered**: all five where one of the project's packages provides a git host; "Nothing", "Commit" and "Publish branch" only where none does, since no pull request can be opened there. The pick a menu shows, when the project is not offered it, is listed after them, so a menu always lists the entry it shows.
- The bound of the spend cushion as the dashboard's controls set it, 50 points either side of the quota boundary, is the dashboard's own number, handed on from `@openagt/dashboard/module`.

### A number of agents in the Edit box

#### Context

**User story**: on the Automations page the user opens a page row and picks how many agents may work on its command at once: as the skill says, or up to a number they type. The box shows, before anything is saved, how the command would read.

#### Business logic

A draft is what the Edit box holds of a number of agents while a person picks. It is one of two kinds: "as the skill says"; or "own", with a count as the text typed.

- **The draft a command's Edit box opens with**: "as the skill says" for a command with no agents pick [9]; else "own" with the agents pick as its count, also when that number equals the skill's.
- **A draft as the words of the command**, after `agent-scheduler agents <command>`: `skill` for "as the skill says", and for "own" the count (`3`). Spaces around the count are ignored and a leading zero is dropped (`03` is `3`). A draft has no words, and is no number yet, while its count is not a whole number from 1 to 99 written in digits alone (empty, `0`, `1.5`, `-2`, a word, `1e2`, `100`).
- **The command as it would read with a draft saved**: the command with the draft's count as its agents pick, or with no agents pick for "as the skill says". While the draft is no number yet it is the command as it is.

### A pace in the Edit box

#### Context

**User story**: on the Automations page the user opens a page row and picks when its command runs: as the skill says, whenever there is work, or every so many minutes, hours, days, weeks or months, with a time of day beside days or more. The box shows, before anything is saved, how the command would read.

**Problem**: a count and a time are typed a key at a time. A half-typed one ("", "1.5", "25:00") is no pace yet and must not be sent to the command. A browser's time field reports no text at all while its time is half typed, which reads the same as a field left empty on purpose: the two must be told apart.

#### Business logic

A draft is what the Edit box holds of a pace [7] while a person picks. It is one of three kinds: "as the skill says"; "whenever there is work"; or "every", with a count and a time of day as the text typed, a unit, and whether the time field is half typed (the page says so when the browser reports the field's entry as bad).

**The draft a command's Edit box opens with** follows its pace pick [8]:

- No pace pick: "as the skill says".
- "Whenever there is work", exactly true: that, for a command whose skill gives it both an interval and a check. For any other command it is "as the skill says": a command with a check and no interval runs whenever there is work already, and a command with no check cannot follow it.
- An interval that reads: "every", with its count, its unit, and its time of day when the interval is in days, weeks or months and the time reads as one, else no time. An interval that does not read: "as the skill says". A saved "whenever there is work" that is not exactly true is passed over, and the pace pick is read by its interval.

**A draft as the words of the command**, after `agent-scheduler pace <command>`: `skill` for "as the skill says", `work` for "whenever there is work", and for "every" the interval (`2d`, `15m`) followed by the time of day when one is typed and the unit is days, weeks or months (`2d 10:00`). Spaces around the count and the time are ignored. A time left in the draft beside minutes or hours is left out, since the page hides the field then. A draft is no pace yet, and has no words, in two cases. Its count is not a whole number from 1 to 9999 written in digits alone (empty, `0`, `1.5`, `-2`, a word, `10000`, `1e2`). Or its unit is days, weeks or months and its time is half typed, or typed and no time of day (`25:00`); beside minutes or hours a half-typed time left behind does not count.

**What keeps a draft from being a pace yet**, for the person typing it: "Type a whole number, from 1 to 9999." for the count, else "Finish the time, like 10:00, or clear it." Nothing for a draft that is a pace.

**The command as it would read with a draft saved** is what the Edit box's sentence describes: the command with the draft as its pace pick, or with no pace pick for "as the skill says". While the draft is no pace yet it is the command as it is.
