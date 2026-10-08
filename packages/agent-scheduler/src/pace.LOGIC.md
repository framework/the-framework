The pace [1] of a scheduled command [5]: how an interval [2] and a time of day [3] are read from text, what a person's pace pick [4] holds, which pace is in force for a command (this machine's pace pick, else its skill's interval), from when a command is due by its pace, and what switching a command on does to a pace with a time of day. Pure rules with no file and no clock of their own, so the tick (`tick.ts`), the command line (`cli.ts`), the schedule reader (`schedule.ts`) and the package's dashboard part all read the same ones.

## Context

**User story**: the project's `triage` skill says `every: 6h`. One person, the only one who runs the project's scheduler, finds that too often and sets "every 2 days at 10:00" on their machine: from then on `/triage quick` starts at most every second day, from 10:00 on. Where a teammate's machine also has the command switched on, at the skill's six hours, the command still starts every six hours: the slower pace slows only the starts the first person's machine makes. The command's last start is shared, so each start the teammate's machine makes moves the first machine's next day on, and the first machine starts none while the other keeps going. The work runs at the fastest pace among the machines that have the command switched on. Another person wants `/update-tickets`, which its skill paces with an interval and a check, to run whenever its check finds work, and sets that. Each can take their pace pick [4] back and run at the skill's pace again. No tracked file changes.

**Business logic story**: a skill gives its command a starting pace, the same for every machine, with the `every` key of its `schedule`. A person's pace pick is kept in the tool's state (`state.ts`), written by `agent-scheduler pace` (`cli.ts`) or from a dashboard. The tick asks this file two things per command: which pace is in force, and from when the command is due by it. The command's last start is read off the run records on the project's `agent-data` branch (`records.ts`), on any machine. So a pace is the least time since the command last started anywhere, not since this machine last started it: a machine never starts a command sooner than its own pace allows after any machine's start, and it cannot hold another machine back.

**Problem**: a time of day must behave like a calendar event. A machine that was asleep at 10:00 must still start the command when it wakes, and only once. And setting "every day at 10:00" at 11:00, or switching the command on at 11:00, must not start the command at once.

## Glossary

[1] pace: how often at most a scheduled command starts, the one in force on a machine: an interval [2], with a time of day [3] when it has one. A command its check [6] alone paces has no pace.
[2] interval: a count and a unit: minutes (`m`), hours (`h`), days (`d`), weeks (`w`, 7 days) or months (`mo`, 30 days), written together (`15m`, `2w`). It is the least time since the command's last recorded start, on any machine, before it may start again.
[3] time of day: an hour and a minute on a 24-hour clock (`10:00`), in the machine's own local time. It goes only with an interval in days, weeks or months.
[4] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[5] scheduled command: one command a skill of the project schedules with the `schedule` key in the front matter of its `SKILL.md`.
[6] check: the shell command a skill's `schedule` gives a command as `when`; its output says whether there is work.

## Business logic — TL;DR

- **An interval** - digits and a unit, `m`, `h`, `d`, `w` or `mo`; a count from 1 to 9999; a week is 7 days and a month 30; kept as written without a leading zero.
- **A time of day** - `HH:MM` on a 24-hour clock, the hour in one or two digits; allowed only beside days, weeks or months.
- **A pace pick** - "whenever there is work", or an interval with an optional time of day and the time its time of day counts from: when the pick was made, or when the command was last switched on with it.
- **The pace in force** - this machine's pace pick [4], else the skill's interval; none for a command its check alone paces; a pace pick that cannot be read is no pace pick; only a "whenever there is work" that is exactly true is one, and it holds only while the command has a check; a time of day beside minutes or hours is not followed.
- **Due from** - without a time of day, the interval after the last start, and at once for a command never started; with one, that time on the day the interval's days after the day of the last start, and never before the first such time after the pace pick was made or the command was last switched on with it.
- **Counting from the switch** - switching a command on sets the time a pace pick's time of day counts from to now; a pace pick with no time of day is unchanged. The command line does this only for a command that was off.
- **As a decision writes them** - a pace is `6h` or `2d at 10:00`; a local time is `2026-10-10 10:00`.

## Business logic

### An interval

#### Context

See `## Context`.

#### Business logic

An interval [2] is read from text made of digits followed by one unit: `m` (minutes), `h` (hours), `d` (days), `w` (weeks) or `mo` (months), with nothing between or around them (`15m`, `6h`, `7d`, `2w`, `1mo`). A week counts as 7 days and a month as 30 days, whatever the calendar says. The count is a whole number from 1 to 9999. A count of 0 is no interval, since it would spell "always". A count above 9999 is no interval either: past it nobody means a pace, and far past it the day a command would be due is no date any more, which must never read as "due". The same bounds hold wherever an interval is read: a skill's `every`, a pace pick, a count typed on a dashboard. The interval is kept as its count, its unit, its length, and its text without a leading zero (`06h` is kept as `6h`). Any other text is no interval: a unit alone, a number alone, a space inside, an unknown unit (`1y`), a minus sign, a fraction, a plain word, empty text.

### A time of day

