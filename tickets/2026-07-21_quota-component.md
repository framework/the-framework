Status: open
Topics: [the-framework, ux]
GitHub: [#960](https://github.com/gemstack-land/the-framework/issues/960)

# <Quota> component

## TLDR

A usage bar showing the weekly subscription quota: the bar spans the quota week (starting when the quota period starts, e.g. Tuesday evening), `|` marks the pro-rata "quota boundary" for the current time, `====` shows consumed quota, and the bar's color encodes pace (green underconsuming, blue around the boundary, orange overconsuming, red full). Bonus: a draggable `||` slider setting the "automatic consumption" limit — by default the framework stops auto-firing prompts at the quota boundary; the slider offsets that limit and moves along with the boundary over time. Currently postponed in favor of UX paper cuts.

## Why it matters

The quota bar is the visual for the "spend what's left" idea: it tells at a glance whether autonomous work can keep firing or should hold back, and the slider makes the auto-consumption policy a direct-manipulation control instead of a buried setting. An earlier implementation attempt was reverted and restarted before being postponed.

## Source

Imported from GitHub issue [gemstack-land/the-framework#960](https://github.com/gemstack-land/the-framework/issues/960), created 2026-07-21, labels: `the-framework ♻️`, `UX ✨`, 4 comments.

### Original description

Usage bar:

```
TU  WE  TH  FR  SA  SU  MO  TU
====================     |
```

- The `|` designates the current "quota boundary" (pro-rata usage as per current time of the week)
- The bar starts when the usage quota starts (e.g. Tuesday evening in my case)
  - `TU` is shown twice because the usage quota starts in the middle of the day (Tuesday evening)
- The progress bar `====` designates the consumed quota, so in the bar above I still have a full day of unused quota (sunday)
  - Progress bar changes color:
    - Underconsuming: green
    - Around the quote boundary: blue
    - Overconsuming: orange
    - Full: red

## Bonus: slider (configuration)

Add a slider `||` that the user can slide left/right to set the "automatic consumption" limit:
- By default, The Framework stops automatically firing new prompts when the quota boundary is hit
- By using the slider, the user can change that limit
- The slider "moves along": when the boundary `|` moves over time, the `||` slider moves with it (e.g. a 20px gap between the two remains constant over time)

### Notes from the GitHub thread

- An implementation appeared to have been reverted; it was being redone, then: "We can postpone, I'd say let's focus on UX paper cuts first."
