Works out everything the quota [1] bar draws and says: where each calendar day of the quota week falls across the bar, which color the week's consumption deserves, and how far ahead of or behind pace the account is. Where the quota boundary [2] actually sits is decided in `src/quota-boundary.ts`; this never re-derives it.

## Context

**User story**: the user looks at one bar and answers two questions at a glance — how much of this week's allowance is gone, and whether that is fast or slow for the day it is.

**Problem**: a bare percentage of the week says almost nothing about whether today's pace is sustainable. "53% used" on day two and on day six are opposite situations. Everything here exists to turn one percentage into readings a person can act on: a duration, a share of the pace, and a position on a week that is drawn as real days.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now if the week is to be spent evenly, rising with the clock.

## Business logic — TL;DR

- **The week drawn as calendar days** - the bar is divided at local midnights, so each day takes the width it really occupies in the week and its label sits where that day mostly falls.
- **Naming the days** - a fixed two-letter English weekday, in the viewer's own time zone.
- **The color of the week** - four states, with a band either side of the boundary that counts as on track so the bar does not flicker on noise.
- **Pace as a duration** - the gap between consumption and the boundary, said as an amount of the week rather than as percentage points.
- **What has been spent, as time** - the used share of the week said in the same unit as the pace figure beside it.
- **Consumption as a share of the pace** - what is used measured against what may be used by now, where 100 is exactly on pace, and no reading at all in the week's first moments.

## Business logic

### The week drawn as calendar days

#### Context

**Problem**: dividing the bar into seven equal parts labels days at positions that have nothing to do with the clock, because the quota [1] week rarely begins at midnight. A week beginning on Tuesday at 7am has a stub of Tuesday, six whole days, and a second stub of Tuesday.

#### Business logic

The bar is cut at every local midnight between the start of the quota [1] week and its reset, so each segment covers exactly one calendar day, or the part of one that lies inside the week. A segment's width is its true share of the week, which puts each label where most of that day actually falls.

Each midnight is worked out from the previous one rather than by adding twenty-four hours, so a daylight-saving change moves only its own boundary instead of sliding every later one by an hour.

A week whose reset is not after its start has no segments at all.

### Naming the days

#### Context

**Problem**: a localized weekday cut to two letters is not distinguishing in every language — some locales spell every short weekday with the same first two characters, which would label all seven days identically. The bar's axis is a fixed notation, and the dates it stands for are written out in full elsewhere on the panel.

#### Business logic

A day is labeled with the first two letters of its English short weekday name, upper case ("TU"), taken in the viewer's own time zone.

When the quota [1] week starts mid-day, its first and last segments are two slivers of the same weekday, one at each end of the week. Both keep their divider, because both are real elapsed time, but only the wider of the two keeps its label, so that weekday reads exactly once, at whichever end it mostly falls.

### The color of the week

#### Context

**User story**: the bar's color is the answer to "am I on track", before the user reads any number.

**Problem**: consumption drifts a little either side of the boundary [2] from one reading to the next even when spending is exactly on pace. Coloring against a single point would make the bar flip colors on noise that says nothing.

#### Business logic

The week's consumption is in one of four states:

- Full, once the week is at 100 percent used or more. It outranks everything else: the week is spent.
- Over, when consumption is more than five percentage points above the quota boundary [2].
- Near, when consumption is within five percentage points either side of the boundary. This is "on track".
- Under, when consumption is more than five percentage points below the boundary.

### Pace as a duration

#### Context

**User story**: the panel says "Over-consuming" or "Under-consuming" and then how far off pace the account is as an amount of time — "2h", "1d" — which is something a person can weigh.

#### Business logic

The gap between what is used and what the quota boundary [2] allows by now is converted into a signed amount of the quota [1] week: positive means consumption is ahead of pace, negative means it is behind.

### What has been spent, as time

#### Context

**Problem**: the panel would otherwise mix two scales in one line — a percentage of the week beside a duration off pace — leaving the reader to convert between them.

#### Business logic

The used share of the week is also expressed as an amount of the week's allowance: 53 percent of a seven-day week is three and a half days' worth. A reading below zero or above one hundred is clamped first, because a window reporting more than 100 percent used has spent its week, not more than one.

### Consumption as a share of the pace

#### Context

**User story**: beside the bar the user reads "118% of pace", which answers "is today's rate sustainable" — the question the bar's own share of the week does not answer.

#### Business logic

Consumption is divided by what the quota boundary [2] allows by now: 100 is exactly on pace, above that is spending faster than the week allows, below is slower.

In the first moments of a week the allowance so far is zero, and any amount is infinitely above nothing. There is no reading at all in that case, and the panel shows none rather than an infinity.
