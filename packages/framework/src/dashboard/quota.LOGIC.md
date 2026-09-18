Assembles the dashboard's quota [1] view: the account's windows as the coding agent [2] reported them (the session window, the quota week, and a week per model), when that reading was taken, why the newest attempt failed when it did, and where the account stands against the quota boundary [3] and against the line unattended [6] work stops at, the boundary plus the spend offset [5]. The spend offset is the schedulers' [8] own, read off their state files, so the line the bar draws is the line the schedulers obey.

## Context

**User story**: the usage panel shows the user the account's bars, how far into the quota week the account is allowed to be by now, and whether unattended [6] work is standing down; moving the spend offset [5] slider changes the line on the next read, with no restart.

**Problem**: the quota boundary [3] is a share of the week that rises with the clock, so anything cached would be wrong the moment the week's day rolls over; and a reading that fails for a moment must not make the panel read "nothing used".

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.
[6] unattended: said of an agent nobody is watching: one the scheduler started rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.
[7] driver: a coding agent wrapped as a black box. The user's driver choice is `claude-code` or `codex`.
[8] the scheduler: the `agent-scheduler` tool: one small process per project that ticks every minute and starts one agent per due command of the project's `agent-schedule.md`. It keeps its state in `.agent-scheduler/state.json` at the project's root.

## Business logic — TL;DR

- **The view the panel draws** - the last good reading's windows, when it was taken, the reason the newest attempt failed when it did, and the account's boundary and line, which are absent whenever they cannot honestly be placed.
- **Measured on every read, never cached** - the boundary and the line are measured against the clock and the current spend offset each time the view is read, off the last good reading, so no reading is spent by asking.
- **The daemon's own source** - polls what Claude Code reports for the whole life of the dashboard, takes the spend offset from the schedulers (a half-day cushion when none names one), and stops polling when the dashboard closes.

## Business logic

### The view the panel draws

#### Context

See `## Context`.

#### Business logic

The view carries:

- the windows of the last good reading, each with its label as the coding agent [2] phrased it, its kind (the session window, the account's week, one model's week, or unrecognized) and its percentage used; the list is empty when there has never been a good reading, which the panel must not read as "nothing used" without first checking the reason below;
- when the last good reading was taken, absent when there has never been one;
- why there is no fresh reading, when the newest attempt failed: the coding agent's own usage fetch failed, it did not answer in time, it is not installed or not on the `PATH`, the account has no subscription quota to report, or its answer was not in a recognized shape. This reason is present alongside a kept last reading too: the last good reading survives a blip, and the reason lets the panel mark it stale rather than blank it;
- where the account stands against its quota boundary [3], measured by the rules in `../quota-boundary.ts`: where the boundary sits in the week, the line unattended [6] work stops at (the boundary plus the spend offset [5]) with the offset it was drawn from, the account's week measured against that line, and whether it has reached it. It names no model on purpose: the bar is about the account, so a model's own week never joins it. The boundary is absent when there is no reading, or when the week's reset could not be placed in time; absent means "not known", never "nothing is allowed".

### Measured on every read, never cached

#### Context

See `## Context`.

#### Business logic

Each time the view is read, the quota boundary [3] is measured anew against the current clock and the spend offset [5] as it is at that moment, using the last good reading's windows. No new reading is taken to answer, so asking once per project is free. A spend offset the slider wrote therefore shows on the next read, with no restart. A source given no spend offset uses the default: a cushion of one half day's share of the week above the boundary (100 ÷ 14, about 7.1 percentage points).

### The daemon's own source

#### Context

**User story**: the panel shows where the account stands even when no agent [4] is running.

#### Business logic

The daemon's source polls the quota [1] that the Claude Code coding agent [2] reports, for the whole life of the dashboard rather than only while an agent runs; the quota shown is always Claude Code's, whatever driver [7] the user picks for agents. On every read it asks the daemon for the spend offset [5], which the daemon answers from the state files of every registered project's scheduler [8]: the loosest offset any of them holds (the rule is `scheduler-state.ts`'s). When no scheduler names one, or the answer cannot be read, the default applies: a cushion of one half day's share of the week above the boundary (100 ÷ 14, about 7.1 percentage points), which is the schedulers' own default too, so that an account precisely on pace is not stopped over normal jitter. The source only draws the line: the schedulers are what obey it, and nothing in the daemon starts an agent. Stopping the source stops the polling, which the dashboard does when it closes.
