Computes the quota boundary [1]: the share of the account's quota [2] week that may have been spent by now, derived from nothing but the week's reset time as the coding agent [3] phrases it. The boundary is the elapsed share of the seven-day week and rises continuously with the clock. The Framework only places and draws it: no line that work stops at is computed here.

## Context

**User story**: the account's week is meant to be spent evenly: a quiet week still gets spent instead of expiring unused. In the dashboard's usage panel the user sees where the boundary sits against what is used. The Framework starts no unattended [4] work itself: a package that does, such as the scheduler, keeps its own copy of this rule, decides how far past the boundary its work may start, and may put that stop line on the usage bar through its own module (`dashboard/module/index.ts`).

**Problem**: The Framework never calls a model itself, so it knows the account's allowance only as the coding agent reports it: windows with a percentage used and a reset time written as prose, without a year. There is nothing to configure. A fixed limit would either strand allowance in a quiet week or run dry early in a busy one, while a boundary derived from the week itself reaches the full allowance exactly as the week resets, so nothing is left on the floor.

## Glossary

[1] quota boundary: the share of the quota week that may be spent by now, rising with the clock. The dashboard only draws it; whether work stops at it is the business of whatever starts unattended work.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] unattended: said of an agent nobody is watching: one a package started on its own rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.

## Business logic — TL;DR

- **Reading the week's reset time** - the coding agent's prose ("Jul 25 at 7am (Asia/Jerusalem)", or "Jul 25, 7am") is placed in the one year that lands within reach of now; text that cannot be read means "unknown", never a boundary of zero.
- **The boundary rises with the clock** - the week starts seven days before it resets; the boundary is the elapsed share of those seven days as a continuous percentage, and the day of the week, 1 to 7, steps at the exact moment each day rolls over.
- **The account's week places the boundary** - the boundary is read off the account's own week window ("all models"); the session window and a model's own week place nothing.
- **Unknown is not zero** - with no week window, no reset time, or an unreadable one, there is no boundary at all, and the caller decides what "unknown" means.

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

### The account's week places the boundary

#### Context

**Problem**: the coding agent [3] reports several windows: a session window of a few hours, the account's week across all models, and a week of its own for some models. The usage bar is about the account, so only the account's week may place the boundary.

#### Business logic

Given the windows the coding agent reported and the current time, the boundary is the one of the account's own week: its reset time is read (see "Reading the week's reset time") and the boundary placed from it (see "The boundary rises with the clock"). It carries when the week began, when it resets, the day of seven and the percentage. A session window or a model's own week is never used, even when it is the only window that carries a reset time.

### Unknown is not zero

#### Context

**Problem**: an unreadable reading must not masquerade as an empty week, nor as a spent one.

#### Business logic

There is no boundary at all when the coding agent [3] reported no weekly window for the account, when that window carries no reset time, or when the reset time cannot be read. "No boundary" means "we do not know where the week is". What to do with it is the caller's decision, not this file's: the daemon's quota reading in `dashboard/quota.ts` turns it into a view with no boundary, which the usage panel reports as a week it cannot draw.
