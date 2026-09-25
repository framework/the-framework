The Settings surface of the dashboard's calls: reading and saving the user's preferences [1], the merge that keeps a stale tab from reverting settings it never touched, a project's shared custom presets [2] committed into its `.the-framework/`, and the editors installed on the daemon's machine for the "Preferred editor" picker.

## Context

**User story**: on Settings [3] the user changes the driver [4], the model, the theme, the notification toggles and the browser bridge switches, saves custom presets [2] for themselves or for the whole team, and picks an editor — all from the dashboard, without a daemon restart or a config file edit. Two tabs open at once do not undo each other's changes.

**Business logic story**: the preferences [1] are kept in the registry [7], the daemon-side file that also lists the projects, so they survive restarts with nothing stored in the browser. Every value is validated by the registry's rules (`registry.ts`) on its way in: a value of the wrong type is dropped, a choice outside its known set (the driver, the theme) is dropped so the default applies, free text is trimmed and length-capped, and a blank string or an empty list means "no choice".

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] custom preset: a prompt the user saved, with an id and a label, listed as a saved prompt in the launcher's Commands menu beside the project's commands.
[3] Settings: the settings page.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude-code` or `codex`.
[7] registry: `~/.the-framework.json`: where the user's preferences are kept, and which also lists the projects.

## Business logic — TL;DR

- **Reading the preferences** - the stored preferences [1] as the registry [7] holds them; a failed read answers empty preferences rather than an error.
- **Saving all preferences** - replaces the whole block after validation; a failed write answers the typed error "failed to save preferences" instead of failing the call.
- **Patching: merge, then hand back the truth** - only the keys the caller changed are merged into what is stored, and the merged result comes back so the tab adopts it and converges.
- **A project's shared custom presets** - the team's custom presets [2] live in the project's `.the-framework/custom-presets.json`, committed so they travel with the repository; an unknown project reads as none and refuses a save.
- **Installed editors** - the editors found on the daemon's machine, for the "Preferred editor" picker; none when detection fails.

## Business logic

### Reading the preferences

#### Context

See `## Context`.

#### Business logic

The call answers the preferences [1] the registry [7] holds. When the registry cannot be read, it answers empty preferences — every setting at its default — rather than an error.

### Saving all preferences

#### Context

See `## Context`.

#### Business logic

The call replaces the stored preferences [1] with the block it is given, validated by the registry's [7] rules. A write that fails answers a typed error, "failed to save preferences", rather than failing the call, so the dashboard shows the failure instead of losing the save to an error it cannot read.

### Patching: merge, then hand back the truth

#### Context

**Problem**: saving the whole block from a tab that loaded a while ago overwrites whatever anyone else — another tab, another device's dashboard — changed since it loaded, reverting settings the tab never touched.

#### Business logic

The call merges only the keys it is given into the stored preferences [1] and answers with what is now stored, so the caller adopts the truth it just wrote against and a stale tab converges instead of staying stale. Clearing a setting needs no special value: a blank string or an empty list is dropped by the registry's [7] validation, which is what absent means. A failed write answers the same typed error, "failed to save preferences".

### A project's shared custom presets

#### Context

**User story**: a team shares its custom presets [2] through the repository itself, so everyone who clones the project gets them, while the user's own custom presets stay in the registry [7].

#### Business logic

A project's shared custom presets are read from, and written to, `.the-framework/custom-presets.json` in the project's own checkout, a committed file (its format and the rule that makes git track it are `project-presets.ts`'s). The project is named by its id and resolved through the registry: an unknown project reads as no presets, and a save to one is refused with "unknown project". A file that cannot be read yields no presets; a save that fails answers "failed to save presets". The presets are validated by the same rules as the user's own.

### Installed editors

#### Context

**User story**: the "Preferred editor" picker on Settings [3] offers only editors that are actually installed on the daemon's machine, which is where "Open in editor" runs.

#### Business logic

The call answers the installed subset of the editors The Framework knows how to open (the list and the probe are `dashboard/open-in-app.ts`'s), in display order. When detection fails it answers none.
