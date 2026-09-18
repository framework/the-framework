The spend boundary [1]: how much of the account's quota [2] week unattended work may have spent by now, and the one line that says why a run may not start. The boundary is The Framework's, copied as it is, and the stand-down is this tool's own: the boundary is the pro-rated share of the week's allowance that has elapsed, rising continuously with the clock, and unattended work stands down once a quota window in force is used past the boundary plus the spend cushion [3]. Two properties fall out of it: nothing is left on the floor, since the boundary reaches the full allowance exactly as the week resets; and work a person asks for cannot be starved by work nobody asked for.

## Context

**User story**: the user's subscription has a weekly allowance; scheduled agents may spend it at the pace the week passes, half a day ahead by default, and never faster, so when the user sits down to work there is always the share of the week that has not elapsed yet; the user moves that line with `agent-scheduler offset <points>`, and a stand-down reads as a setting (`at or past day 4 of the 47% line (+10 on the week's 37%)`), not as a bug.

**Business logic story**: the tick reads the quota through `agent-driver` (which reads Claude Code's own usage readout) only when a command is due, under its cap and about to start, and asks this file once per tick. The boundary is copied rather than imported from The Framework because this tool depends on `agent-driver`, which reads the windows, and not on The Framework, which only draws the boundary in its usage panel and stands nothing down.

## Glossary

[1] spend boundary: the share of the account's quota week that has elapsed, as a percentage rising continuously with the clock; unattended work stands down once a quota window in force is used past the boundary plus the spend cushion.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used and, for the week, the prose of when it resets (`Jul 25 at 7am (Asia/Jerusalem)`).
[3] spend cushion: how far past the spend boundary a run may still start, in percentage points; the state's `spendOffset`, 100/14 by default. Positive is lenient, negative is strict.
[4] quota window: one of the coding agent's readings: the account's week (`Current week (all models)`), or one model's own week (`Current week (Fable)`).
[5] the limit: the line unattended work stops at: the spend boundary plus the spend cushion, clamped to 0 to 100.

## Business logic — TL;DR

- **The reset prose as an instant** - `Jul 25 at 7am (Asia/Jerusalem)` or `Jul 25, 7am`, minutes and zone optional, no year: of the three candidate years the one nearest now is it, since a week resets within seven days; anything that does not parse, an unknown zone, or a date that does not exist that year is "we do not know".
- **The boundary** - the week starts seven days before it resets; the boundary is the elapsed share of that week as a percentage, 0 at the first instant, 100 at the reset, never stepped by the day; the day of the week, 1 to 7, is kept beside it for a person.
- **The windows in force** - the account's week always; the selected model's own week too, when the window's label names the model the run will start on; other models' windows never stop the work.
- **The limit** - the boundary plus the spend cushion, clamped to the week: a limit dragged below 0 stops at 0 ("always stopped" would otherwise read as a negative), one past 100 stops at 100 ("never stops" would be unreachable).
- **Headroom** - no reading, or a week that cannot be placed, stands the run down: `the quota could not be read, so there is no way to tell what is spare`; a window at or past the limit stands it down with `<window> is <used>% used, at or past day <D> of the week's <P>%`, or, with a cushion, `… of the <L>% line (<+/-C> on the week's <P>%)`; otherwise the run may start.

## Business logic

### The reset prose as an instant

#### Context

**Problem**: the coding agent prints when the week resets as prose with no year, `Jul 25 at 7am (Asia/Jerusalem)`, and newer versions print a comma where older ones print `at`; the driver keeps it as text.

#### Business logic

The prose is read as a month, a day, an hour with optional minutes, `am` or `pm`, and an optional zone in parentheses; without a zone, this machine's zone. It is recoverable without a year because a weekly window resets within seven days: of the previous, current and next year, the candidate nearest now is the reset; a candidate that lands on a different day than printed (Feb 29 in a non-leap year) is dropped. The zone's offset is resolved at the reset instant itself, so a reset across a daylight-saving change is placed right. Prose that does not parse, an hour outside 1 to 12, a month that is not a month, or a zone the runtime does not know all read as "we do not know", never as a boundary of zero.

### The boundary

#### Context

**Problem**: a boundary that jumped once a day unlocked a whole day's allowance the instant a new day began, the entire week's worth on the last day; continuous keeps the line honest about what has elapsed.

#### Business logic

The week began seven days before it resets. The boundary is the elapsed share of that week, `elapsed / week` as a percentage, clamped to the week: 0 at its first instant, 25 a quarter of the way in (1.75 days), 6/7 of 100 a day before the reset, 100 at the exact instant of the reset. Beside it, the day of the week, 1 to 7, steps at the second the week's own day rolls over, not at midnight, and a week already over reads as day 7, not day 8.

### The windows in force

#### Context

**Problem**: the coding agent reports the account's week and, per model, that model's own week; a spent Fable week must not stop work on Sonnet, and a window whose model cannot be told must not stop work for a model nobody selected.

#### Business logic

The account's week is always in force. A model's own week is in force only when the model the run will start on (the state's model, `opus`, or a full id like `claude-fable-5`) contains the name in the window's label's parentheses, compared without case. With no model given, only the account's week is in force. Every window in force is measured against the same limit, and whichever reaches it first is the one that stops the work.

### The limit

#### Context

See `## Context`.

#### Business logic

The limit [5] is the boundary plus the spend cushion [3] (0 when none is given), clamped to 0 to 100; the boundary itself is not moved, so a panel can draw both. A window has reached the limit when its percentage used is at or past the limit. The status answers the boundary, the limit with its cushion, every window in force with whether it reached the limit, and the first window that did, or none.

### Headroom

#### Context

**Problem**: not knowing is not "nothing used"; unattended work stands down on not knowing, while work a person asks for carries on.

#### Business logic

With no status (no reading, no week window, no reset prose, or prose that cannot be placed), the run may not start: `the quota could not be read, so there is no way to tell what is spare`. With a status and no window reached, the run may start. With a window reached, the run may not start, and the reason names the line it stopped at, the cushion included: with no cushion, `<window's label> is <used>% used, at or past day <day> of the week's <boundary>%`; with one, `<window's label> is <used>% used, at or past day <day> of the <limit>% line (<+cushion or -cushion, one decimal> on the week's <boundary>%)`. Percentages are rounded to whole numbers.
