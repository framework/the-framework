Fixes what an unset notification preference [1] means, in one place the daemon and the dashboard both read: the notification defaults as a two-by-two of method (browser, Discord) by category (needs a human, new activity) and the rule that a notification is delivered only when both its method and its category are on.

## Context

**User story**: the user opens Settings and finds the browser bell and the "needs you" notifications on, Discord and plain activity off. Whatever the user changes is stored; whatever is left alone means exactly this.

**Problem**: a default that lives in one place cannot be spelled three ways. Each notification default was once a predicate in the dashboard and open-coded at each daemon call site, and one call site got a category's polarity wrong by copying its sibling.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **Notifications are a two-by-two** - four preference keys form two axes, how a notification reaches the user (browser, Discord) and what it is about (an intervention, new activity), and a notification is delivered only when both its method and its category are on.
- **The notification defaults** - browser on and Discord off; interventions on and new activity off: what fires unless turned off is the browser bell and the "needs you" baseline, while anything that reaches outward or is merely informative is opt-in.

## Business logic

### Notifications are a two-by-two

#### Context

**Problem**: the four stored keys are not four settings. Two say how a notification reaches the user and two say what it is about, and nothing in their names says which axis a key belongs to, so the composition "deliver this category by this method" went wrong when open-coded per call site.

#### Business logic

The methods are browser and Discord, stored as the preferences [1] "notify by browser" and "notify by Discord". The categories are intervention [2], stored as "notify on human intervention", and new activity, stored as "notify on new activity". A method is on when its preference says so, or when the preference is unset and its default is on; a category likewise. A notification of a category by a method is delivered exactly when that method is on and that category is on; the daemon asks that one question rather than combining the two itself.

### The notification defaults

#### Context

See `## Context`.

#### Business logic

Unset, the browser method is on and the Discord method is off; the intervention [2] category is on and the new activity category is off. The polarities are deliberately not uniform: the browser bell and the "needs you" baseline fire unless the user turns them off, while everything that reaches outward (Discord) or is loosely informative (plain activity) is opt-in.
