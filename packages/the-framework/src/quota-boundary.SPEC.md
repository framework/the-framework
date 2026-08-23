Works out how much of the account's subscription allowance The Framework may have spent by now — the quota boundary — from the quota week the driver reports, and says whether the account has hit the line where unattended work must stand down.

## User story

The user pays for a fixed weekly allowance on their coding-agent subscription, and lets The Framework spend it while they are away. Two things must not happen: the week must not expire with allowance left unused, and the framework's own background work must not burn through the allowance early, leaving nothing for what the user actually asks for later in the week.

## Glossary

- **quota limit** - the line unattended work actually stops at. By default it is the quota boundary itself; the user can move it away from the boundary with a slider, and the dashboard draws both lines so that moving one's own limit never silently redraws the boundary it is measured against.

## Business logic — TL;DR

- **The boundary is the elapsed share of the quota week** - if a third of the week has passed, a third of the allowance may have been spent. It rises continuously with the clock and reaches the full allowance exactly as the week resets.
- **Nothing is configurable** - the boundary is derived entirely from the account's own quota week; there are no settings behind it.
- **The user can move the limit, not the boundary** - the limit is the boundary shifted by however much the user asked for, clamped to the week so it can never sit before its start or past its end.
- **Both weekly windows bind at once** - the account's own week always counts, and the selected model's own week counts too when it can be matched to that model; whichever reaches the limit first is what stops the work.
- **"We do not know" is its own answer** - when there is no quota reading, or the week's reset cannot be placed on a calendar, no status is produced at all, and each caller decides what that means for it.
- **The week's reset is recovered from prose** - the driver reports the reset only as human text with no year; the reset instant is reconstructed from it, including its time zone.

## Business logic

### The boundary is the elapsed share of the quota week

#### User story

See `## User story`.

#### Business logic

The quota week is the seven days ending at the reset the driver reports. The quota boundary is the share of that week that has elapsed, expressed as a percentage of the allowance: at the start of the week nothing may have been spent, and at the moment of reset the full allowance may have been.

The boundary rises continuously with the clock. A separate day number — which day of the week the current moment falls on, counted from one — is also reported, for surfaces that would rather say "day 4 of 7" than a percentage; that number steps at the exact second the week's own day rolls over, independently of the percentage.

Time before the week's start and after its reset is clamped, so the boundary never reads below nothing or above the full allowance.

#### Rationale

Two properties are the entire point of pro-rating. Nothing is left on the floor: the boundary climbs on its own and arrives at the full allowance exactly as the week resets, so a quiet week still gets spent rather than expiring unused. And low-priority work cannot starve high-priority work: work the user asks for is effectively borrowing against the days still to come, while unattended work stands down once spending passes the line.

The percentage is continuous rather than stepping once a day. A stepped version unlocked a whole day's allowance the instant a new day began — including the entire remaining week on the last day — which reads as generous but lets a burst of spending land the moment the clock ticks over instead of pacing with it. Continuous keeps the line honest about what has actually elapsed, at the cost of that burst.

### The user can move the limit, not the boundary

#### User story

Some users want a cushion: let unattended work stand down a little before the boundary, or let it run a little past it.

#### Business logic

The quota limit is the boundary shifted by the offset the user chose. An offset of zero — the default — means the limit is exactly the boundary. The limit is clamped to the week at both ends: dragged past the end it stops at the full allowance rather than becoming unreachable, which would read as "never stop"; dragged before the start it stops at nothing rather than going negative, which would read as "always stopped". The boundary and the limit are reported separately so both can be drawn.

### Both weekly windows bind at once

#### User story

An account can be limited by two different weekly allowances at the same time: the account's overall week, and the week attached to the particular model the work will run on. Being out of allowance on either one means the work cannot proceed.

#### Business logic

The account's own weekly window always counts. A model-specific weekly window counts as well, but only when the model the work will run on can be matched to the model that window is about — the window's own label names it. A model window that cannot be matched is left out entirely, rather than being allowed to stop work for a model nobody selected.

Each counted window is reported with its own label as the driver phrased it, how much of it is used, and whether it has reached the limit. The first window to reach the limit is reported as the one that stops the work; while every window still has room, nothing is reported as reached.

### "We do not know" is its own answer

#### User story

The driver may not report quota at all, or may phrase the reset in a way that cannot be placed on a calendar. Treating that as "nothing may be spent" would halt everything on a parsing failure; treating it as "everything may be spent" would silently defeat the policy.

#### Business logic

When there is no weekly reading, or when the week's reset cannot be resolved to an instant, no status is produced. That is explicitly "we do not know where the week is", and each caller decides for itself: the per-agent guard lets work carry on, while unattended work stands down.

### The week's reset is recovered from prose

#### User story

The driver reports its reset the way it shows it to a person — for example `Jul 25 at 7am (Asia/Jerusalem)` — with no year at all.

#### Business logic

The reset text is read as a month, a day, a 12-hour clock time with optional minutes, and an optional time zone; when no zone is given, the machine's own zone is used. Both phrasings the coding-agent CLI has used in the wild are accepted — the one that separates date and time with "at" and the one that uses a comma.

The missing year is recovered from a fact the driver itself does not know: a weekly window resets within seven days, so of the neighbouring candidate years exactly one lands anywhere near now, and that one is chosen. A candidate that is not a real date — the 29th of February in a year that has none — is discarded rather than allowed to roll into the following month.

The instant is resolved in the reported zone as of that instant, not as of now, so a reset falling on the other side of a daylight-saving change still lands on the wall-clock time the driver printed. Text that does not parse, an impossible clock time, or a zone name the machine does not recognize all mean the reset is unknown.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
