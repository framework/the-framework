Fixes how every moment and every span of time is worded in the dashboard: full dates, short dates, how long ago something happened, how long until something will happen, plain durations, and the wording of a quota [1] reset. It is also the single place that refuses to render a timestamp it cannot read, so no surface ever shows the browser's literal "Invalid Date".

## Context

**Problem**: timestamps reach the dashboard as plain text and nothing checks them on the way in — an agent's [2] start time comes from the daemon's own record, a ticket's date is read out of its file name. Asked to render text it cannot parse, a browser writes "Invalid Date" into the page. Every place that shows a time goes through the rules here, so an absent or unreadable timestamp shows a placeholder instead.

**Business logic story**: all of these are rendered in the viewer's own language, date order and time zone, since the dashboard runs on the user's own machine and the user's own clock is the one that matters.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] sweep: a background job the daemon runs on its clock.
[4] routine: a preset the daemon fires on its own on a schedule.
[5] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.

## Business logic — TL;DR

- **A timestamp that cannot be read shows a placeholder** - an em dash by default, or whatever the caller asks for, never "Invalid Date" and never a made-up moment.
- **Dates and times** - three widths: the full local date and time, a short "Jul 18, 10:35 PM" for lines where the time stands in as a name, and the date alone for dense table columns.
- **How long ago, in full detail** - "22s ago", "30m ago", "5h ago", "5d ago", "2w ago", "3y ago"; never a bare date, so every row in a list of agents [2] is dated the same way whether it ended this minute or last year.
- **How long ago, at a glance** - "just now", "12m ago", "3h ago", "2d ago", and past a week the local date.
- **How long until** - "in 4 min" or "in 1 hr"; a moment already past reads "any moment" rather than as overdue.
- **Durations** - the largest whole unit, as "2s", "10m", "2h", "1d", and spelled out as "1 day" or "2 hours" where the figure sits inside a sentence.
- **When the quota resets** - "Tuesday 8:59pm" beside the week's bar, and "Quota resets on Jul 28, 8:59pm (Europe/Berlin)" in full, naming the time zone.

## Business logic

### A timestamp that cannot be read shows a placeholder

#### Context

See `## Context`.

#### Business logic

A timestamp that is missing, empty, or not a date at all is not rendered. In its place goes an em dash, or whatever placeholder the caller asks for instead. This applies to the full date and time, the short date and time, the date alone, and both ways of saying how long ago something happened.

### Dates and times

#### Context

**User story**: the user reads a project's last activity as a date and time, sees an unnamed agent [2] in a list identified by the moment it started, and scans a dense table where only the day matters.

#### Business logic

Three widths of the same moment, all in the viewer's own locale and time zone:

- the full local date and time, seconds included, for a fact the user may want exactly;
- a short date and time without seconds, reading as "Jul 18, 10:35 PM", for a line where the moment stands in as a name, so seconds are noise on the line that has to identify the row;
- the date alone, for dense table columns.

### How long ago, in full detail

#### Context

**User story**: the list of agents [2] dates every row the same way, so a row that finished a minute ago and a row that finished last month read as the same kind of fact and can be compared at a glance. The exact moment is available on hover.

#### Business logic

The gap between now and the moment, floored to its largest whole unit, with "ago" after it: seconds under a minute, minutes under an hour, hours under a day, days under a week, weeks under a year, years beyond that. Flooring means "1m ago" is a promise that a full minute has passed, not that a minute is the nearest label. A moment in the future reads "0s ago" rather than a negative span. The week-to-year handover is decided in days, not weeks, so a moment 364 days old reads "52w ago" instead of "0y ago". Unlike the at-a-glance wording, this never falls back to a bare date.

### How long ago, at a glance

#### Context

**User story**: on a board the user scans, freshness matters more than the calendar: "2m ago" answers the question that today's date does not.

#### Business logic

The gap between now and the moment, rounded to its nearest unit: under a minute reads "just now"; then minutes, then hours, then days, up to and including a week. Beyond a week the local date is shown instead, because at that distance the calendar is the more useful fact.

### How long until

#### Context

**User story**: the usage panel says when the next sweep [3] will run and a routine's [4] card says when it will fire next, so the user knows whether to wait or to run it now.

#### Business logic

The gap between the moment and now, rounded to minutes: under an hour it reads "in 4 min", otherwise it is rounded to hours and reads "in 1 hr". A moment that has already passed reads "any moment" rather than as late: a schedule the daemon has not reached yet is imminent, not overdue.

### Durations

#### Context

**User story**: the user reads how far the account's spending is from the quota boundary [5] as a compact figure, and reads the same span spelled out in the sentence that explains the figure.

#### Business logic

A span of time is floored to its largest whole unit. Compactly it reads "2s", "10m", "2h" or "1d", with no "ago" and no weeks, since the figure it backs can never exceed one week. Spelled out for prose it reads "2 seconds", "10 minutes", "2 hours" or "1 day", singular only at exactly one. A negative span reads as zero.

### When the quota resets

#### Context

**User story**: the user reads when the quota [1] week rolls over. The bar above already places the moment within the week, so naming the date again would be the calendar repeating itself.

#### Business logic

The reset is written as the weekday and the time of day, as "Tuesday 8:59pm", with the time in lower case and with no space before the meridiem. The exact moment is available in full as "Quota resets on Jul 28, 8:59pm (Europe/Berlin)", which names the time zone rather than leaving it implicit: the reset follows the account's own clock, and a user working from another zone should not have to guess whether the two agree. The zone named is the one the browser is running in.
