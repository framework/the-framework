# Bug analysis: packages/framework/src/registry.ts

## Business logic (high-level)

The one per-user file (`$XDG_CONFIG_HOME/the-framework.json` or `~/.the-framework.json`): project list, preferences, daemon token, secrets. Verified clause-by-clause against `registry.SPEC.md`:

- **Reading never fails** — `readRegistry` catches read+parse, rejects non-object/array shapes (the pre-#410 bare list reads as empty — zero-migration per MEMORY.md), dedupes projects by `resolve`d path (first wins), sanitizes preferences and secrets, keeps `daemonToken` only as a non-empty string.
- **Everything validated on read AND write** — one `sanitizePreferences` used by both paths, so a bad file is repaired on its next save and a hostile client write never lands junk. The boolean table is a `Record<BooleanPreferenceKey, true>` computed from the `Preferences` type — the #944 two-way completeness guard (an omitted boolean is a compile error, not a silent write-then-vanish). String prefs each have a dedicated branch (`model` with the `Default` rejection #1143, `driver` via `isDriverName`, `editor` trimmed+capped, `theme`/`target`/`handoff` set-constrained, `autoSpendOffset` rounded+clamped ±`MAX_SPEND_OFFSET`, `autoPmConcurrency` rounded+floored at 1, `autoPmProject` trimmed+capped, `autoPmOptOut` via `sanitizeNameList`, `customPresets` via `sanitizeCustomPresets`). Checked each guard is runtime-safe for arbitrary JSON values (`isDriverName`/`isHandoffLevel`/`isAgentLocation` all reject non-strings at runtime despite the `as string` cast at the `driver` call site).
- **Patch over save (#1148)** — `patchPreferences` merges `{...stored, ...patch}` then sanitizes the merge, so clearing works by sending a blank/empty value (sanitizer drops it) with no sentinel; an explicit `undefined` in a patch also clears (spread keeps the key, guard drops it) — consistent with "touch only what you name" since JSON transport cannot even express `undefined`.
- **Atomic, owner-only writes (#991/#1095)** — temp file `<file>.<pid>.tmp`, chmod 0600 *before* rename (no world-readable window on the real path), rename over; the no-`rename` fallback writes in place then chmods (documented platform concession). Temp left behind on failure (documented trade). Within one process, the pid-suffixed temp cannot collide because all writers are serialized (below); two *processes* would collide only on distinct pids → distinct temps. Correct.
- **Serialized mutators (#991)** — module-level `mutations` tail; `serialize` chains, and swallows rejections in the tail while the caller still gets the rejecting `result` — so a failed write neither wedges the queue nor becomes an unhandled rejection *if the caller handles it* (all RPC/daemon callers do; the tests pin the queue-not-wedged behavior). All five mutators (`addProject`, `writePreferences`, `patchPreferences`, `ensureDaemonToken`, `writeSecrets`) go through it; the reads deliberately do not (pure reads).
- **Token (#1051)** — minted only by `ensureDaemonToken` (serialized, reuse-first, 32 bytes base64url = URL-safe); `readDaemonToken` is a pure read so printing a URL never mints. Stored top-level, never inside `preferences` — and `writeRegistry` reconstructs the written object from named fields only, so nothing else can smuggle keys into the file.
- **Secrets (#1095)** — patch semantics with `null`-clears vs `undefined`-leaves; last-cleared drops the block (destructure, honoring `exactOptionalPropertyTypes`); `sanitizeSecrets` keeps only known keys as non-empty trimmed ≤500-char strings. No read path ever returns secrets to a client from this module (readers are daemon-side; presence-only is the dashboard contract).

Edge cases examined: `registryPath` with unset `HOME` → relative dotfile (degenerate env, harmless); `projectId` on messy basenames (lowercase + `[^a-z0-9-]`→`-`, djb2 base36 — deterministic, URL-safe, exact under 2^53 before ToInt32); duplicate-path `addProject` returns the existing record without writing; `addProject` stores the `resolve`d absolute path; `writeRegistry` drops an empty secrets object. `daemonToken` has no length cap on read (a hand-bloated token is preserved) — the user damaging their own file, out of scope.

## Functions (low-level)

- **`projectId(path)`** — djb2/xor variant `>>>0`, name + base36 hash. Deterministic, distinct per path (hash over full path). Correct.
- **`registryPath(env)`** — XDG first (empty string is falsy → unset, pinned by test), else `$HOME/.the-framework.json`. Correct.
- **`nodeRegistryFs()`** — narrows `nodeFs()`; `rename` present → atomic path taken. Correct.
- **`isRecord` / `dedupeProjects`** — shape check + `resolve`-keyed dedupe, first wins. Correct.
- **`sanitizePreferences(value)`** — as analyzed above; non-object → `{}`. Correct.
- **`sanitizeNameList(value)`** — strings only, trim, 100-char cap, drop blanks, dedupe, 50 cap. Correct.
- **`sanitizeCustomPresets(value)`** — cap 30 (break), object entries, string id/label/prompt, trim, caps (80/20k), duplicate-id drop. Exported for the project tier — single sanitizer both tiers, per SPEC. Correct.
- **`sanitizeSecrets(value)`** — known keys only, trimmed, capped, `undefined` when empty. Correct.
- **`readRegistry(fs?, env?)`** — as analyzed. Correct.
- **`writeRegistry(registry, fs, env)`** — as analyzed; `restrict` failure swallowed (`.catch(() => {})`) per best-effort contract. Correct.
- **`serialize(mutate)`** — tail-chained; correct rejection isolation.
- **`listProjects` / `readPreferences` / `readSecrets` / `readDaemonToken`** — thin reads. Correct.
- **`addProject(path, addedAt, ...)`** — serialized read-check-append-write; idempotent by resolved path. Correct.
- **`writePreferences` / `patchPreferences`** — replace vs merge, both sanitize before write; patch returns the stored result. Correct.
- **`ensureDaemonToken`** — serialized reuse-or-mint. Correct.
- **`writeSecrets(patch, ...)`** — null/blank clears, undefined leaves, sanitize, drop-block-when-empty. Correct.
- **`registryPreferencesStore(fs?, env?, onChange?)`** — `onChange` gets the caller's written keys (not the merge, #1161), runs after the write landed, throw swallowed so a listener cannot fail a landed save. Correct.

## Bugs found

None found.
