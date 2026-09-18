Holds the browser's view of the user's preferences [1]: loads them from the daemon once, hands every part of the dashboard the same answer, applies a change the moment the user makes it, and writes it back. It also holds the open project's saved prompts [2], which live in the project's repository and not with the user.

## Context

**User story**: the user flips a toggle in Settings [3] or on the launcher [4] — theme, coding agent, model, notifications — and the whole dashboard reflects it at once, on this screen and on every other one. Reloading, or opening the dashboard in a second tab, shows the same values, because they live with the daemon and not with the browser.

**Problem**: preferences kept per browser diverge between two tabs and two browsers, and the daemon could not act on them. Keeping them with the daemon makes them one value; this file is the browser's copy of that one value and the rules that keep the copy honest.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] saved prompt: a prompt the user saved under a name, either for themselves (kept with their preferences) or for the project (committed in the project's repository), and loads back into the editor verbatim.
[3] Settings: the settings page.
[4] launcher: the Start form on a project's own page.
[5] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **One shared answer for the whole dashboard** - the values are fetched from the daemon once and every screen reads the same copy, so no two surfaces disagree.
- **Nothing is stored in the browser** - preferences live with the daemon, and the secrets the daemon holds never reach the browser at all.
- **A change applies at once, then persists** - the new value is in force before the round trip, only the keys that changed are sent, and what the daemon stores back is adopted.
- **A failed write is silent** - a save the daemon refuses or never answers leaves the chosen value on screen and raises nothing.
- **Catching up with other tabs** - returning to the dashboard re-reads the preferences, except while the user's own write is still in flight.
- **The project's saved prompts** - a project's saved prompts [2] are read from and written to a file committed in the repository, so everyone who clones it has them; the project is the one in the browser's address.
- **The theme** - the dashboard follows the operating system unless the user picked light or dark.
- **Which notifications are on by default** - browser delivery and the "Human Queue" category are on unless turned off; Discord delivery and "New activity" are off until switched on.

## Business logic

### One shared answer for the whole dashboard

#### Context

**Problem**: the launcher's [4] toggles, the notification menu, the gate countdown and Settings [3] all read the same settings. If each fetched its own copy, a change made on one would leave the others showing the old value until they happened to refetch.

#### Business logic

The preferences [1] are fetched from the daemon the first time any screen asks for them, and that one answer is shared: every screen reads it, and every change notifies all of them at once. A second screen asking while the first fetch is still running waits for it rather than starting another.

A fetch the daemon does not answer resolves to no preferences at all, which means every setting takes its default; the dashboard stays usable rather than blocking on the daemon.

Before the browser is running — while the page is being rendered ahead of time, with no daemon to ask — every setting reads as unset, and the real values arrive once the page is live.

### Nothing is stored in the browser

#### Context

**Problem**: settings the daemon must act on cannot live in the browser. The daemon posts notifications when no browser is open, and it must read which ones the user wants without one.

#### Business logic

Preferences [1] are kept by the daemon in the registry file and nowhere else; the dashboard keeps them only for as long as the page is open, and writes none of them to the browser's own storage. Two browsers, two tabs and the daemon itself therefore all act on the same values.

The secrets the registry file also holds — the daemon token and the Discord credentials — are not preferences and never travel to the browser. The dashboard is only ever told whether a credential is present.

### A change applies at once, then persists

#### Context

**User story**: the user ticks a checkbox in the launcher [4] and the form reflects it immediately, without a wait on the daemon.

**Problem**: a tab that has been open since before somebody else's change is holding stale values for the settings the user is not touching. Sending its whole set of values back on the next write would replay those stale ones over the newer ones — most visibly the theme, which would flip back.

#### Business logic

A change is merged into the shared answer and every screen is notified before the daemon has been asked, so the new value is in force at once.

Only the keys the change actually touched are sent. The daemon merges them into what it stores and answers with the merged result, which the dashboard then adopts — so a write is also how a tab stops being stale about everything another tab changed.

Two writes in quick succession never fight: the answer to a write is only adopted when no newer write has gone out since, because the newer write's own answer is the more recent truth and is about to arrive.

### A failed write is silent

#### Context

**Problem**: a settings toggle is not worth an error dialog. What matters is that the value the user chose stays on screen.

#### Business logic

A save the daemon refuses, or never answers, is dropped: nothing is shown to the user, and the value that was chosen stays in force for as long as the page is open. The same applies to saving a project's shared saved prompts.

### Catching up with other tabs

#### Context

**User story**: the user changes a setting in another tab, comes back to this one, and this one is already up to date.

#### Business logic

The preferences [1] are re-read whenever the dashboard's window regains focus, and also whenever the tab becomes visible again — switching tabs inside an already-focused window is exactly the case where a tab is showing what somebody changed elsewhere.

The re-read is skipped while one of this tab's own writes is still in flight, whichever went out first: until the daemon has stored those keys, a read cannot answer with them, and the write's own answer carries the merged truth anyway.

### The project's saved prompts

#### Context

**User story**: the user saves a prompt for a project, and everyone who clones that repository gets it, because it is committed with the code rather than kept in one person's settings.

**Business logic story**: the browser's address is the dashboard's selection, including which project is open — the rules are in `route.ts`.

#### Business logic

A project's saved prompts [2] are read from a file committed inside the project (`.the-framework/custom-presets.json`) the first time that project is opened, and once only per project. A read that fails leaves the project with no saved prompts rather than an error.

Saving replaces the whole list for the open project: the new list is in force at once and then committed, best-effort. The open project is the one named in the browser's address at the moment of the save, not a remembered one, so a save always belongs to the project the user is looking at. With no project open there is nowhere to commit to, so saving does nothing and the list is empty.

### The theme

#### Context

**User story**: the user picks the dashboard's appearance in Settings [3]: follow the operating system, always light, or always dark.

#### Business logic

An unset theme means "system": the dashboard follows the operating system's own dark preference. The dark palette applies when the user picked dark, or picked "system" and the operating system prefers dark.

### Which notifications are on by default

#### Context

**User story**: the user opens the notifications menu and switches delivery — "Browser", "Discord" — and subject — "Human Queue" ("An agent awaiting you, or a PR to review"), "New activity" ("An agent started or finished").

**Problem**: the daemon acts on the same four settings, and their defaults are not uniform, so the browser must not keep a second copy of them. It reads the one set of defaults the daemon reads, in `preference-defaults.ts`.

#### Business logic

Notifications are two independent axes: how a notification reaches the user, and what it is about. A notification is delivered only when both its method and its category are on.

Unset means:

- Browser delivery: on. The browser's own notification permission is still the real gate, which is handled in `notification-permission.ts`.
- Discord delivery: off, because it reaches the user with no dashboard open. The daemon also needs a webhook configured — that is where to post, this is whether to.
- The "Human Queue" category, an intervention [5]: on. It is the baseline The Framework leans on, so it fires until the user turns it off.
- The "New activity" category: off. It is loosely informative, so it is opt in.
