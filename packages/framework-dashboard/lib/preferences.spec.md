Client-side store for the dashboard's preferences: three tiers (global, repo `the-framework.yml`, per-project run options) cached module-wide, resolved nearest-wins, written through optimistically, and persisted daemon-side over Telefunc (#410, #840, #842).

## TLDR

- Preferences are owned by the daemon and persisted in the same `the-framework.json` as the project list — no more localStorage. Prerender has no daemon, so server snapshots are empty defaults; real values load on the client.
- `usePreferences()` — the resolved result of global ← repo file ← project (nearest wins, #800/#841); components never see the split.
- `updatePreferences(patch)` — splits the patch by tier: keys in `PROJECT_PREFERENCE_KEYS` (the framework's browser-safe client entry) land on the open project, the rest stay global. Write-through + notify, then best-effort persist.
- `usePreferenceSources()` (#842) — which layer won each key, so the launcher shows a repo-inherited value as not-yours.
- `useProjectFileConfig()` (#842) — the raw yml for keys with no preference counterpart (`preset`, `event`), which the gear cannot set.
- `useProjectPresets()` / `saveProjectPresetList()` (#1025) — a project's shared custom presets from its committed `.the-framework/custom-presets.json`.
- `refreshPreferences()` / `refreshFileConfigs()` — re-reads wired to window `focus` AND `visibilitychange` (#1148).
- Theme helpers (`themePreference`/`resolvedDark`, #725) and the five notification-toggle readers whose defaults live framework-side (#627/#858/#916).

## Problems

- Stale-tab replay (#1148): a write used to send the whole cached object, so a tab open since before someone else's change reverted it on its next write (most visibly the theme). Now a write sends only its changed keys and adopts the daemon's merged answer.
- Ordering races: a write reply landing after a newer write must not undo it (per-tier `writes` sequence numbers), and a refresh must not overwrite a write still in flight (per-tier `pending` counters — until the daemon stores those keys, no read can answer with them, and the write's own reply carries the merged truth anyway).
- Load/toggle race: a toggle made while the initial load is in flight already populated the cache and persisted, so loads assign with `??=` / `has()` guards rather than overwriting with the pre-toggle value.

## Decisions

- The active project is read straight off the URL (`parseRoute(window.location.pathname)`; #784 makes the URL the selection). `updatePreferences` runs in event handlers, not renders, so reading location leaves no module state to fall out of step with what the user is looking at.
- Resolved snapshots and source maps are cached per project and cleared on every notify: `useSyncExternalStore` compares snapshots by identity, so resolving fresh each read would re-render forever.
- The repo tier rides on the projects RPC (`onProjects`), one call covering all projects; the daemon re-reads the yml per request, so refetching is how an on-disk edit becomes visible. Wired to focus because that is when an editor edit becomes visible to someone looking back at the launcher.
- `visibilitychange` is handled in addition to `focus`: switching to a tab in an already-focused window fires no `focus` event — exactly when a tab shows values changed in another one (#1148).
- All persists are best-effort (`.catch(() => {})`): a failed save is not worth surfacing over a checkbox toggle (the relay host answers `ok: false`, and the optimistic value stays).

## Facts

- The project-key list is the framework's (`PROJECT_PREFERENCE_KEYS` via `@gemstack/the-framework/client`), so adding a key there routes the write split without a second copy here; likewise `preferencesFromFileConfig` maps the yml to preference keys and `notificationEnabled` holds the non-uniform notification polarities (`discordBot` absent means off, #916). `autopilotEnabled` is re-exported from the same entry (#858).
- Source attribution: `usePreferenceSources` walks tiers global → repo → project, later (nearer) tiers overwriting the recorded source per key; absent = nobody set it.

## Flows

- read: `usePreferences()` → `ensureLoaded(projectId)` (global prefs + all repo files + project prefs + project presets, each deduped/once) → `snapshot()` merges `{...global, ...fileTier, ...project}` → cached until the next `notify()`.
- write: `updatePreferences(patch)` → split by `PROJECT_KEYS` → optimistic cache update + `notify()` → `patchPreferences` / `patchProjectPreferences` with only the changed keys → adopt the reply iff still the newest write for that tier.
- focus/visibility: `refreshAll()` → `refreshFileConfigs()` + `refreshPreferences()` (both tiers; skipped for a tier with a write pending) → `notify()`.
