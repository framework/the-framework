Computes the quota boundary [1]: the share of the account's quota [2] week that may have been spent by now, derived from nothing but the week's reset time as the coding agent [3] phrases it. The boundary is the elapsed share of the seven-day week and rises continuously with the clock; the user's spend offset [4] shifts it into the line that unattended [5] work stops at; every quota window in force is then measured against that line, and the first window at or past it is the one that stops the work.

## Context

**User story**: the user leaves the daemon running with Auto PM [6] on. The account's week is spent evenly: a quiet week still gets spent instead of expiring unused, and a burst of unattended agents [7] on Monday cannot leave nothing for the work the user asks for on Friday. In the dashboard's quota panel the user sees where the boundary sits and moves the line unattended work stops at with the spend offset. An agent the user starts by hand never stands down for quota, and an agent already running is never interrupted for it: the status computed here is read before an agent starts, never after.

**Problem**: The Framework never calls a model itself, so it knows the account's allowance only as the coding agent reports it: windows with a percentage used and a reset time written as prose, without a year. There is nothing to configure. A fixed limit would either strand allowance in a quiet week or run dry early in a busy one, while a boundary derived from the week itself reaches the full allowance exactly as the week resets, so nothing is left on the floor. Work the user asks for borrows against the days still to come; unattended work stands down once it passes the line, so low-priority work cannot starve high-priority work.

## Glossary

[1] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[2] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[3] coding agent: The CLI doing the actual work: Claude Code or Codex.
[4] spend offset: The user's adjustment of the quota boundary, in percentage points of the week.
[5] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[6] Auto PM: The daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[7] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.

## Business logic — TL;DR

- **Reading the week's reset time** - the coding agent's prose ("Jul 25 at 7am (Asia/Jerusalem)", or "Jul 25, 7am") is placed in the one year that lands within reach of now; text that cannot be read means "unknown", never a boundary of zero.
- **The boundary rises with the clock** - the week starts seven days before it resets; the boundary is the elapsed share of those seven days as a continuous percentage, and the day of the week, 1 to 7, steps at the exact moment each day rolls over.
- **The spend offset moves the line** - the line in force is the boundary plus the offset in percentage points, clamped to the week's two ends; the boundary and the line are reported side by side so moving the line never redraws the boundary.
- **Which windows are in force** - the account's week always; the selected model's own week only when the window's label names a model that the selected model's name contains; the session window and unrecognized windows never gate.
- **Reached** - a window is reached when its percentage used is at or past the line; the first reached window, in the order the coding agent reported them, is the one that stops the work, and there is room while none is reached.
- **Unknown is not zero** - with no week window, no reset time, or an unreadable one, there is no status at all, and the caller decides what "unknown" means.

## Business logic

### Reading the week's reset time

#### Context

**Problem**: the coding agent [3] prints when a window resets as a sentence such as "Jul 25 at 7am (Asia/Jerusalem)", without a year, so the driver hands it on as text. The year is recoverable here because of something the driver does not know: a weekly window resets within seven days, so of the candidate years exactly one lands anywhere near now.

#### Business logic

The reset text is read as a three-letter month name, a day of the month, then a time as an hour from 1 to 12 with "am" or "pm", with minutes optional, then optionally a time zone name in parentheses. Two phrasings are accepted, since both are in the wild: "Jul 25 at 7am (Asia/Jerusalem)" and "Jul 25, 7am". Letter case and surrounding whitespace do not matter. Without a zone, the machine's own time zone is used.

The date is tried in the previous year, the current year and the next year, counted in UTC, and the candidate closest to now wins. A candidate that falls on a different day of the month than the one printed is dropped: "Feb 29" in a non-leap year rolls into March and is not the date the coding agent printed. The wall-clock time is placed in its zone with the offset in force at that instant, so a reset on the far side of a daylight-saving change is placed correctly.

Anything that does not read yields no time: an unknown month, an hour outside 1 to 12, a time zone name the runtime does not know, or any other shape. No time means "we do not know where the week is", never a boundary of zero.

### The boundary rises with the clock

#### Context

**Problem**: a boundary that steps once a day releases a whole day's allowance the instant a new day begins, and the entire week's worth on the last day, so a burst of spending lands the moment the clock ticks over instead of pacing with it. A continuous boundary keeps the line honest about what has actually elapsed, at the cost of that burst.

#### Business logic

The quota [2] week is the seven days ending at the reset time, so it starts seven days before it. The boundary's percentage is the share of those seven days elapsed at this instant, from 0 to 100, continuous, and clamped: before the week's start it is 0 and at or after the reset it is 100. Alongside it the boundary names the day of the week now falls on, from 1 to 7, for a panel that wants to say "day 4 of 7": it is the number of whole days elapsed plus one, capped at 7, and it steps at the exact second the week's own day rolls over, independently of the percentage.

### The spend offset moves the line

#### Context

**User story**: the user drags the quota panel's line to allow unattended [5] work more, or less, than the pace of the week; the boundary stays drawn where it is.

#### Business logic

The line in force is the boundary's percentage plus the spend offset [4] in percentage points, clamped to 0 and 100. An omitted offset counts as 0, and with an offset of 0 the line is the boundary itself. The offset the user chose is passed in; its default, a half-day cushion, and its cap are set in `preference-defaults.ts`. The clamp exists so that a line dragged past either end of the week stops at the week's end rather than becoming unreachable, which would read as "never stop", or negative, which would read as "always stopped". The line is reported as two values, where it sits and how far it is from the boundary, and the boundary is reported beside it: the panel draws both, and moving the line must never silently redraw the boundary it is measured against.

### Which windows are in force

#### Context

**Problem**: the coding agent [3] reports several windows: a session window of a few hours, the account's week across all models, and a week of its own for some models. Only weekly windows can be measured against a weekly boundary, and a per-model week must only bind when it is the week of the model the work will run on, or it would stop work for a model nobody selected.

#### Business logic

The account's week is always in force. The selected model's own week joins it only when a model was given and the window's label carries a name in parentheses, such as "Current week (Fable)", that the selected model's name contains, compared without regard to case: `claude-fable-5` contains `fable`. A per-model window whose label names no model, or names a model the selected model's name does not contain, is left out. The session window and windows the driver could not recognize never gate. Every window in force is measured against the same line, and both weekly windows bind at once: whichever reaches the line first is the one that stops the work.

### Reached

#### Context

See `## Context`.

#### Business logic

Each window in force is reported with its label exactly as the coding agent [3] phrased it, its percentage used, and whether it has reached the line: it has when its percentage used is at or past the line's percentage. The status names the first reached window, in the order the coding agent reported them, as the one that stops the work; while no window is reached, there is room.

### Unknown is not zero

#### Context

**Problem**: an unreadable reading must not masquerade as an empty week, which would let unattended [5] work spend freely, nor as a spent one, which would silently stop it.

#### Business logic

There is no status at all when the coding agent [3] reported no weekly window for the account, when that window carries no reset time, or when the reset time cannot be read. "No status" means "we do not know where the week is". What to do with it is the caller's decision, not this file's: the daemon's quota reading in `dashboard/quota.ts` is where an unknown status is turned into a decision.
