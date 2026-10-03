Fixes what an unset preference [1] means, and the reach of the usage bar's handle [2], in one place the daemon and the dashboard both read: the notification defaults as browser delivery plus two categories (needs a human, new activity) and the rule that a notification is delivered only when both browser delivery and its category are on; and the handle, reaching 50 percentage points either side of the quota boundary [3]. What the handle sets is not a preference: the package whose module puts the stop line on the bar holds it; only the bound lives here.

## Context

**User story**: the user opens Settings and finds the browser bell and the "needs you" notifications on, plain activity off. Whatever the user changes is stored; whatever is left alone means exactly this.

**Problem**: a default that lives in one place cannot be spelled three ways. Each notification default was once a predicate in the dashboard and open-coded at each call site, and one call site got a category's polarity wrong by copying its sibling; and the bound of the usage bar's handle is one number the bar and any module that offers the same setting as a number both read.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] the usage bar's handle: the control on the Overview's usage bar that moves a module's stop line, the offset from the quota boundary, in percentage points of the week, at which that module's unattended work stops.
[3] quota boundary: the share of the quota week that may be spent by now, rising with the clock. The dashboard only draws it; whether work stops at it is the business of whatever starts unattended work.
[4] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[5] unattended: said of an agent nobody is watching: one a package started on its own rather than a person. It is not answered any faster: a question it ends on waits for a human like any other.

## Business logic — TL;DR

- **Notifications have two axes** - three preference keys: whether notifications reach the user in the browser, and what they are about (an intervention, new activity); a notification is delivered only when both browser delivery and its category are on.
- **The notification defaults** - browser delivery on; interventions on and new activity off: what fires unless turned off is the browser bell and the "needs you" baseline, while what is merely informative is opt-in.
- **The reach of the usage bar's handle** - 50 points either side of the quota boundary; no default lives here, since the offset in force is whatever the module reads.

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

### The reach of the usage bar's handle

#### Context

**Problem**: a handle [2] dragged to the end of the bar would otherwise set a stop line that is never reached, or always passed.

#### Business logic

The usage bar clamps the offset a drag picks to at most 50 percentage points either side of the quota boundary [3]. The same number is handed to modules (`dashboard/module/index.ts`), so a module that also offers the setting as a typed number holds it to the same reach. There is no default offset here: before a module's first read, and with no module declaring a stop line, the bar draws no handle. Unattended [5] work's own default is its package's.
