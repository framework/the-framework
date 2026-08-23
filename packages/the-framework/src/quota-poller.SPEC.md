Keeps a recent quota reading on hand by asking the driver for it on a slow schedule, so every surface can say where the account's subscription stands without paying for a fresh reading each time it is asked.

## Business logic — TL;DR

- **Reading quota is expensive, so it is deliberately slow** - a reading is taken every five minutes when healthy; the quota boundary moves over days, so that resolves it comfortably.
- **The last good reading survives a blip** - the last successful reading is kept alongside the most recent attempt, so a momentary failure never blanks a number that was accurate a minute ago.
- **Failure backs off instead of retrying harder** - each consecutive failed reading doubles the wait, up to half an hour; the first success returns to the healthy interval.
- **An authoritative "no" stops polling for good** - when the failure means there is nothing to read at all, the retained reading is discarded and polling ends.
- **The first reading is taken immediately** - polling starts with a reading right away, not one interval later.

## Business logic

### Reading quota is expensive, so it is deliberately slow

#### User story

The dashboard shows where the account's week stands, and unattended work checks it before spending. Neither may be paid for with a burst of expensive readings.

#### Business logic

Each reading spawns the driver's CLI, which takes seconds, and the account's own usage lookup is refused upstream when asked too often. So readings are taken every five minutes while things are healthy. A reading can also be taken on demand — for instance right after an agent's turn settles — alongside the scheduled one.

#### Rationale

The thing being tracked is the quota week, which moves over days. Sampling it every five minutes resolves that far more finely than the decisions made from it need.

### The last good reading survives a blip

#### User story

The user is watching a quota bar. If it empties for a moment because one reading failed, it reads as "nothing used" — the single most misleading thing this feature could say.

#### Business logic

Two things are kept: the most recent attempt exactly as it came back, and the most recent successful reading with the time it was taken. The time of the most recent failure is kept too. A failed attempt replaces the former and never the latter, so the last real number stays available across transient failures.

A driver that fails outright is treated exactly like one that reports the reading as unavailable for a transient reason: this attempt told us nothing, and the next one may work.

### Failure backs off instead of retrying harder

#### User story

The account's usage lookup is refused upstream when asked too often, and the penalty for asking lasts minutes.

#### Business logic

Every consecutive transient failure doubles the wait before the next reading, up to a ceiling of half an hour. The first successful reading resets the wait to the healthy interval.

#### Rationale

An eager retry loop would keep the account permanently inside its own penalty window, so the number would never come back — the exact opposite of the goal. Backing off is what makes recovery possible.

### An authoritative "no" stops polling for good

#### User story

There is no subscription to read, or no driver CLI installed. Asking again every five minutes forever achieves nothing, and continuing to show the previously retained number would misrepresent the account.

#### Business logic

When a failure is authoritative rather than transient, the retained good reading and its timestamp are discarded, and polling stops permanently. Polling can also be stopped deliberately; either way, a stopped poller stays stopped and can report that it has.

### The first reading is taken immediately

#### User story

An agent that has just started needs a quota reading now; one that arrives five minutes in is no use to it, and the measurement of what that agent itself spends needs a starting point.

#### Business logic

Starting the poller takes a reading right away rather than waiting out the first interval, and schedules the next one after it settles. Nothing waits on that first reading. Starting an already-started poller does nothing, and a stopped poller cannot be restarted. The scheduled readings never keep the process alive on their own — the daemon's own work decides how long it runs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
