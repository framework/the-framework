The "Usage" panel: the account's quota [1] week drawn as one week-long track — what has been spent, the room left before unattended [4] work stands down, and the quota boundary [2] as a line through it — with a draggable handle that sets the spend offset [3] and writes it straight to the preferences [9]. Below the track the panel says how far ahead of or behind the week's pace the account is, when the week resets, whether "Autonomous AI" currently has room to spend, and, whenever the week cannot be drawn, exactly why.

## Context

**User story**: the user glances at the Overview [10] to answer "am I ahead of or behind my week's allowance, and will Auto PM [6] keep working?" and drags one handle to let unattended work spend more or less of the week. The daemon acts on the same handle position, so what the bar shows and what unattended work obeys never disagree.

**Business logic story**: the panel reads the daemon's cached quota reading, refreshed every 30 seconds while the panel is open; a failed refresh keeps the last reading on screen (the polling lives in `lib/quota.ts`). The drawing arithmetic — day segments, tone, limit, projection, pace figures — lives in `lib/quota-bar.ts`; where the boundary sits is the daemon's rule in `src/quota-boundary.ts`, which the panel never re-derives.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[4] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[8] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[9] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[10] the Overview: the dashboard's cross-project page at `/`.

## Business logic — TL;DR

- **Before and without a reading** - "Reading your usage…" until the first answer; when the coding agent [5] cannot report, a sentence says why, and numbers kept from an earlier reading are dated with "Last read …".
- **The week as one track** - the account's week runs edge to edge with one two-letter label per calendar day, the spent share as a solid fill, the room left for unattended [4] work as a dimmed segment after it, and the quota boundary [2] as a line at the elapsed share of the week; the color says how spending compares with the boundary.
- **The handle sets the spend offset** - dragging the dimmed segment's edge ("Unattended work stops at") stores the distance from the boundary as the spend offset [3], clamped to ±50 points, written to the preferences [9] at once and drawn at once.
- **The figures under the track** - "Over-consuming"/"Under-consuming" as a duration, what was spent as quota time, consumption as a share of the pace, when the week resets, and "show all limits" for every window the coding agent reports.
- **Legend, "Autonomous AI" status and the eager warning** - the legend names the three marks; the status says whether unattended work currently has room ("enabled"/"disabled") and how to change that; "⚠️ Eager consumption" appears once the handle sits more than a day's worth ahead of the boundary.
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
- **The dimmed segment**: right after the fill, in the same color at reduced opacity, the room between what has been spent and where unattended [4] work stops (the limit: the boundary plus the spend offset [3]). It is not drawn when the limit is at or below what has been spent: there is nothing left to project.
- **The boundary line**: a thin vertical mark at the quota boundary [2], the plain elapsed share of the week, so it sits exactly at the current time on the axis and moves continuously rather than jumping once a day.
- **The color** of fill and dimmed segment, from how spending compares with the boundary: red once 100% of the week is used; orange ("over") when the spent share is more than 5 points above the boundary; blue ("near") when it is within 5 points either side; green ("under") below that. The 5-point band keeps the color from flickering when spending drifts around the pace between readings.
- To assistive technology the track reads "<used>% of the week used, against a boundary of <boundary>% on day <d> of 7", both percentages rounded.

### The handle sets the spend offset

#### Context

**User story**: the user drags the end of the dimmed segment to the right to let Auto PM [6] spend more of the week ahead of pace, or to the left of what is already spent to stop unattended [4] work altogether. The move takes effect without a restart and without waiting for the next reading.

#### Business logic

- The handle is a slider labeled "Unattended work stops at", drawn on the track itself, valued on the track's own 0–100 scale so its thumb sits exactly at the dimmed segment's right edge, and on the boundary line when the spend offset [3] is 0.
- The stored value is the offset, not the position: the handle's value minus the boundary percentage, rounded to whole points and clamped to the range −50 to +50. Dragging to the far end of the track past that reach still stores +50 (or −50 at the near end).
- Before anyone touches it, the offset is half a day's worth of the week (100/14, about 7 points) ahead of the boundary, so unattended work is not stopped by the normal jitter of being exactly on pace.
- A move writes the offset to the preferences [9] immediately, and the panel draws the new limit immediately. The panel keeps the user's value until the daemon's reading, which arrives every 30 seconds, catches up with it, so several quick moves accumulate instead of snapping back to the last reading.
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

**User story**: the user reads at a glance whether agents [7] will start on their own, and is warned when they asked unattended [4] work to run well ahead of the week's pace.

#### Business logic

- **The legend** names the three marks: "Used" (the solid swatch), "Budget for Autonomous AI" (the dimmed swatch) and "Quota boundary" (the line) with a help icon whose tooltip reads: "Not a hard limit — just an indication of whether you're over- or under-consuming. It's calculated as a pro-rated share of the weekly limit." / "If your usage matches the quota boundary, then you're spending exactly what the week's pace allows." / "Fun fact: the quota boundary is shown exactly at the current time in the week usage bar above."
- **The status**, on the same row as the legend, on the right: while the limit is above what has been spent, "✅ Autonomous AI enabled" with the hint "move slider to the left to disable"; otherwise "❌ Autonomous AI disabled" with "move slider to the right to enable". Tooltips: "Autonomous AI enabled means that agents will automatically work on tasks in the AI queue, and tasks will be automatically added to the AI queue." and "Autonomous AI disabled means that agents won't automatically start to work — every new agentic work is triggered by you manually." ("AI queue" is the dashboard's label for the agent queue [8].)
- **The warning** "⚠️ Eager consumption", placed just before the status, appears once the limit sits more than one day's worth of the week (100/7, about 14.3 points) above the quota boundary [2]; a handle merely past the boundary, including the default half-day cushion, is the normal state and is not flagged. Its tooltip names the handle's own lead as a duration: "Autonomous AI will spend tokens <N days> faster than the week's pace allows".

### A week that cannot be drawn is an error, not a plainer panel

#### Context

**Problem**: a boundary that quietly vanished — because Claude Code reworded its reset times and the daemon could not place the week — once hid for weeks behind a panel that merely looked plainer. The message must name the text that failed, because that message is the bug report.

#### Business logic

When a reading has windows but no boundary, a red alert replaces the track, worded for the exact case:

- No week window in the readout: "Couldn't parse quota: no “Current week (all models)” line in the readout — it reported “<label>”, “<label>”." listing every window that did arrive.
- A week window without a reset time (the normal shape of an untouched account, which is not a parse failure): "No quota week to place: “<label>” reports <n>% used but no reset time, and the week is drawn between its start and its reset — there is no span to place it in."
- A week with a reset the daemon could not place: "Couldn't parse quota: the week resets “<text>”, which isn't a phrasing this version recognizes."

There is deliberately no fallback to the week as a plain figure. The windows the coding agent [5] did report are data, not a fallback: they are still listed under the alert, one line each ("<label>", "<n>% used — resets <text>"), and the handle is not shown.
