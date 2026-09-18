What the dashboard's usage panel asks the daemon, where the account's quota [1] stands against its quota boundary [2], and the one thing it writes, the spend offset [4]. The reading may not exist, and the panel must never mistake "we could not read it" for "nothing used", so a failed reading is answered as an explicit absence. The write runs every registered project's offset hook [5]: the daemon names no tool, and what the line writes is what the panel reads back.

## Context

**User story**: the user watches the usage panel to see how much of the week's allowance is gone and whether unattended [3] work is standing down against the quota boundary [2], and drags its handle, or sets Settings → Automation → "Spend offset", to let unattended work spend more or less.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] unattended: said of an agent nobody is watching: one the scheduler started rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.
[4] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.
[5] offset hook: the one shell line under `offset` in a project's `.the-framework/hooks.yml`, given the spend offset in `POINTS`; for example `npx agent-scheduler offset -- "$POINTS"`.

## Business logic — TL;DR

- **Where the quota stands** - the account's windows, when they were read, why they could not be read, and where the account stands against its quota boundary [2].
- **No reading is said, never implied** - a reading that fails answers with no windows and no boundary at all, because an empty bar would read as "nothing used".
- **Setting the spend offset** - the points go to every registered project's offset hook [5]; a project without the line is skipped; none having it, a line that fails (each failing project named), or a value that is not a number is an error in words.

## Business logic

### Where the quota stands

#### Context

**User story**: the usage panel shows how much of the session window and of the quota week [1] is spent, and where that sits against the quota boundary [2] that holds unattended [3] work back.

#### Business logic

The daemon answers with the account's quota [1] windows as the coding agent reported them — the session window, the quota week, and the week for each model — together with when that reading was taken and where the account stands against its quota boundary [2] and against the line unattended [3] work stops at, the boundary plus the schedulers' spend offset [4] (the measuring itself is in `../dashboard/quota.ts`). The dashboard's panel asks for this repeatedly for as long as it is open, so the picture follows the clock.

The boundary is absent when there is no reading, and also when the week's reset moment could not be placed. That absence means "not known", not "nothing may be spent".

### No reading is said, never implied

#### Context

**Problem**: the panel draws a bar. A reading that failed, reported as zeroes, would draw an empty bar — which says "nothing used", the one thing this panel must never say when it does not know.

#### Business logic

When the reading cannot be taken at all, the answer holds no windows and no boundary [2], and states that it is unavailable. Nothing is filled in with zeroes.

A reason for unavailability also travels alongside a reading that is still present but old: the last good reading is kept through a failed attempt, and the reason says the newest attempt failed, so the panel can mark the figures as stale instead of blanking them.

### Setting the spend offset

#### Context

**User story**: the user moves the usage panel's handle, or types a number in Settings, and every project's scheduler starts unattended [3] work up to the new line; on the next reading the panel draws the value the schedulers now hold.

**Problem**: the spend offset [4] lives in each project's scheduler, which The Framework must not name; a write that reached no scheduler, or failed in one, must not look like it worked.

#### Business logic

The call takes the spend offset [4] in percentage points. A value that is not a finite number is refused with "the spend offset must be a number" before any line runs. Otherwise the daemon runs the offset hook [5] of every registered project, one project after another, in registry order, with the points in `POINTS` (`../project-hooks.ts` runs the line). A project whose hooks file has no offset line is skipped. The answer is an error when any line failed, naming each failing project as "<project name>: <why>", joined by "; " (a broken hooks file counts as a failure); otherwise an error "no project has an offset hook in .the-framework/hooks.yml" when no project had the line, including when no project is registered; otherwise success. The lines that succeeded are not undone when another fails. When the list of projects cannot be read, it is treated as empty.
