Keeps a recent reading of the account's quota [1] on hand for the daemon: reads it through the driver [2] every five minutes while reads succeed, immediately when polling starts and on demand after a turn [3] settles, backs off on a failure that describes only this attempt while keeping the last good reading, and gives up for good on a failure that describes the account or the install, discarding that reading so nothing misrepresents the account.

## Context

**User story**: the dashboard's quota panel shows how much of the session window and the quota week is used, and unattended [4] work is started or stood down against the quota boundary [5]; both work from this one retained reading instead of asking the coding agent [6] every time. A blip in the coding agent's own usage fetch never blanks the panel.

**Problem**: a reading spawns the whole coding agent, which takes about five seconds, and the coding agent's usage fetch is refused upstream when asked too often, with a penalty window minutes long: an eager retry loop would keep the number permanently unavailable, the opposite of the goal. The boundary moves over days, so a sample every five minutes resolves it comfortably. A quota bar going empty reads as "nothing used", the one thing this feature must never imply.

## Glossary

[1] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] driver: A coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[3] turn: One prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[5] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[6] coding agent: The CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **What is kept** - the latest attempt exactly as it came back, the last good reading with when it was read, and when the last failure happened; the two readings are separate so a blip never blanks a number that was accurate a minute ago.
- **Every five minutes while healthy, starting now** - the first read happens the moment polling starts rather than five minutes later, then one read every five minutes; a read is never waited on and never holds the daemon open.
- **A transient failure keeps the reading and backs off** - a refused or failed fetch, a timeout, an answer in an unrecognized shape, or a driver error keeps the last good reading, notes the failure time, and doubles the gap before the next read, up to thirty minutes; the next good reading resets the gap to five minutes.
- **An authoritative failure discards it and stops** - no coding agent installed, or an account with no subscription quota, drops the last good reading and ends polling for good.
- **Reading on demand** - a read can be asked for at any moment, such as right after a turn settles, and folds into the same state as a scheduled one.

## Business logic

### What is kept

#### Context

See `## Context`.

#### Business logic

The daemon holds four things: the most recent attempt exactly as the driver [2] returned it, whether a reading or a failure with its reason; the most recent successful reading; the time that reading was taken; and the time of the most recent failure. Before the first attempt all four are empty. The latest attempt and the last good reading are kept apart on purpose: a failure updates the former and leaves the latter in place, so a number that was accurate a minute ago stays available through a transient failure.

### Every five minutes while healthy, starting now

#### Context

**Problem**: a poller whose first reading lands five minutes in is no use to an agent that just started, and the session window's own measurement needs a baseline from the start.

#### Business logic

Starting the poller reads the quota [1] at once, then schedules the next read one gap later, five minutes by default. Starting twice does nothing the second time, and a poller that has given up or been stopped does not start again. No read is waited on: it takes about five seconds and nothing in the daemon should block on it. The timer between reads never keeps the daemon's process alive on its own; the daemon's own work decides its lifetime. Stopping the poller cancels the pending read and is safe to repeat.

### A transient failure keeps the reading and backs off

#### Context

**Problem**: the coding agent's [6] usage fetch is refused upstream when asked too often and the penalty lasts minutes, so retrying into a refusal only prolongs it.

#### Business logic

A failure that describes this attempt rather than the setup is transient: the coding agent's own fetch failed or was refused, the coding agent did not answer in time, or it answered in a shape the driver [2] did not recognize, such as an update notice printed ahead of the readout. A driver that fails outright is treated exactly like a failed fetch: this attempt said nothing, and the next may work. On a transient failure the last good reading and its time are kept, the failure time is recorded, and the gap before the next read doubles, capped at thirty minutes. The next successful reading replaces the last good reading, records its time, and resets the gap to the healthy five minutes.

### An authoritative failure discards it and stops

#### Context

**Problem**: a reading kept after the account or the install has changed misrepresents the account: a bar showing last week's usage for an account that has no subscription quota at all, or for a coding agent [6] that is no longer installed.

#### Business logic

A failure that describes the setup is authoritative: the coding agent is not installed or not on `PATH`, or the account has no subscription quota to report, as with API-key authentication. On an authoritative failure the failure time is recorded, the last good reading and its time are discarded, and polling stops for good: asking again changes nothing. The latest attempt still carries the reason, so the dashboard can say why there is no reading.

### Reading on demand

#### Context

**User story**: a turn [3] has just settled and the panel should reflect what it cost without waiting up to five minutes.

#### Business logic

A read can be requested at any moment, alongside the scheduled ones, and its result is folded in exactly as a scheduled read's: a good reading refreshes the last good reading and resets the backoff, a transient failure keeps it and backs off, an authoritative failure discards it and stops polling. The requested read hands back the driver's [2] answer as it came, so the caller can act on it directly.
