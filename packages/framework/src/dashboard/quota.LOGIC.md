Assembles the dashboard's quota [1] view: the account's windows as the coding agent [2] reported them (the session window, the quota week, and a week per model), when that reading was taken, why the newest attempt failed when it did, and where the quota boundary [3] sits in the account's week.

## Context

**User story**: the usage panel shows the user the account's bars and how far into the quota week the account is allowed to be by now, whether or not an agent [4] is running.

**Problem**: the quota boundary [3] is a share of the week that rises with the clock, so anything cached would be wrong the moment the week's day rolls over; and a reading that fails for a moment must not make the panel read "nothing used".

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] quota boundary: the share of the quota week that may be spent by now if the week is to be spent evenly, rising with the clock.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] driver: a coding agent wrapped as a black box. The user's driver choice is `claude-code` or `codex`.

## Business logic — TL;DR

- **The view the panel draws** - the last good reading's windows, when it was taken, the reason the newest attempt failed when it did, and where the boundary sits in the account's week, absent whenever it cannot honestly be placed.
- **Measured on every read, never cached** - the boundary is measured against the clock each time the view is read, off the last good reading, so no reading is spent by asking.
- **The daemon's own source** - polls what Claude Code reports for the whole life of the dashboard, and stops polling when the dashboard closes.

## Business logic

### The view the panel draws

#### Context

See `## Context`.

#### Business logic

The view carries:

- the windows of the last good reading, each with its label as the coding agent [2] phrased it, its kind (the session window, the account's week, one model's week, or unrecognized) and its percentage used; the list is empty when there has never been a good reading, which the panel must not read as "nothing used" without first checking the reason below;
- when the last good reading was taken, absent when there has never been one;
- why there is no fresh reading, when the newest attempt failed: the coding agent's own usage fetch failed, it did not answer in time, it is not installed or not on the `PATH`, the account has no subscription quota to report, or its answer was not in a recognized shape. This reason is present alongside a kept last reading too: the last good reading survives a blip, and the reason lets the panel mark it stale rather than blank it;
- where the quota boundary [3] sits in the account's week — when the week began, when it resets, which day of the week it is, and the share of the week allowed by now — placed off the account's own week by the rules in `../quota-boundary.ts`. A model's own week never places it. The boundary is absent when there is no reading, or when the week's reset could not be placed in time; absent means "not known", never a boundary of zero.

### Measured on every read, never cached

#### Context

See `## Context`.

#### Business logic

Each time the view is read, the quota boundary [3] is measured anew against the current clock, using the last good reading's windows. No new reading is taken to answer, so asking once per project is free.

### The daemon's own source

#### Context

**User story**: the panel shows where the account stands even when no agent [4] is running.

#### Business logic

The daemon's source polls the quota [1] that the Claude Code coding agent [2] reports, for the whole life of the dashboard rather than only while an agent runs; the quota shown is always Claude Code's, whatever driver [5] the user picks for agents. Stopping the source stops the polling, which the dashboard does when it closes.
