Fixes what an unset preference [1] means, and the spend offset's [2] reach and default, in one place the daemon and the dashboard both read: the notification defaults as browser delivery plus two categories (needs a human, new activity) and the rule that a notification is delivered only when both browser delivery and its category are on; the spend offset, reaching 50 percentage points either way and sitting half a day of the quota week ahead of the quota boundary [3] until someone sets it. The spend offset is not a preference: each project's scheduler holds it; only its bound and its default live here.

## Context

**User story**: the user opens Settings and finds the browser bell and the "needs you" notifications on, plain activity off; the quota panel's line sits a little ahead of the boundary. Whatever the user changes is stored; whatever is left alone means exactly this.

**Problem**: a default that lives in one place cannot be spelled three ways. Each notification default was once a predicate in the dashboard and open-coded at each call site, and one call site got a category's polarity wrong by copying its sibling; the controls that write the spend offset (the usage panel's slider and the Settings number) are in the browser while the default the daemon's quota reading falls back to is in the daemon, so the bound and the default have to be numbers both import.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.
[3] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[4] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[5] unattended: said of an agent nobody is watching: one the scheduler started rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.

## Business logic — TL;DR

- **Notifications have two axes** - three preference keys: whether notifications reach the user in the browser, and what they are about (an intervention, new activity); a notification is delivered only when both browser delivery and its category are on.
- **The notification defaults** - browser delivery on; interventions on and new activity off: what fires unless turned off is the browser bell and the "needs you" baseline, while what is merely informative is opt-in.
- **The spend offset** - the dashboard's controls reach 50 points either way, and when no scheduler names one it sits 100/14 points, about 7.1, ahead of the boundary: half a day of the week, so unattended work is not stopped the moment the account is exactly on pace.

## Business logic

### Notifications have two axes

#### Context

**Problem**: the three stored keys are not three settings of one kind. One says whether a notification reaches the user in the browser and two say what it is about, and nothing in their names says which axis a key belongs to, so the composition "deliver this category" went wrong when open-coded per call site.

#### Business logic

Browser delivery is stored as the preference [1] "notify by browser". The categories are intervention [4], stored as "notify on human intervention", and new activity, stored as "notify on new activity". Browser delivery is on when its preference says so, or when the preference is unset and its default is on; a category likewise. A notification of a category is delivered exactly when browser delivery is on and that category is on, and one function answers that question.

### The notification defaults

#### Context

See `## Context`.

#### Business logic

Unset, browser delivery is on; the intervention [4] category is on and the new activity category is off. The polarities are deliberately not uniform: the browser bell and the "needs you" baseline fire unless the user turns them off, while what is loosely informative (plain activity) is opt-in.

### The spend offset

#### Context

**Problem**: a line landing exactly on the quota boundary [3] reads as generous on paper but stops unattended [5] work the moment the account is precisely on pace, which is normal jitter rather than overspending.

#### Business logic

The dashboard's two controls for the spend offset [2], the usage panel's slider and the Settings number, reach at most 50 percentage points either side of the boundary and share that bound; the daemon does not clamp what they send. When no scheduler names an offset, the daemon's quota reading uses the default, and the dashboard's controls show it until the first reading arrives: one fourteenth of the week's allowance, 100/14 or about 7.1 percentage points ahead of the boundary, a half-day cushion that gives unattended work room to breathe without meaningfully loosening the policy that the boundary is the line.
