Resolves the settings in force wherever the user is in the dashboard: their own preferences, with the open project's committed `the-framework.yml` layered on top. It keeps one shared answer that every part of the dashboard reads, decides what a change writes and where, and answers what each individual setting resolves to — the theme, whether browser or Discord delivery is on, and which notification categories are on.

## Glossary

- **tier** - one of the two layers a setting can come from: the user's own **preferences**, and the open project's committed `the-framework.yml`.
- **provenance** - which tier a resolved setting actually came from, so a value inherited from the repo can be shown as not the user's own choice.

## Business logic — TL;DR

- **Two tiers, nearest wins** - the open project's committed `the-framework.yml` overrides the user's own preferences, key by key.
- **One writable destination** - only the user's own preferences can be changed from the dashboard; a repo-shaped setting is edited in the repo.
- **Provenance per setting** - each resolved setting reports which tier set it, so the launcher can show an inherited value as not the user's own.
- **One shared answer** - every part of the dashboard reads the same resolved settings and moves together on a change.
- **A write sends only what changed** - and never lets a stale answer overwrite the value the user just chose.
- **Re-read when the user comes back** - returning to the window or the tab re-reads both tiers, so a tab left open stops showing values someone changed elsewhere.
- **Shared project presets** - the open project's custom presets are read from and written back to the repo, so everyone who clones it gets them.
- **Named readers for individual settings** - the theme in force, browser and Discord delivery, and the "new activity" and "needs you" categories.

## Business logic

### Two tiers, nearest wins

#### User story

A user has their own dashboard settings. A project can also commit settings in its `the-framework.yml`, which everyone who clones the repo gets.

#### Business logic

The settings in force are the user's own preferences with the open project's committed `the-framework.yml` layered over them, key by key: the nearer tier wins. With no project open, or with a project that commits nothing, the user's own preferences stand alone. Every project's committed file is read in one go from the project list, and the daemon re-reads the file itself on each request.

#### Rationale

A third tier once existed — the user's own per-project overrides — duplicating for one machine what the committed file already states for everyone. It cost a split write path, per-tier write bookkeeping and a three-way provenance union, and was removed so that everything writable goes to exactly one place.

### One writable destination

#### User story

The user toggles a setting in the dashboard.

#### Business logic

Only the user's own preferences are writable from the dashboard; the repo's committed file is edited in the repo. Every change therefore has a single destination and there is no split to get wrong. A change is applied to the shared answer immediately so the interface responds at once, then persisted daemon-side; a failed save is not surfaced, since it is not worth an error over a checkbox.

### Provenance per setting

#### User story

Looking at the launcher, the user needs to tell a value they chose from one the project's committed file handed them.

#### Business logic

Alongside the resolved settings, each key reports which tier set it — the user's own preferences or the repo — with no answer at all for a key nobody set. The nearer tier's claim wins, matching how the value itself resolves.

### One shared answer

#### User story

Several parts of the dashboard show the same settings at once — for instance the Start form's toggles and a gate's autopilot countdown.

#### Business logic

The resolved settings are held once and every reader is subscribed, so a change moves all of them together. Each tier is read from the daemon once rather than per reader. While the dashboard is being pre-rendered there is no daemon, so the answer starts empty and the real values arrive in the browser.

### A write sends only what changed

#### User story

Two dashboard tabs are open, or one has been sitting in the background for a while, and settings change in the other.

#### Business logic

A change sends only the keys it actually changed, and adopts the settings the daemon reports back, so the tab stops being stale about anything changed elsewhere. If a newer change went out in the meantime, the older reply is ignored — the newer answer is the more recent truth and is about to arrive. A re-read is likewise skipped while any change is still in flight, in either order, because until the daemon has stored those keys no read can answer with them.

#### Rationale

Sending the whole cached set of settings meant a tab replayed every value it happened to be holding, so a tab open since before someone else's change reverted it on its next write — most visibly the theme.

Similarly, if the very first load of the user's preferences is still in flight when the user toggles something, the arriving load must not overwrite the value that toggle already stored.

### Re-read when the user comes back

#### User story

Someone edits a project's `the-framework.yml` in their editor, or changes a setting in another tab, then looks at the dashboard again.

#### Business logic

Both tiers are re-read whenever the window regains focus and whenever a tab becomes visible again. The second case matters on its own: switching back to a tab inside an already-focused window announces no focus change, and that is exactly when a tab is showing values someone changed elsewhere.

### Shared project presets

#### User story

A team wants its custom presets to travel with the repo, so everyone who clones it gets them.

#### Business logic

The open project's shared custom presets are read from the repo once per project, and replacing them writes through immediately and then persists back into the repo. With no project open there are no shared presets and nothing to save, since there is no repo to commit them to. A failed save is not surfaced, as with any other preference write.

### Named readers for individual settings

#### User story

Components ask about one setting at a time: which theme to paint, whether to raise a browser notification, whether to post to Discord, and which categories of event are worth notifying about at all.

#### Business logic

The theme in force is the user's choice, or following the operating system when they have not chosen; the dark palette applies when they chose dark, or when they follow the operating system and it is dark.

Notification delivery is asked per method — browser delivery, where the browser's own permission remains the real gate, and Discord delivery, where the daemon's webhook is the other gate — and per category: "new activity", which pings on an agent starting or finishing, and "needs you", which pings when an agent is awaiting an answer or a PR needs review. A method and a category compose: both must be on.

#### Rationale

The defaults for these settings belong to the framework rather than the dashboard, because the daemon acts on the same values and the polarities are not uniform. A second copy of the defaults here is how the two sides would drift.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
