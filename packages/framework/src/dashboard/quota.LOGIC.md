Assembles the dashboard's quota [1] view: the account's windows as the coding agent [2] reported them (the session window, the quota week, and a week per model), when that reading was taken, why the newest attempt failed when it did, and where the account stands against the quota boundary [3]. It also answers, for one agent [4] about to start on a named model, the same question with that model's own week in force. Both answers are measured off one reading and one spend offset [5], so the bar the user reads and the line Auto PM [6] obeys cannot disagree.

## Context

**User story**: the usage panel shows the user the account's bars, how far into the quota week the account is allowed to be by now, and whether unattended [7] work is standing down; moving the spend offset [5] slider in Settings changes the line at once, with no restart; and starting an agent on a given model is gated on that model's own week as well as the account's.

**Problem**: the quota boundary [3] is a share of the week that rises with the clock, so anything cached would be wrong the moment the week's day rolls over; and a reading that fails for a moment must not make the panel read "nothing used".

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[6] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[8] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`.
[9] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **The view the panel draws** - the last good reading's windows, when it was taken, the reason the newest attempt failed when it did, and the account's boundary, which is absent whenever it cannot honestly be placed.
- **The boundary for one impending agent** - the same measurement with the named model's own week in force too; no model means the account's week alone.
- **Measured on every call, never cached** - both answers are measured against the clock and the current spend offset each time they are asked, off the poller's last good reading, so no reading is spent by asking.
- **The daemon's own source** - polls what Claude Code reports for the whole life of the dashboard, reads the spend offset from the preferences with a half-day cushion as the default, and stops polling when the dashboard closes.

## Business logic

### The view the panel draws

#### Context

See `## Context`.

#### Business logic

The view carries:

- the windows of the last good reading, each with its label as the coding agent [2] phrased it, its kind (the session window, the account's week, one model's week, or unrecognized) and its percentage used; the list is empty when there has never been a good reading, which the panel must not read as "nothing used" without first checking the reason below;
- when the last good reading was taken, absent when there has never been one;
- why there is no fresh reading, when the newest attempt failed: the coding agent's own usage fetch failed, it did not answer in time, it is not installed or not on the `PATH`, the account has no subscription quota to report, or its answer was not in a recognized shape. This reason is present alongside a kept last reading too: the last good reading survives a blip, and the reason lets the panel mark it stale rather than blank it;
- where the account stands against its quota boundary [3], measured by the rules in `../quota-boundary.ts`, naming no model on purpose: the bar is about the account, and a model's own week only narrows the gate for an agent that has chosen one. The boundary is absent when there is no reading, or when the week's reset could not be placed in time; absent means "not known", never "nothing is allowed".

### The boundary for one impending agent

#### Context

**Problem**: the panel's boundary is a question about the account; whether one agent [4] may start is a question about the model that agent will spend. One entry point answering both would make the panel's call look like it forgot to name a model, which is how a model's own week can silently drop out of every gate. So they are two questions, measured the same way.

#### Business logic

Asked with a model, the measurement puts that model's own week in force next to the account's week, so a model whose week is spent stops unattended [7] work even while the account's week has room. A model whose week the account never reported is gated on the account's week alone, because a window that cannot be tied to the model must not stop work. Asked with no model, the answer is the account's week alone, which is the panel's own answer: with no model preference set the driver [8] picks the model, and a window whose model cannot be named must not stop work. Both questions read the same reading and the same spend offset [5], so they cannot disagree about the account, only about a question the other never asked.

### Measured on every call, never cached

#### Context

See `## Context`.

#### Business logic

Each time either question is asked, the quota boundary [3] is measured anew against the current clock and the spend offset [5] as it is at that moment, using the poller's last good windows. No new reading is taken to answer, so asking once per project is free. Moving the spend offset slider therefore takes effect on the next call, with no restart.

### The daemon's own source

#### Context

**User story**: the panel shows where the account stands even when no agent [4] is running.

#### Business logic

The daemon's source polls the quota [1] that the Claude Code coding agent [2] reports, for the whole life of the dashboard rather than only while an agent runs; the quota shown is always Claude Code's, whatever driver [8] the user picks for agents. The spend offset [5] is read from the preferences [9] on every measurement; when the user has set none, or the preferences cannot be read, the default applies: a cushion of one half day's share of the week above the boundary (100 ÷ 14, about 7.1 percentage points), so that an account precisely on pace is not stopped over normal jitter. Stopping the source stops the polling, which the dashboard does when it closes.
