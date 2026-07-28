The preferences telefunctions (#410): global and per-project dashboard preferences, project-shared presets, editor detection, and the Discord credential surface.

## TLDR

- Global preferences: `onPreferences` (defaults `{}` where unwired), `savePreferences` (whole-block replace), `patchPreferences` (#1148 key-merge that returns the stored result).
- Per-project run options (#840): `onProjectPreferences`/`saveProjectPreferences`/`patchProjectPreferences` — kept a separate tier from global so the client knows which one a toggle writes to.
- `onProjectPresets`/`saveProjectPresets` (#1025): team-shared custom presets committed into the project's own `.the-framework/`, resolved via the project's checkout, not the home registry.
- `onEditors` (#727): editors installed on the daemon's PATH for the "Preferred editor" picker.
- `onNotifyChannels` (#948/#1095): whether the daemon holds a Discord webhook / bot token, where each came from, and whether this host can store one — presence only, never values.
- `saveDiscordCredentials` (#1095): store/clear Discord credentials from the dashboard; the store applies them live (bot connects on save, no daemon restart).

## Problems

- Stale-tab reverts (#1148): `savePreferences` replaces the whole block, so a client's old snapshot overwrote settings it never touched; `patch*` merges only the changed keys and hands back the merged truth so the tab converges.
- Delivery-vs-toggle mismatch (#948): notification toggles are per-user preferences but delivery needs daemon-side credentials; without `onNotifyChannels` the UI let users enable a channel that delivers nothing.

## Decisions

- Everything is gated on the context stores: a public host (relay) reads defaults/`[]`, and writes return typed `{ ok: false, error }` — failures return the same shape rather than rejecting the RPC, so clients handle both alike.
- Credentials are write-only by contract: the value goes daemon-side and the browser only ever learns presence; exposure is bounded by the existing route guard (shared token on non-loopback binds, #1051), whose holders can already start runs.
- Preferences persist in the daemon's `the-framework.json` registry (no localStorage), so they survive restarts.