#### Context

See `## Context`.

#### Business logic

A time of day [3] is read from text of the shape `HH:MM`: an hour of one or two digits, from 0 to 23, a colon, and a minute of exactly two digits, from 00 to 59 (`10:00`, `9:05`, `23:59`). It is kept with the hour written in two digits (`9:05` is kept as `09:05`). Any other text is no time of day (`24:00`, `10:60`, `10`, `10:0`, `10am`, empty text).

A time of day may go with an interval [2] only when the interval's unit is days, weeks or months. Beside minutes or hours it means nothing.

### A pace pick

#### Context

See `## Context`.

#### Business logic

A pace pick [4] is one of two things:

- "Whenever there is work": the interval is taken away and the check [6] alone says when.
- An interval [2] as text, an optional time of day [3] as text, and the time its time of day counts from, as an ISO time: when the pick was made, or when the command was last switched on with it ("Counting from the switch", below).

### The pace in force

#### Context

**Problem**: the state file can be edited by hand, and a pace pick made for one version of a skill can outlive it (the skill lost its check). A pace pick that cannot be followed must not stop the command: the skill's pace stands.

#### Business logic

The pace [1] in force for a command is worked out from this machine's pace pick [4] for it, when there is one, and from what the command's skill says (its interval, when it has one, and whether it has a check [6]):

- No pace pick: the skill's interval. A command whose skill gives no interval has no pace: its check alone says when.
- A pace pick of "whenever there is work", for a command with a check: no pace. For a command with no check, nothing would say when, so the skill's interval stands. Only a "whenever there is work" that is exactly true counts: a pace pick that holds another value there is read by its interval.
- A pace pick with an interval that reads: that interval. Its time of day is followed only when it reads as one and the interval is in days, weeks or months; a time of day beside minutes or hours is not followed, and the interval alone paces. The time the time of day counts from is kept only beside a time of day that is followed.
- A pace pick that cannot be read: as if there were none, the skill's interval. That is a saved value that is not an object (plain text, a number, nothing), and an object that holds neither a "whenever there is work" that is exactly true nor an interval that reads (a word, a number, a count above 9999).

### Due from

#### Context

See the **Problem** in `## Context`.

#### Business logic

Given a pace [1], the command's last start (none when it never started) and the time now, this file answers the time from which the command is due. A time already past means the command is due now.

Without a time of day [3], the command is due from the interval [2] after its last start, counted in hours and minutes, also when the interval is in days (a command last started on the 8th at 09:30 with a pace of 2 days is due from the 10th at 09:30). A command that never started is due at once.

With a time of day, two times are worked out, both in the machine's own local days:

- **After the last start**: the time of day on the day that is the interval's days after the day of the last start, whatever the hour of that start. With "every 2 days at 10:00", a start on the 8th at 10:02 and a start on the 8th at 23:50 both give the 10th at 10:00. A week adds 7 days and a month 30.
- **The first after the pace pick**: the time of day on the day the pace pick [4] was made, or the command was last switched on with it, when that was at or before the time of day (at 10:00 sharp counts), else on the day after. A pace pick with no readable record of that time has none.

The command is due from:

- Never started: the first after the pace pick. With no record of when the pick was made, today's time of day.
- Started before: the later of the two times. So a command last started long ago, whose person sets "every day at 10:00" at 11:00, waits for tomorrow's 10:00. And a command that started today at 10:00, whose person moves its time to 16:00 at 11:00, waits for tomorrow's 16:00: it does not start a second time today. A last start in the future (another machine's clock runs ahead) is counted from like any other.

Two things follow. A time that was missed, because the scheduler was not running then, is still due when the scheduler next ticks: the due-from time is in the past. It starts once: that start is a new last start, which moves the next due-from time the interval's days on (a machine that last started the command on the 5th, slept through the 6th and the 7th and wakes on the 8th at 08:00 starts it then, and is next due on the 9th at 10:00, not on the 8th at 10:00 as well). And a pace pick starts nothing before its first time of day, like a calendar event.

### Counting from the switch

#### Context

**Problem**: a person sets "every day at 10:00" for a command and leaves it switched off for a few days. When they switch it on at 15:00, the first 10:00 after the pick is long past, so the command would start at once. Ticking a switch after the time must wait for the next one, as setting the time after it does.

#### Business logic

Switching a command on (`cli.ts`) asks this file for the command's pace pick [4] counted from now. A pace pick that holds an interval and a time of day is answered with the time its time of day counts from set to now, and everything else of it as it was. Any other saved value is answered unchanged: a pace pick with no time of day, "whenever there is work", none, or a value that is no pace pick at all. Switching a command off changes nothing of its pace pick.

### As a decision writes them

#### Context

**User story**: the tick's decision for a command that is not due yet names its pace and, for a pace with a time of day, the time it is next due from (`tick.ts`).

#### Business logic

A pace is written as its interval's text, followed by ` at ` and its time of day when it has one: `6h`, `2d at 09:05`. A time is written in the machine's local time as `YYYY-MM-DD HH:MM`: `2026-10-10 09:05`.
