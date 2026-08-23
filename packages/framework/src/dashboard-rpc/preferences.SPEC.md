The Settings surface: reading and writing the user's preferences, a project's shared custom presets, the editors installed on this machine, and the Discord credentials the daemon needs to actually deliver notifications.

## Business logic — TL;DR

- **Preferences live with the daemon** - they are stored in the registry alongside the project list, so they survive a restart and are the same in every browser and tab.
- **A save of only what changed** - a partial write merges just the changed settings and answers with the settings as they now stand, so one stale tab cannot revert what another tab changed.
- **Custom presets come in two tiers** - the user's own presets sit in the registry; a project's presets are committed into the repo so the whole team gets them.
- **Notification channels report only whether they can deliver** - the dashboard learns that a Discord credential is set and where it came from, never its value.
- **A credential can be set from the dashboard and takes effect at once** - saving it connects the bot without a daemon restart.
- **A failed write is an answer, not a crash** - every write reports failure as a plain outcome the dashboard can render.

## Business logic

### Preferences live with the daemon

#### User story

The user sets their driver, model, prompt switches and default handoff level once, and finds them again after restarting the daemon or opening the dashboard in another browser.

#### Business logic

Preferences are read from and written to the registry, the same file that holds the project list. A read that fails answers with no preferences rather than an error, so the dashboard renders its defaults. Values are sanitized as they are stored.

### A save of only what changed

#### User story

The user has the dashboard open in two tabs. Changing a setting in one must not silently undo a setting changed in the other.

#### Business logic

A full save replaces the whole block of preferences; a partial save merges only the settings the caller changed and hands back the complete stored result, so the caller can adopt what it just wrote against and converge instead of staying stale.

### Custom presets come in two tiers

#### User story

The user keeps their own canned prompts; a team wants prompts that everyone working the repo gets.

#### Business logic

The user's own custom presets are part of their preferences in the registry. A project's custom presets are read from and written into that project's own checkout, so they are committed and travel with the repo. An unknown project has no project presets to read, and saving to one is refused.

### Notification channels report only whether they can deliver

#### User story

Switching on Discord notifications must not light up a channel that silently delivers nothing.

#### Business logic

The dashboard is told whether the daemon has a Discord webhook, which credentials are set at all, where each one came from — so the interface can offer to edit one it stores and merely state that another was configured on the daemon — and whether this daemon can store credentials at all. Only presence is ever reported; no credential value is readable from a browser.

### A credential can be set from the dashboard and takes effect at once

#### User story

Setting up Discord notifications used to mean editing the daemon's environment and restarting it — the one onboarding step that could not be finished inside the product.

#### Business logic

Discord credentials can be stored, or cleared, from the dashboard. The write has no companion read: the value goes to the daemon and the browser only ever learns that it exists. The daemon applies it live, so the bot connects and its watchers start on the save rather than at the next start.

#### Rationale

The exposure is bounded by the guard the whole dashboard already sits behind: when the daemon is not bound to loopback, every route requires the shared token, and anyone past that guard can already start agents — strictly more than setting a webhook.

### Picking an editor

#### User story

The user picks their preferred editor for the dashboard's "open in editor" action.

#### Business logic

The editors actually installed on this machine are detected and offered; when detection fails, none are offered rather than the request failing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
