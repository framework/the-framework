What an unset preference means, and the bounds shared by the controls that write preferences. One module read by both the dashboard (which draws the controls) and the daemon (which acts on the values), so the two can never disagree on a default or a bound.

## Business logic — TL;DR

- **Notifications are a 2×2** - two delivery methods (browser, Discord) crossed with two categories ("needs you", plain activity); a notification is delivered only when its method and its category are both on.
- **Defaults follow reach** - browser and "needs you" fire unless turned off; anything reaching outward (Discord) or merely informative (plain activity) is opt-in.
- **Shared bounds** - the slider that moves the unattended-work spend limit reaches at most 50 percentage points either way from the quota boundary, and defaults to half a day's allowance ahead of it; Auto PM runs 2 agents at once by default.

## Business logic

### Notifications are a 2×2

#### User story

The user picks separately *how* notifications reach them (browser bell, Discord message) and *what* they are notified about (an agent needs their answer / a PR is ready — the "needs you" category — versus plain activity like an agent starting or finishing).

#### Business logic

The four notification preferences are two axes, not four independent switches. Whether one cell of the grid delivers is a single question answered in one place: the method must be on and the category must be on. Defaults when nobody has said: browser on, Discord off, "needs you" on, plain activity off — the baseline The Framework leans on (being told when something needs you, in the surface you already have open) fires unless turned off, while everything opt-in reaches outward or is merely informative. Stored preference keys are unchanged from before the axes were named, so older settings files still read.

#### Rationale

The composition used to be open-coded per call site, which let one site get a category's polarity wrong by copying its sibling. Answering "does this cell deliver?" in exactly one place is what removes that class of bug.

### Shared bounds

#### Business logic

The slider that offsets the unattended-work spend limit from the quota boundary is bounded at ±50 percentage points, and its default position is half a day's worth of the week's allowance ahead of the boundary (100/14 points). The number of agents Auto PM's draining routine may keep going at once defaults to 2, with no upper bound. These numbers live here because the control that writes each value runs in the browser while the sanitizer that clamps it runs in the daemon — both must import the same number.

#### Rationale

A default spend limit sitting exactly on the boundary stops unattended work the moment the account is precisely on pace — which is normal jitter, not overspending. The half-day cushion gives it room to breathe without meaningfully loosening the policy. Auto PM's default of 2 (not 1) is the smallest value that makes the overlap feature visible at all while staying conservative about quota. The agent count has no upper bound because how many agents to run at once is the user's call — the week's allowance is what actually paces unattended work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
