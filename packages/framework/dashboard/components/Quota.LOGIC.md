The "Usage" panel: the account's quota [1] week drawn as one week-long track, with what has been spent and the quota boundary [2] as a line through it. When an installed module [7] declares a stop line [3], the track also shows the room left before that module's unattended [4] work stands down, with a draggable handle that sets the stop line's offset and, once the handle rests, saves it through the module. Below the track the panel says how far ahead of or behind the week's pace the account is, when the week resets, whether "Autonomous AI" currently has room to spend (only with a stop line), and, whenever the week cannot be drawn, exactly why.

## Context

**User story**: the user glances at the Overview [8] to answer "am I ahead of or behind my week's allowance, and will unattended [4] work keep going?" and drags one handle to let unattended work spend more or less of the week. The handle sits where the module's own setting is and saves to it, so what the bar shows and what unattended work obeys never disagree. A dashboard with no package that starts unattended work shows the account only: what is used, and the boundary.

**Business logic story**: the panel reads the daemon's cached quota reading, refreshed every 30 seconds while the panel is open; a failed refresh keeps the last reading on screen (the polling lives in `lib/quota.ts`). The drawing arithmetic (day segments, tone, limit, projection, pace figures) lives in `lib/quota-bar.ts`; where the boundary sits is the daemon's rule in `src/quota-boundary.ts`, which the panel never re-derives. The stop line is not the dashboard's: a module declares it in its definition (`usageLimit`, see `module/index.ts`), the shell mounts the first module's that declares one (`lib/use-modules.ts`), and the panel asks that module to read the offset and to save a new one, each through the module package's own command. The dashboard names no package here; today the `agent-scheduler` package declares the stop line, and its Settings section shows the same number.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock. The dashboard only draws it; whether work stops at it is the business of whatever starts unattended work.
[3] stop line: where a module's unattended work stops, as an offset from the quota boundary in percentage points of the week, negative before the boundary and positive past it. The module reads the offset in force and saves a new one; the bar draws the line and its handle.
[4] unattended: said of an agent nobody is watching: one a package started on its own rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[7] module: a package that adds to the dashboard (pages, Overview cards, Settings sections, the usage bar's stop line, and more); its browser part reads and writes its data through its own package's command.
[8] the Overview: the dashboard's cross-project page at `/`.

## Business logic — TL;DR

- **Before and without a reading** - "Reading your usage…" until the first answer; when the coding agent [5] cannot report, a sentence says why, and numbers kept from an earlier reading are dated with "Last read …".
- **The week as one track** - the account's week runs edge to edge with one two-letter label per calendar day, the spent share as a solid fill, and the quota boundary [2] as a line at the elapsed share of the week; with a stop line [3], the room left for unattended [4] work as a dimmed segment after the fill; the color says how spending compares with the boundary.
- **A module's stop line and its handle** - the stop line [3] is the first installed module's [7] that declares one; the panel asks it for the offset every 10 seconds, given the projects that have its package. Dragging the dimmed segment's edge ("Unattended work stops at") sets the offset, clamped to ±50 points, drawn at once and saved through the module once the handle has rested for half a second; a save that fails says why, and the handle goes back to the value the module reads. With no such module, or while the module answers no offset, the bar has no handle.
- **The figures under the track** - "Over-consuming"/"Under-consuming" as a duration, what was spent as quota time, consumption as a share of the pace, when the week resets, and "show all limits" for every window the coding agent reports.
- **Legend, "Autonomous AI" status and the eager warning** - the legend names the marks; with a stop line, the status says whether unattended work currently has room ("enabled"/"disabled") and how to change that; "⚠️ Eager consumption" appears once the handle sits more than a day's worth ahead of the boundary.
- **A week that cannot be drawn is an error, not a plainer panel** - when the reading has windows but no placeable week, a red alert names the exact missing or unrecognized text, the reported windows are still listed, and there is no handle.

## Business logic

### Before and without a reading

#### Context

**Problem**: an empty track reads as "nothing used", which is the opposite of "not known yet"; and a reading that failed must not be mistaken for a live one.

#### Business logic

- Until the daemon's first answer arrives the panel shows "Reading your usage…" and no track.
- When the latest attempt to read the quota [1] failed, a note explains it, by reason:
  - The account has no subscription: "This account has no subscription usage to report, so there is no boundary to measure against."
  - Claude Code is not installed or not on the path: "Claude Code was not found, so usage cannot be read."
  - Claude Code answered in a shape this version does not recognize: with numbers kept from an earlier reading, "Claude Code's latest usage readout wasn't one this version recognizes, so these numbers are from the reading before it."; with nothing kept, "Claude Code reported its usage in a way this version does not recognize. Trying again shortly."
  - Any other failure (the fetch was refused, or timed out): with numbers kept, "Couldn't refresh just now, so these numbers may be a little behind."; with nothing kept, "Reading your usage now."
- When the latest attempt failed but an earlier reading is still on screen, the note ends with when that reading was taken: " Last read 2h ago." (as "just now", minutes, hours or days ago, or the date past a week). The track and figures keep showing the earlier reading; they are never blanked.

### The week as one track

#### Context

**User story**: "am I ahead or behind?" is a glance, not a calculation: one bar, with the spent share and the boundary on the same axis.

#### Business logic

The track is about the account's own week ("Current week (all models)"), never the 5-hour session window nor a single model's week; those only appear behind "show all limits".

- **The axis**: the left edge is when the quota week began, the right edge is when it resets. Each calendar day the week touches, midnight to midnight in the viewer's time zone, gets a two-letter label in English ("TU", "WE", …) centered over its own share of the bar, so a day's label sits where most of that day falls. A notch marks the start of every day but the first. A week that starts mid-day has one weekday twice, as two slivers at the two ends; both are delimited but only the larger keeps its label, so every weekday reads exactly once.
- **The fill**: the spent share of the week, as a solid fill from the left edge.
- **The dimmed segment**, only with a stop line [3]: right after the fill, in the same color at reduced opacity, the room between what has been spent and where unattended [4] work stops (the limit: the boundary plus the stop line's offset, held between 0 and 100). It is not drawn when the limit is at or below what has been spent: there is nothing left to project.
- **The boundary line**: a thin vertical mark at the quota boundary [2], the plain elapsed share of the week, so it sits exactly at the current time on the axis and moves continuously rather than jumping once a day.
- **The color** of fill and dimmed segment, from how spending compares with the boundary: red once 100% of the week is used; orange ("over") when the spent share is more than 5 points above the boundary; blue ("near") when it is within 5 points either side; green ("under") below that. The 5-point band keeps the color from flickering when spending drifts around the pace between readings.
- To assistive technology the track reads "<used>% of the week used, against a boundary of <boundary>% on day <d> of 7", both percentages rounded.

### A module's stop line and its handle

#### Context

**User story**: the user drags the end of the dimmed segment to the right to let unattended [4] work spend more of the week ahead of pace, or to the left of what is already spent to stop it altogether. The bar follows the handle without waiting for the next read, and the package that starts the unattended work takes the new value without a restart.

**Problem**: the handle is one package's setting drawn on the dashboard's own bar. The dashboard must draw it without reading that package's file or naming its command, so the package's module [7] declares the stop line and the dashboard knows nothing of whose it is.

#### Business logic

- **Whose line**: the first module, in package order, whose definition declares a stop line [3]. The panel renders the track inside that module's slot, so the module's read and save run that package's own command, and a module that throws shows "The usage limit failed: <why>" in place of the track without breaking the rest of the page. With no module declaring one, the track is drawn with no dimmed segment, no handle, no "Budget for Autonomous AI" in the legend, no "Autonomous AI" status and no eager warning.
- **The read**: the panel asks the module for the offset in force, giving it the registered projects that have its package (each by id and name, with whether it has a git host package), once when shown and every 10 seconds after. Until the first answer, and whenever the module answers no offset, the track is drawn as if no module declared a stop line.
- The handle is a slider labeled "Unattended work stops at", drawn on the track itself, valued on the track's own 0–100 scale so its thumb sits exactly at the dimmed segment's right edge, and on the boundary line when the offset is 0.
- The value set is the offset, not the position: the handle's value minus the boundary percentage, rounded to whole points and clamped to the range −50 to +50. Dragging to the far end of the track past that reach still sets +50 (or −50 at the near end).
- At rest the handle sits at the offset the module read.
- A move draws the new limit immediately. The panel keeps the user's value until the module's read catches up with it, so several quick moves accumulate instead of snapping back to the last read.
- The value is saved once the handle has rested for half a second: a drag is many moves, and each save is the module's command in every project it covers. The save is the module's own, given the same projects as the read.
- A save that fails shows, under the track, as an alert: "The limit was not saved: <why>", the reason being the module's, for example "<project>: <what the command said>". The handle then goes back to the value the module read and follows the reads again. The next move clears the alert; a failure of a save the user has since moved past is ignored.
- The handle exists only while the week can be drawn; without a track there is no line to move.

### The figures under the track

#### Context

**User story**: "53% used" says little about whether today's pace is being kept; "Under-consuming: 2d" says exactly how much of the week the gap is.

#### Business logic

One line, its parts separated by " — ", each with a tooltip:

- **Pace deviation**: "Over-consuming: <duration>" when the spent share is at or above the boundary, else "Under-consuming: <duration>", where the duration is the gap between the spent share and the boundary as a share of the week's length, floored to its largest whole unit ("2s", "10m", "2h", "1d") and colored like the track. Exactly on pace reads "Over-consuming: 0s". The label stays plain; the duration is bold. Tooltip: "You are <N days> above the quota boundary." (or "below"), then "You're over-consuming: you spend faster than the week's pace allows." (or "under-consuming … slower").
- **Spent as quota time**: "<duration> spent", the spent share (capped at 100%) as a share of the week's length, so half a week used reads "3d spent". Tooltip: "<N days> of the week's allowance has been consumed — <used>% of it, said in the same unit as the pace figure beside it."
- **Share of pace**: "<n>% of pace", the spent share divided by the boundary (100 is exactly on pace, 105 is a little over), colored like the track. Absent at the very start of the week, when the boundary is 0 and every amount is infinitely above it. Tooltip: "Against the <boundary>% of the week allowed by day <d> of 7 — 100% is exactly on pace. This is the line that parks unattended work, not the week's total."
- **Reset**: "resets <Weekday> <time>", for example "resets Tuesday 8:59pm", with no date because the axis already says which day. Tooltip: "Quota resets on Jul 28, 8:59pm (Europe/Berlin)" with the viewer's time zone named.
- **"show all limits"**: only when the coding agent [5] reported more than one window. Its tooltip is a table with one row per window, in the order they were reported (the account's week included): the window's label, "<n>% used", and " — resets <text>" as the coding agent worded it when the window has a reset.

### Legend, "Autonomous AI" status and the eager warning

#### Context

**User story**: the user reads at a glance whether agents [6] will start on their own, and is warned when they asked unattended [4] work to run well ahead of the week's pace.

#### Business logic

- **The legend** names the marks: "Used" (the solid swatch), with a stop line [3] "Budget for Autonomous AI" (the dimmed swatch), and "Quota boundary" (the line) with a help icon whose tooltip reads: "Not a hard limit — just an indication of whether you're over- or under-consuming. It's calculated as a pro-rated share of the weekly limit." / "If your usage matches the quota boundary, then you're spending exactly what the week's pace allows." / "Fun fact: the quota boundary is shown exactly at the current time in the week usage bar above."
- **The status**, only with a stop line, on the same row as the legend, on the right: while the limit is above what has been spent, "✅ Autonomous AI enabled" with the hint "move slider to the left to disable"; otherwise "❌ Autonomous AI disabled" with "move slider to the right to enable". Tooltips: "Autonomous AI enabled means that unattended work may start on its own while the account is under the line." and "Autonomous AI disabled means that no agent starts on its own — every new agentic work is triggered by you manually."
- **The warning** "⚠️ Eager consumption", only with a stop line, placed just before the status, appears once the limit sits more than one day's worth of the week (100/7, about 14.3 points) above the quota boundary [2]; a handle merely past the boundary is the normal state and is not flagged. Its tooltip names the handle's own lead as a duration: "Autonomous AI will spend tokens <N days> faster than the week's pace allows".

### A week that cannot be drawn is an error, not a plainer panel

#### Context

**Problem**: a boundary that quietly vanished — because Claude Code reworded its reset times and the daemon could not place the week — once hid for weeks behind a panel that merely looked plainer. The message must name the text that failed, because that message is the bug report.

#### Business logic

When a reading has windows but no boundary, a red alert replaces the track, worded for the exact case:

- No week window in the readout: "Couldn't parse quota: no “Current week (all models)” line in the readout — it reported “<label>”, “<label>”." listing every window that did arrive.
- A week window without a reset time (the normal shape of an untouched account, which is not a parse failure): "No quota week to place: “<label>” reports <n>% used but no reset time, and the week is drawn between its start and its reset — there is no span to place it in."
- A week with a reset the daemon could not place: "Couldn't parse quota: the week resets “<text>”, which isn't a phrasing this version recognizes."

There is deliberately no fallback to the week as a plain figure. The windows the coding agent [5] did report are data, not a fallback: they are still listed under the alert, one line each ("<label>", "<n>% used — resets <text>"), and the handle is not shown.
