The multi-project registry (#390): one JSON file per machine (`$HOME/.the-framework.json` or `$XDG_CONFIG_HOME/the-framework.json`) holding the registered project list, the user's dashboard preferences (#410), per-project overrides (#840), the daemon token (#1051), and third-party secrets (#1095).

## TLDR

- `ProjectRecord` list (id/path/addedAt) with `projectId()` = sanitized basename + djb2-base36 hash of the path (deterministic, URL-safe).
- `Preferences`: ~20 flat booleans (autopilot, eco*, transparent, vanilla, notify*, autoPm, bridge, …) plus typed extras: `model`, `agent`, `editor`, `theme`, `target` (`local|actions|web`), `autoSpendOffset` (#960), `autoPmOptOut`/`autoPmConcurrency` (#1209/#1204), `customPresets` (#626), `reposDirectory(+AutoGrant)` (#1123).
- `ProjectPreferences` (#840): the subset a project may override, layered over globals by `resolvePreferences()` (spread merge; only stored keys win).
- Read/write API: `readRegistry`/`listProjects`/`addProject`/`removeProject`, `read/write/patchPreferences`, `read/write/patchProjectPreferences`, `ensureDaemonToken`/`readDaemonToken`, `readSecrets`/`writeSecrets`, `registryPreferencesStore()` (the `PreferencesStore` seam the dashboard's Telefunc RPCs write through).
- `topicScratchPath()`: the repo-less scratch dir a project-less "topic" run (#1120) executes in, resolved like the registry path so it never lands in a repo.
- Everything is sanitized on read and write: unknown keys dropped, strings trimmed/length-capped, numbers clamped — a hand-edited or hostile file can never land junk or bloat the home file.

## Problems

- Concurrent read-modify-write: `daemon.ts`/`daemon-runtime.ts` call `addProject` while the dashboard's savePreferences RPC writes through the store; interleaved, the later write was computed from a stale read and silently dropped the earlier one (#991). All mutators are serialized through one module-level tail promise (`serialize()`), and a rejected mutation must not poison the queue.
- Non-atomic writes: a crash/kill/full disk mid-write left a half file, and `readRegistry` reports malformed as empty — so every project and preference vanished silently (#991). Writes go to a `.pid.tmp` sibling then rename over; the temp is left behind on failure (one stray file is the cheaper half of that trade).
- Whole-object preference saves replayed a tab's stale snapshot, reverting other clients' changes (#1148) — hence `patch*` variants that merge only the keys the caller changed.
- An `as const` array of boolean keys only caught typos, not omissions: a newly added boolean preference was silently dropped on every save (write-then-vanish, #944). `BOOLEAN_PREFERENCES` is a `Record<BooleanPreferenceKey, true>` so the compiler enforces completeness in both directions.

## Decisions

- One file, `.bashrc`-style, re-created per machine (#390); the same file holds preferences so the daemon owns one user file and the UI never needs localStorage.
- Secrets and `daemonToken` are top-level, deliberately NOT `Preferences` fields: never shipped to the browser bundle nor the per-project map. Nothing reads a secret back to a client — the dashboard is told only presence. One secret store, not a second file: the registry has been a secret store since #1051, and a second file would only spread the exposure.
- File is written 0600 (`REGISTRY_FILE_MODE`), mode set on the temp file *before* the rename (narrowing after would leave a readable window); best-effort so FAT/Windows still writes.
- Notable defaults: most booleans absent = off, but `autoPushBranch`/`autoOpenPr` absent = ON (#1102, zero-config handoff) and `notifyHumanIntervention` absent = ON (the baseline ping The Framework leans on). `autoPm`, `notifyDiscord`, `discordBot`, `bridge`, `reposDirectoryAutoGrant` are explicit opt-ins (they spend money, act on input, or widen access) — as is `autoMerge` (#1216: it lands work on the default branch).
- `autoPmOptOut` names routines rather than indexing them (a reorder must not move which is off) and is opt-*out* so a routine added in a later version is on for everyone; kept as free-form strings (the catalog lives above this storage layer, and a newer version's name must survive a downgrade).
- Legacy bare `ProjectRecord[]` files (pre-#410) still read; the next write migrates to object form. `removeProject` drops the project's overrides too, so re-adding starts clean.
- `writeSecrets` is a patch where explicit `null`/blank clears a key and `undefined` leaves it — "not mentioned" and "removed" stay different (the bot dialog must not clear the webhook by not knowing it).
- `registryPreferencesStore`'s `onChange` gets the keys the caller *wrote*, not the merged result, so a listener can tell "this write switched it on" from "already on" (#1161); it runs after the write landed and its failure is swallowed.
- `resolveProjectPath` (#1121) requires a non-empty absolute path to an existing directory; `resolve()` collapses `.`/`..` so traversal can't smuggle a path in.

## Facts

- Path resolution: `$XDG_CONFIG_HOME/the-framework.json` when set, else `$HOME/.the-framework.json`; topic scratch dirs mirror it under `the-framework-topics/<runId>`.
- Caps: `CUSTOM_PRESET_LIMITS` = 30 presets / 80-char label / 20k-char prompt; secrets ≤ 500 chars; name lists ≤ 50 entries of ≤ 100 chars; `autoSpendOffset` clamped to ±`MAX_SPEND_OFFSET`; `autoPmConcurrency` clamped to 1..`MAX_AUTO_PM_CONCURRENCY` (floored at one — a hand-edited nought would wedge the routine with the switch still reading on).
- `daemonToken` = base64url of 32 random bytes (drops into `?token=` without encoding); generated only on the first non-loopback bind, so loopback-only machines never grow one.
- `PROJECT_PREFERENCE_KEYS` and spend/concurrency constants live in leaf `preference-defaults.ts` (shared with the dashboard) and are re-exported here.
- `env` and fs (`RegistryFs`) are injectable seams; `readRegistry` never throws (missing/malformed = empty registry).
