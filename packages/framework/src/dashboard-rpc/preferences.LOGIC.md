The Settings surface of the dashboard's calls: reading and saving the user's preferences [1], the merge that keeps a stale tab from reverting settings it never touched, a project's shared custom presets [2] committed into its `.the-framework/`, the editors installed on the daemon's machine for the "Preferred editor" picker, which notification channels the daemon can deliver on, and the Discord credentials the user sets from the dashboard — which are write-only: the browser learns that a credential is set, never its value.

## Context

**User story**: on Settings [3] the user changes the driver [4], the model, the handoff [5] level, the theme, the notification toggles, the Auto PM [6] switches and the spend offset [7], saves custom presets [2] for themselves or for the whole team, picks an editor, and pastes a Discord webhook — all from the dashboard, without a daemon restart or a config file edit. Two tabs open at once do not undo each other's changes.

**Business logic story**: the preferences [1] are kept in the registry [8], the daemon-side file that also lists the projects, so they survive restarts with nothing stored in the browser. Every value is validated by the registry's rules (`registry.ts`) on its way in: a value of the wrong type is dropped, a choice outside its known set (the driver, the theme, the location [9], the handoff level) is dropped so the default applies, a number is rounded and clamped, free text is trimmed and length-capped, and a blank string or an empty list means "no choice".

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] custom preset: a preset the user saved: a prompt with an id and a label, shown beside the built-in presets.
[3] Settings: the settings page.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[6] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[7] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[8] registry: `~/.the-framework.json`: where the user's preferences are kept, and which also lists the projects.
[9] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[10] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.

## Business logic — TL;DR

- **Reading the preferences** - the stored preferences [1] as the registry [8] holds them; a failed read answers empty preferences rather than an error.
- **Saving all preferences** - replaces the whole block after validation; a failed write answers the typed error "failed to save preferences" instead of failing the call.
- **Patching: merge, then hand back the truth** - only the keys the caller changed are merged into what is stored, and the merged result comes back so the tab adopts it and converges.
- **A project's shared custom presets** - the team's custom presets [2] live in the project's `.the-framework/custom-presets.json`, committed so they travel with the repository; an unknown project reads as none and refuses a save.
- **Installed editors** - the editors found on the daemon's machine, for the "Preferred editor" picker; none when detection fails.
- **Notification channels the daemon can deliver on** - whether a Discord webhook is set and where it came from, as presence only, so the dashboard never offers a channel that delivers nothing.
- **Setting the Discord credentials from the dashboard** - a write-only patch that sets or clears the webhook daemon-side and takes effect at once; the browser never reads a credential back.

## Business logic

### Reading the preferences

#### Context

See `## Context`.

#### Business logic

The call answers the preferences [1] the registry [8] holds. When the registry cannot be read, it answers empty preferences — every setting at its default — rather than an error.

### Saving all preferences

#### Context

See `## Context`.

#### Business logic

The call replaces the stored preferences [1] with the block it is given, validated by the registry's [8] rules. A write that fails answers a typed error, "failed to save preferences", rather than failing the call, so the dashboard shows the failure instead of losing the save to an error it cannot read.

### Patching: merge, then hand back the truth

#### Context

**Problem**: saving the whole block from a tab that loaded a while ago overwrites whatever anyone else — another tab, another device's dashboard — changed since it loaded, reverting settings the tab never touched.

#### Business logic

The call merges only the keys it is given into the stored preferences [1] and answers with what is now stored, so the caller adopts the truth it just wrote against and a stale tab converges instead of staying stale. Clearing a setting needs no special value: a blank string or an empty list is dropped by the registry's [8] validation, which is what absent means. A failed write answers the same typed error, "failed to save preferences".

### A project's shared custom presets

#### Context

**User story**: a team shares its custom presets [2] through the repository itself, so everyone who clones the project gets them, while the user's own custom presets stay in the registry [8].

#### Business logic

A project's shared custom presets are read from, and written to, `.the-framework/custom-presets.json` in the project's own checkout, a committed file (its format and the rule that makes git track it are `project-presets.ts`'s). The project is named by its id and resolved through the registry: an unknown project reads as no presets, and a save to one is refused with "unknown project". A file that cannot be read yields no presets; a save that fails answers "failed to save presets". The presets are validated by the same rules as the user's own.

### Installed editors

#### Context

**User story**: the "Preferred editor" picker on Settings [3] offers only editors that are actually installed on the daemon's machine, which is where "Open in editor" runs.

#### Business logic

The call answers the installed subset of the editors The Framework knows how to open (the list and the probe are `dashboard/open-in-app.ts`'s), in display order. When detection fails it answers none.

### Notification channels the daemon can deliver on

#### Context

**Problem**: the notification toggles are per-user preferences [1], but Discord delivery needs a webhook on the daemon. Without this read the dashboard let the user switch on a channel that delivers nothing, and lit the notification bell for it.

#### Business logic

The call reports whether a Discord webhook is set, where each credential came from — the daemon's environment or the value stored from the dashboard — and that this host can store a credential. Only presence is reported, never a value: a credential set from the dashboard lives daemon-side and is never read back to a browser, so nothing in the answer can be turned back into a credential. When the status cannot be read, nothing is reported as set. A credential from the daemon's environment wins over a stored one, and the dashboard is told so, rather than offered an edit that would not take effect (the rule is `discord-credentials.ts`'s).

### Setting the Discord credentials from the dashboard

#### Context

**User story**: the user pastes the Discord webhook into Settings [3] and notifications start arriving — the one onboarding step that otherwise needed an edit to the daemon's environment and a restart.

#### Business logic

The call takes a patch: a string sets the webhook, an explicit null clears it, and an absent key leaves it alone. It is write-only on purpose: there is no companion read, the value goes daemon-side, and the browser only ever learns that it is there through the channels read above. The daemon applies the save live, so the Discord bot connects and its watchers start on the save rather than at the next daemon start. A failed save answers "failed to save". The exposure is bounded by the guard the whole surface sits behind: on a non-loopback bind every route requires the shared token, and anyone through that guard can already start agents [10], which is strictly more than setting a webhook.
