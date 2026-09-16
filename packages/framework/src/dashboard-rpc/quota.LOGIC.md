The one thing the dashboard's usage panel asks the daemon: where the account's quota [1] stands against its quota boundary [2]. It is a reading that may not exist, and the panel must never mistake "we could not read it" for "nothing used", so a failed reading is answered as an explicit absence.

## Context

**User story**: the user watches the usage panel to see how much of the week's allowance is gone and whether unattended [3] work is standing down against the quota boundary [2].

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.

## Business logic — TL;DR

- **Where the quota stands** - the account's windows, when they were read, why they could not be read, and where the account stands against its quota boundary [2].
- **No reading is said, never implied** - a reading that fails answers with no windows and no boundary at all, because an empty bar would read as "nothing used".

## Business logic

### Where the quota stands

#### Context

**User story**: the usage panel shows how much of the session window and of the quota week [1] is spent, and where that sits against the quota boundary [2] that holds unattended [3] work back.

#### Business logic

The daemon answers with the account's quota [1] windows as the coding agent reported them — the session window, the quota week, and the week for each model — together with when that reading was taken and where the account stands against its quota boundary [2] (the measuring itself is in `../dashboard/quota.ts`). The dashboard's panel asks for this repeatedly for as long as it is open, so the picture follows the clock.

The boundary is absent when there is no reading, and also when the week's reset moment could not be placed. That absence means "not known", not "nothing may be spent".

### No reading is said, never implied

#### Context

**Problem**: the panel draws a bar. A reading that failed, reported as zeroes, would draw an empty bar — which says "nothing used", the one thing this panel must never say when it does not know.

#### Business logic

When the reading cannot be taken at all, the answer holds no windows and no boundary [2], and states that it is unavailable. Nothing is filled in with zeroes.

A reason for unavailability also travels alongside a reading that is still present but old: the last good reading is kept through a failed attempt, and the reason says the newest attempt failed, so the panel can mark the figures as stale instead of blanking them.
