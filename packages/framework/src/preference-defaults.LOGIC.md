Fixes what an unset preference [1] means and the bounds that the controls writing them share, in one place the daemon and the dashboard both read: the notification defaults as a two-by-two of method (browser, Discord) by category (needs a human, new activity) and the rule that a notification is delivered only when both its method and its category are on; the spend offset [2], reaching 50 percentage points either way and sitting half a day of the quota week ahead of the quota boundary [3] until the user moves it; and Auto PM [4] keeping two agents [5] going at once.

## Context

**User story**: the user opens Settings and finds the browser bell and the "needs you" notifications on, Discord and plain activity off; the quota panel's line sits a little ahead of the boundary; Auto PM keeps two agents going. Whatever the user changes is stored; whatever is left alone means exactly this.

**Problem**: a default that lives in one place cannot be spelled three ways. Each notification default was once a predicate in the dashboard and open-coded at each daemon call site, and one call site got a category's polarity wrong by copying its sibling; the control that writes the spend offset is in the browser while the check that clamps it is in the daemon, so its bound has to be one number both import.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[3] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[4] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.

## Business logic — TL;DR

- **Notifications are a two-by-two** - four preference keys form two axes, how a notification reaches the user (browser, Discord) and what it is about (an intervention, new activity), and a notification is delivered only when both its method and its category are on.
- **The notification defaults** - browser on and Discord off; interventions on and new activity off: what fires unless turned off is the browser bell and the "needs you" baseline, while anything that reaches outward or is merely informative is opt-in.
- **The spend offset** - reaches 50 points either way, and before anyone touches it sits 100/14 points, about 7.1, ahead of the boundary: half a day of the week, so unattended work is not stopped the moment the account is exactly on pace.
- **Auto PM concurrency** - two agents at once when unset.

## Business logic

### Notifications are a two-by-two

#### Context

**Problem**: the four stored keys are not four settings. Two say how a notification reaches the user and two say what it is about, and nothing in their names says which axis a key belongs to, so the composition "deliver this category by this method" went wrong when open-coded per call site.

#### Business logic

The methods are browser and Discord, stored as the preferences [1] "notify by browser" and "notify by Discord". The categories are intervention [6], stored as "notify on human intervention", and new activity, stored as "notify on new activity". A method is on when its preference says so, or when the preference is unset and its default is on; a category likewise. A notification of a category by a method is delivered exactly when that method is on and that category is on; the daemon asks that one question rather than combining the two itself.

### The notification defaults

#### Context

See `## Context`.

#### Business logic

Unset, the browser method is on and the Discord method is off; the intervention [6] category is on and the new activity category is off. The polarities are deliberately not uniform: the browser bell and the "needs you" baseline fire unless the user turns them off, while everything that reaches outward (Discord) or is loosely informative (plain activity) is opt-in.

### The spend offset

#### Context

**Problem**: a line landing exactly on the quota boundary [3] reads as generous on paper but stops unattended [7] work the moment the account is precisely on pace, which is normal jitter rather than overspending.

#### Business logic

The spend offset [2] reaches at most 50 percentage points either side of the boundary; the control in the dashboard and the clamp in the daemon share that bound. Before the user touches it, the offset is one fourteenth of the week's allowance, 100/14 or about 7.1 percentage points ahead of the boundary: a half-day cushion that gives unattended work room to breathe without meaningfully loosening the policy that the boundary is the line.

### Auto PM concurrency

#### Context

**Problem**: the point of the concurrency setting is that Auto PM [4] may overlap work; a default of one would leave the feature invisible until someone finds the control.

#### Business logic

When the preference [1] is unset, Auto PM keeps two agents [5] going at once: the smallest number that shows the overlap while staying conservative about the quota.
