The arithmetic behind the dashboard's quota bar: how the quota week is divided into labelled days along the bar, what colour the bar takes, where the quota limit's line sits, and the figures printed beside it — how much allowance has been consumed as time, how far ahead of or behind pace the account is, and what share of the pace so far it has spent.

Where the quota boundary sits and what it gates belongs to the framework, and none of it is re-derived here: this only draws the week.

## Glossary

- **quota limit** - where unattended work is told to stop: the quota boundary shifted by the amount the user has chosen, never past either end of the week.
- **pace** - spending exactly the quota boundary's pro-rated share by now.

## Business logic — TL;DR

- **Days are calendar days** - each day's stretch of the bar is as wide as the part of that day that actually falls inside the quota week.
- **Each day is named once** - a quota week starting mid-day splits one weekday across both ends; both slivers are delimited but only the larger is labelled.
- **The bar's colour is a band, not a point** - on-pace spending drifts either side of the boundary, so a margin around it counts as on track and the colour does not flicker.
- **The limit line moves with the slider** - the dashboard draws the quota limit itself so the line follows the control immediately, while the daemon's own answer remains the one that gates work.
- **Quota as time, not just a share** - consumption and the gap from pace are both stated as durations within the week.
- **Share of pace** - a separate figure says whether today's rate is sustainable, and says nothing at all at the very start of the week.
- **The projected stretch** - a dimmer continuation of the bar shows the room between what is used and where unattended work stops.

## Business logic

### Days are calendar days

#### User story

The user looks at the quota bar to see where in their week the spending happened.

#### Business logic

The bar is divided at local midnights, so each day's stretch is exactly as wide as the portion of that day inside the quota week, and a weekday's letters sit where most of that weekday actually falls — rather than every day taking a fixed seventh of the bar regardless of the clock. Each midnight is worked out from the previous one rather than by adding twenty-four hours, so a daylight-saving change does not shift every later boundary by an hour. A week with no duration draws nothing.

Days are named by a fixed two-letter English abbreviation in the viewer's own time zone, deliberately not in the viewer's language.

#### Rationale

Two letters of a localized weekday name only distinguish days in languages that happen to work like English — in Hebrew the short weekday names differ only in their last character, so slicing two characters would label all seven days identically. The axis is a fixed notation like a chart's, and the dates it stands for are spelled out in full elsewhere.

### Each day is named once

#### User story

A quota week that starts mid-day covers part of, say, Tuesday at its start and the rest of a Tuesday at its end.

#### Business logic

Both slivers are drawn with their own boundaries, since both are real elapsed time, but only the larger one is labelled. The day therefore reads exactly once, at whichever end most of it falls.

### The bar's colour is a band, not a point

#### User story

The colour of the bar should tell the user at a glance whether the account is on track for the week.

#### Business logic

The bar reads as full once the whole week's allowance is spent. Otherwise it reads as over when consumption is more than a small margin past the quota boundary, as near while it is within that margin either side, and as under below that.

#### Rationale

Spending exactly on pace still drifts a little either side of the boundary from one reading to the next. Comparing against a single point would make the bar flicker between colours over noise that says nothing about whether the account is actually on track.

### The limit line moves with the slider

#### User story

The user drags the control that shifts where unattended work stops.

#### Business logic

The quota limit is the quota boundary shifted by the user's chosen amount, clamped to the week at both ends. The dashboard works this out for itself so the drawn line follows the control immediately; the daemon computes the same thing, and its answer is the one that actually gates the work.

A limit set more than one day's worth of the week past the boundary is what counts as deliberately eager. The limit already rests half a day ahead by default, so being a few points past the boundary is the normal state, and only clearing a whole day's share is asking for faster-than-the-week on purpose.

#### Rationale

Without drawing it locally, the line would trail the control by up to the polling interval, which reads as a broken slider.

### Quota as time, and share of pace

#### User story

"53% used" tells the user how much of the week is left, but not whether today's rate is sustainable — which is the question the panel exists to answer, since the pro-rated line is what parks unattended work.

#### Business logic

Consumption is also stated as quota time: the share of the week spent, expressed as a duration of allowance, clamped so that a window reporting past its whole week reads as having spent one week rather than more.

The gap from pace is stated the same way — a signed duration within the week, positive when spending is ahead of pace and negative when it is behind.

Alongside those, the share of pace says what proportion of the allowance elapsed so far has been spent, where exactly on pace is one hundred percent. At the very start of the week, where no allowance has elapsed yet, there is no such figure at all.

#### Rationale

Using one unit for consumption and another for the gap would put two scales on one line and leave the reader converting between them. And at the start of the week any amount is infinitely above nothing, so a share-of-pace figure for the first minutes of a week would be noise rather than a reading.

### The projected stretch

#### User story

The user wants to see not just what has been spent but how much room is left before unattended work stands down.

#### Business logic

After the solid used portion, a dimmer continuation runs from consumption up to the quota limit, so the two read as one bar split in two rather than a separate mark floating over it. Both ends are held inside the week. Once the limit has been reached or passed there is nothing left to project and the stretch is empty.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
