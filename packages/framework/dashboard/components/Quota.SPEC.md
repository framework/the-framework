The dashboard's "Usage" card: draws the account's quota week as one bar the user reads at a glance to answer "am I spending too fast?", and lets the user drag where unattended work stands down.

## User story

- The user wants to know, without doing arithmetic, whether the account is ahead of or behind the pace its subscription week allows.
- The user wants to decide how much of the week's remaining allowance The Framework may spend on its own, and to turn unattended work off entirely without hunting for a setting.
- When the reading is missing or stale, the user wants to be told precisely what went wrong instead of seeing a quietly plainer panel.

## Business logic — TL;DR

- **The week as one bar** - the account's quota week runs edge to edge, from when it began to when it resets: the filled part is what has been spent, the dimmed part after it is the room left before unattended work stops, and a vertical mark shows the quota boundary.
- **Colour is the verdict** - the fill's colour compares consumption to the quota boundary: comfortably under, within a five-point band of it, over it, or the week fully spent.
- **Pace stated as time, not just percent** - beside the bar: how far ahead of or behind the boundary's pace consumption is (as a duration), how much of the week's allowance has been consumed (as a duration), that amount as a percentage of the allowance elapsed so far, and when the week resets.
- **Dragging the bar sets the budget** - the handle at the dimmed segment's right edge is the limit for unattended work; moving it stores the user's offset from the quota boundary, capped either way.
- **Autonomous AI on or off** - the bar states in words whether unattended work is enabled, and warns when the handle is set more than a full day's worth of pace past the quota boundary.
- **A missing week is an error, not a downgrade** - when the week cannot be placed on an axis, the card says so loudly and quotes what it actually received.
- **Say why there is no reading** - each reason usage is unavailable gets its own sentence, plus the age of any numbers still on screen.

## Business logic

### The week as one bar

#### User story

See `## User story`.

#### Business logic

The bar spans the account's quota week: its left edge is when the week began, its right edge is when it resets. Above it, a two-letter weekday label marks each calendar day, each day taking the share of the bar it actually occupies, so a week that started mid-day shows that day's two parts at their real widths and labels only the larger of them. Notches through the bar delimit the days.

Inside the bar, in order: the share of the week already used at full opacity; then, dimmed, the room between that and the limit for unattended work; then a vertical mark at the quota boundary — the pro-rated share of the week that may be spent by now. The boundary is drawn at the exact instant the clock is at, matching the value the daemon acts on, rather than stepping once a day.

#### Rationale

Used amount and budget are one bar split in two rather than a fill plus a separate floating handle, and the quota boundary sits inside the same track, so "am I ahead or behind?" is a glance rather than a comparison between two differently scaled meters.

### Colour is the verdict

#### User story

See `## User story`.

#### Business logic

One colour scale drives the fill, the legend swatches, and the pace figures. The week reads as under the boundary, near it (within five percentage points either side), over it, or fully spent at 100%. The band exists so a reading that hovers exactly on pace does not flip colour between polls over noise.

### Pace stated as time, not just percent

#### User story

See `## User story`.

#### Business logic

Under the bar, a single line reads: "Over-consuming" or "Under-consuming" with the gap between consumption and the quota boundary expressed as a duration of the week; the amount consumed, also as a duration; that amount as a percentage of the allowance the quota boundary permits by now, where 100% is exactly on pace; and the day the week resets. Each carries a tooltip spelling the same figure out in long form. The percentage-of-pace figure is omitted in the first moments of a week, when the allowance so far is zero and any spend is infinitely above it.

When the account reports windows beyond its own week — a session window, or a single model's week — a "show all limits" tooltip lists each with its percent used and reset text. It appears only when there is something beyond the week the bar already shows.

#### Rationale

A percentage of the whole week says little about whether today's rate is sustainable; a duration says exactly how far off pace the account is.

### Dragging the bar sets the budget

#### User story

See `## User story`.

#### Business logic

The dimmed segment's right edge is a draggable, keyboard-operable handle labelled "Unattended work stops at". Moving it stores the user's spend offset — the signed distance from the quota boundary — into the preferences, clamped to the maximum offset either side.

The handle's position is held locally until the daemon's stored value comes back on the next quota poll, so the control does not snap back between polls and repeated key presses each move it a further step rather than recomputing from the same stale number.

### Autonomous AI on or off

#### User story

See `## User story`.

#### Business logic

Unattended work is enabled exactly when the handle leaves room beyond what has already been used. The legend row states which it is — "Autonomous AI enabled", with the hint to move the slider left to disable, or "Autonomous AI disabled", with the hint to move it right to enable — and its tooltip explains the difference: enabled means agents pick up queued tasks and tasks get queued on their own; disabled means every piece of agent work is started by the user.

When the handle sits more than one seventh of the week (a full day's worth of pace) past the quota boundary, an "Eager consumption" warning appears saying how much faster than the week's pace unattended work will spend.

The legend also names the three parts of the bar — "Used", "Budget for Autonomous AI", and "Quota boundary" — the last with a tooltip stating that the quota boundary is not a hard limit but a pro-rated share of the weekly limit, and that it is drawn at the current time in the week.

### A missing week is an error, not a downgrade

#### User story

See `## User story`.

#### Business logic

Drawing the bar needs both the account's own week and a placeable span for it. When either is missing but some usage was reported, the card shows an alert instead of the bar, in one of three distinct wordings: no week line at all in the readout, quoting the labels that were reported instead; a week that reports a percentage but no reset time, so there is no span to place it in; or a reset phrasing this version does not recognize, quoted verbatim.

In that case, the individual windows the account did report are listed directly under the card, since without a bar there is nowhere else for them to live.

#### Rationale

The card used to fall back to showing the week as a plain figure, which hid a real defect: an unrecognized reset phrasing simply made the panel plainer and nothing said the boundary was gone. The error message quoting the offending text is the bug report, which is also why a reset-less week is described as normal-but-unplaceable rather than as a parse failure.

### Say why there is no reading

#### User story

See `## User story`.

#### Business logic

When usage cannot be read, the card explains which case it is: the account has no subscription usage to report, so there is no boundary to measure against; Claude Code was not found; the readout was in a shape this version does not recognize; or the refresh simply failed. The last two are worded differently depending on whether older numbers are still on screen — "these numbers are from the reading before it" / "may be a little behind" versus "trying again shortly" / "reading your usage now". Whenever numbers survive a failed refresh, the card appends how long ago they were read, so the bar never silently claims to be current.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
