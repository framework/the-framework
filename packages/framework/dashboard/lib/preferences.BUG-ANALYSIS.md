# Bug analysis: packages/framework/dashboard/lib/preferences.ts

## Business logic (high-level)

The two-tier preference store (SPEC: user preferences + open project's committed `the-framework.yml`, nearest wins, only the user tier writable), plus shared project presets, provenance, focus/visibility re-reads, and the named per-setting readers. Checked against `preferences.SPEC.md`:

- **Two tiers, nearest wins** — `snapshot()` merges `{...global, ...repo}`; `preferencesFromFileConfig` (src/agent-options.ts) only emits keys the file actually set (spread-guarded per key), so the repo tier can never clobber a global key with `undefined`. With no file, `repo === EMPTY` short-circuits to the global object. Holds.
- **Provenance** — `sourceSnapshot()` walks `[global, repo]` in that order, later tier overwriting, skipping `undefined` values. Consistent with the value merge precisely because the repo tier contains no undefined-valued keys. Holds.
- **One shared answer** — module cache + `listeners`; `notify()` invalidates the per-project `resolved`/`sources` memo maps (identity-stable snapshots between notifies, required by `useSyncExternalStore`). Holds.
- **A write sends only what changed** — `updatePreferences` sends the patch only, adopts `result.preferences` when `seq === globalWrites` (older reply after a newer write is dropped — pinned by the test). Write-through first, so the UI answers instantly; failed save swallowed. Holds.
- **Initial-load vs optimistic-toggle race** — `cache ??= preferences` in `ensureLoaded` keeps a toggle made during the initial load (pinned by the test). Holds.
- **Refresh guards** — `refreshPreferences` captures `seq` at dispatch and at reply time skips when `seq !== globalWrites || globalPending > 0`. Covers: write before refresh still pending (globalPending), write issued after refresh (seq). Residual hole: a write's reply can adopt (`globalPending` drops to 0), *then* a refresh reply that the daemon happened to process before the write arrives and overwrites the adopted state with pre-write values. That needs the daemon to process two localhost requests out of dispatch order — reply-order inversion across two connections — which the seq design implicitly assumes away; next focus refresh self-heals. Same class: two overlapping `updatePreferences` whose *server-side processing* order inverts (B processed before A; B's reply adopted, lacking A's key while the daemon holds it). Both are accepted-by-design ordering assumptions on a localhost single daemon; noted, not reported.
- **Re-read on return** — module-load-time `focus` + `visibilitychange` listeners call both refreshes. Registered once, never removed (module lifetime = page lifetime). Holds.
- **Shared project presets** — per-project load-once guarded by `projectPresetLoads`; a save during the load wins (`if (!projectPresets.has(...))` in both then and catch). `saveProjectPresetList` writes through, persists best-effort, no-ops without a project. Holds.
- **File tier freshness** — `loadFileConfigs` clears+repopulates only inside `.then`, so a failed read leaves the map intact (pinned by the test); `filesLoaded = true` even on failure means the only retry path is the focus/visibility refresh — deliberate best-effort.

## Functions (low-level)

- `fileTier(projectId)` — `files.get` → `preferencesFromFileConfig` or `EMPTY`. New object per call when a file exists; memoised downstream. Correct.
- `snapshot(projectId)` — memo key `projectId ?? ''` (no project id can be `''`). `repo === EMPTY` identity check is the "no file" fast path; a file that sets nothing produces `{}` (not `EMPTY`) and takes the merge path — same result. Correct.
- `sourceSnapshot(projectId)` — as above; a key set to a real value in global and shadowed by repo reports `repo`, matching value resolution. Correct.
- `ensureLoaded(projectId)` — guards on `!cache && !loading`; `.catch` installs `{}` (so the UI stops waiting); `finally` clears `loading` + notifies. After the first success `cache` stays non-null so this never re-fires — refresh handles later re-reads. Correct.
- `loadFileConfigs()` / `refreshFileConfigs()` — dedupe on `filesLoading`; clear-then-fill inside `then`; notify in `finally`. Correct.
- `ensureProjectPresetsLoaded(projectId)` — dedupe set, save-wins guard, `finally` removes the in-flight marker + notifies. A failed load caches `[]` permanently for that project (until reload of the page) — accepted. Correct.
- `useProjectPresets()` / `usePreferences()` / `usePreferenceSources()` / `useActiveProjectId()` — read `window.location.pathname` during render; not itself reactive, but every navigation re-renders the tree through the router, and the snapshot closure re-captures the new projectId. Server branches return the empty constants. Correct.
- `saveProjectPresetList(next)` — write-through, best-effort persist, notify. No seq bookkeeping (unlike globals) — a stale reply cannot arrive because the save's response is ignored entirely. Correct.
- `activeProjectId()` — event-handler-time URL read, per its comment. Correct.
- `updatePreferences(patch)` — optimistic merge, `seq`/`globalPending` bookkeeping, adopt-if-latest, swallow failure (pinned: `{ok:false}` keeps the optimistic value). Correct.
- `refreshPreferences()` — guarded re-read; direct `cache =` assignment is safe because the guards exclude any in-flight/subsequent write. Correct (modulo the reply-order assumption above).
- `themePreference` / `resolvedDark` — default `system`; dark iff chosen dark or system+OS-dark. Matches SPEC and test. Correct.
- `notificationsEnabled` / `discordEnabled` / `newActivityEnabled` / `humanInterventionEnabled` — thin named readers over `notifyMethodEnabled`/`notifyCategoryEnabled` (framework-owned defaults, checked: `preferences[key] ?? NOTIFICATION_DEFAULTS…`). Correct.

## Bugs found

None found. (Two theoretical reply-ordering races are documented above; both require the daemon to process localhost requests out of arrival order, are self-healing on the next focus refresh, and the seq design comment shows the trade-off is deliberate.)
