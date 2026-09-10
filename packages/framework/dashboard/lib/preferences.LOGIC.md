Holds the browser's view of the user's preferences [1]: loads them from the daemon once, hands every part of the dashboard the same answer, applies a change the moment the user makes it, and writes it back. The answer is two tiers deep — the user's own preferences with the open project's committed `the-framework.yml` [2] laid on top — and only the user's own tier can be written from the dashboard, because the other one is edited in the repository.

## Context

**User story**: the user flips a toggle in Settings [3] or on the launcher [4] — theme, driver, model, handoff [5], notifications, Auto PM [6] — and the whole dashboard reflects it at once, on this screen and on every other one. Reloading, or opening the dashboard in a second tab, shows the same values, because they live with the daemon and not with the browser. Opening a project whose repository commits a `the-framework.yml` shows that file's answers instead of the user's own for the settings it fixes.

**Problem**: preferences kept per browser cannot be acted on by the daemon, which starts unattended agents [7] with the same settings a user-started agent would get, and they diverge between two tabs and two browsers. Keeping them with the daemon makes them one value; this file is the browser's copy of that one value and the rules that keep the copy honest.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[3] Settings: the settings page.
[4] launcher: the Start form on a project's own page.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[8] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[9] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[10] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **Two tiers, one of them writable** - the user's own preferences, with the open project's committed `the-framework.yml` on top for the three settings that file may fix; everything the dashboard writes goes to the user's tier.
- **One shared answer for the whole dashboard** - the values are fetched from the daemon once and every screen reads the same copy, so no two surfaces disagree.
- **Nothing is stored in the browser** - preferences live with the daemon, and the secrets the daemon holds never reach the browser at all.
- **A change applies at once, then persists** - the new value is in force before the round trip, only the keys that changed are sent, and what the daemon stores back is adopted.
- **A failed write is silent** - a save the daemon refuses or never answers leaves the chosen value on screen and raises nothing.
- **Catching up with other tabs and with the repository** - returning to the dashboard re-reads both tiers, except while the user's own write is still in flight.
- **The address decides which project's file applies** - the project in the browser's address is the one whose `the-framework.yml` is laid on top.
- **Where each value came from** - every resolved setting says whether it is the user's own or inherited from the repository's file.
- **The project's shared custom presets** - a project's saved prompts are read from and written to a file committed in the repository, so everyone who clones it has them.
- **The theme** - the dashboard follows the operating system unless the user picked light or dark.
- **Which notifications are on by default** - browser delivery and the "Human Queue" category are on unless turned off; Discord delivery and "New activity" are off until switched on.

## Business logic

### Two tiers, one of them writable

#### Context

**User story**: a repository can commit its own answers in `the-framework.yml` [2] so that everyone who clones it starts agents [7] the same way, without each person setting it up. The user's own preferences [1] still decide everything that file does not fix.

**Problem**: with more than one writable tier, a setting has more than one home, and the user cannot tell which copy a value was written to. One writable tier removes the question.

#### Business logic

A resolved setting is the user's own preferences [1] with the open project's committed `the-framework.yml` [2] laid on top, key by key: the repository's file wins for any key it sets, and the user's value stands everywhere else. The file may fix exactly three settings — whether agents [7] run transparent [8], whether they run vanilla [9], and the handoff [5] level. A project with no such file, and any screen with no project open, resolves to the user's own preferences alone.

Everything the dashboard writes goes to the user's own tier. The repository's file is changed by editing it in the repository, never from the dashboard.

### One shared answer for the whole dashboard

#### Context

**Problem**: the launcher's [4] toggles, the notification menu, the gate countdown and Settings [3] all read the same settings. If each fetched its own copy, a change made on one would leave the others showing the old value until they happened to refetch.

#### Business logic

The preferences [1] are fetched from the daemon the first time any screen asks for them, and that one answer is shared: every screen reads it, and every change notifies all of them at once. A second screen asking while the first fetch is still running waits for it rather than starting another.

A fetch the daemon does not answer resolves to no preferences at all, which means every setting takes its default; the dashboard stays usable rather than blocking on the daemon. The same holds for the repository tier: projects whose `the-framework.yml` [2] could not be read contribute nothing, and their settings fall back to the user's own.

Before the browser is running — while the page is being rendered ahead of time, with no daemon to ask — every setting reads as unset, and the real values arrive once the page is live.

### Nothing is stored in the browser

#### Context

**Problem**: settings the daemon must act on cannot live in the browser. The daemon starts unattended agents [7] with the same driver, model, handoff [5] and Auto PM [6] settings the user picked in the dashboard, and it must read them without a browser being open.

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

A save the daemon refuses, or never answers, is dropped: nothing is shown to the user, and the value that was chosen stays in force for as long as the page is open. The same applies to saving a project's custom presets.

### Catching up with other tabs and with the repository

#### Context

**User story**: the user edits `the-framework.yml` [2] in an editor, switches back to the dashboard, and the launcher [4] shows the file's new answers. The user changes a setting in another tab, comes back to this one, and this one is already up to date.

#### Business logic

Both tiers are re-read whenever the dashboard's window regains focus, and also whenever the tab becomes visible again — switching tabs inside an already-focused window is exactly the case where a tab is showing what somebody changed elsewhere.

Re-reading the user's own tier is skipped while one of this tab's own writes is still in flight, whichever went out first: until the daemon has stored those keys, a read cannot answer with them, and the write's own answer carries the merged truth anyway.

The daemon re-reads each project's `the-framework.yml` [2] on every request, so re-reading the repository tier is what stops the launcher showing an answer from before the file was edited. One request covers every registered project.

### The address decides which project's file applies

#### Context

**Business logic story**: the browser's address is the dashboard's selection, including which project is open — the rules are in `route.ts`.

#### Business logic

The project whose `the-framework.yml` [2] is laid on top is the project named in the browser's current address. A write started from a button reads the address at that moment rather than any remembered project, so it always belongs to the project the user is looking at.

### Where each value came from

#### Context

**User story**: on the launcher [4], a setting inherited from the repository's committed file is shown as inherited rather than as something the user chose, so the user knows why it reads the way it does and where to change it.

#### Business logic

Alongside the resolved settings, each key that anybody set carries which tier set it: the user's own preferences [1], or the repository's `the-framework.yml` [2]. A key set in both is attributed to the repository's file, which is the tier that wins. A key nobody set carries no source at all, meaning it is on its default.

### The project's shared custom presets

#### Context

**User story**: the user saves a prompt as a preset for a project, and everyone who clones that repository gets it, because it is committed with the code rather than kept in one person's settings.

#### Business logic

A project's shared presets are read from a file committed inside the project (`.the-framework/custom-presets.json`) the first time that project is opened, and once only per project. A read that fails leaves the project with no shared presets rather than an error.

Saving replaces the whole list for the open project: the new list is in force at once and then committed, best-effort. With no project open there is nowhere to commit to, so saving does nothing and the shared list is empty.

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
- The "Human Queue" category, an intervention [10]: on. It is the baseline The Framework leans on, so it fires until the user turns it off.
- The "New activity" category: off. It is loosely informative, so it is opt in.
