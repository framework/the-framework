What the dashboard's usage panel asks the daemon: where the account's quota [1] stands and where its quota boundary [2] sits. The reading may not exist, and the panel must never mistake "we could not read it" for "nothing used", so a failed reading is answered as an explicit absence. There is no write here: the stop line a package's unattended work obeys is read and saved by that package's own module, through its own command.

## Context

**User story**: the user watches the usage panel to see how much of the week's allowance is gone and how that compares with the quota boundary [2].

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock. The dashboard only draws it; whether work stops at it is the business of whatever starts unattended work.

## Business logic — TL;DR

- **Where the quota stands** - the account's windows, when they were read, why they could not be read, and where its quota boundary [2] sits.
- **No reading is said, never implied** - a reading that fails answers with no windows and no boundary at all, because an empty bar would read as "nothing used".

## Business logic

### Where the quota stands

#### Context

**User story**: the usage panel shows how much of the session window and of the quota week [1] is spent, and where that sits against the quota boundary [2].

#### Business logic

The daemon answers with the account's quota [1] windows as the coding agent reported them — the session window, the quota week, and the week for each model — together with when that reading was taken and where its quota boundary [2] sits: when the week began and resets, which day of seven it is, and the share that may be spent by now (the measuring itself is in `../dashboard/quota.ts`). The dashboard's panel asks for this repeatedly for as long as it is open, so the picture follows the clock.

The boundary is absent when there is no reading, and also when the week's reset moment could not be placed. That absence means "not known", not "nothing may be spent".

### No reading is said, never implied

#### Context

**Problem**: the panel draws a bar. A reading that failed, reported as zeroes, would draw an empty bar — which says "nothing used", the one thing this panel must never say when it does not know.

#### Business logic

When the reading cannot be taken at all, the answer holds no windows and no boundary [2], and states that it is unavailable. Nothing is filled in with zeroes.

A reason for unavailability also travels alongside a reading that is still present but old: the last good reading is kept through a failed attempt, and the reason says the newest attempt failed, so the panel can mark the figures as stale instead of blanking them.
