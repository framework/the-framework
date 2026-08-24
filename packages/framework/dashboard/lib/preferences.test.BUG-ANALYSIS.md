# Bug analysis: packages/framework/dashboard/lib/preferences.test.ts

## Business logic (high-level)

Covers the store's contractual behaviours: optimistic-toggle-survives-initial-load, initial load, repo tier over global (#842), single writable destination (B5), empty repo changes nothing, provenance, refresh of the file tier (edit + delete on disk), failed project read swallowed and recoverable, patch-only writes (#1148), adopting the daemon's merged answer, stale-reply-after-newer-write dropped, failed write keeps optimistic value, `refreshPreferences` re-read and its write-in-flight guard, and the theme readers. `vi.resetModules()` per test gives each a fresh module instance — the right treatment for module state. Route selection is driven through `history.replaceState`, matching how the store reads the URL.

One assertion is vacuous (bug 1 below): the "yml deleted outright stops contributing" claim checks a key (`vanilla`) that no tier in that test ever set, so it passes whether or not the deleted file's keys linger. The lingering key would be `transparent`.

Async discipline: `flush()` double-awaits inside `act`; the deliberately-pending promises (`resolveLoad`, `resolveFirst`) are resolved inside `act`. The `unhandledRejection` listener in the failed-project-read test is attached before the rejection and removed after — genuinely catches a swallow regression.

## Functions (low-level)

- `flush` — two microtask turns inside `act`; enough for the mocked-promise chains used here (no timers involved). Correct.
- `openProject` — `replaceState` to `/{id}` or `/`; matches `parseRoute`'s expectations. Correct.
- beforeEach — resets all five RPC mocks; `patchPreferences` default echoes the patch as the stored answer (documented daemon behaviour). Correct.
- "optimistic update … survives the load resolving" — parks the initial load, toggles, resolves load with the pre-toggle value, asserts the toggle wins (`cache ??=`). Can fail. Correct.
- "repo's the-framework.yml resolves over the global tier" — asserts override, file-own key, and global fallback. Correct.
- "repo-shaped setting … only ever writes your tier" — asserts `patchPreferences` got exactly the patch and repo still wins locally. Correct.
- "a repo that sets nothing changes nothing" — project with no `fileConfig`; result equals globals exactly. Correct.
- "usePreferenceSources names the tier" — repo/global attribution. Correct.
- "refreshFileConfigs re-reads the repo tier" — edit flips `transparent` true→false (asserted by value), then deletion. Third assertion is the vacuous one (bug 1).
- "a failed project read leaves the other tiers intact" — swallow + recovery on next refresh; also asserts no unhandled rejection. Correct.
- #1148 trio (patch-only, adopt, stale-reply-dropped) — each can fail against a regression; the stale-reply test drives real out-of-order resolution. Correct.
- "a failed write leaves the optimistic value" — `{ok:false,error}` path. Correct.
- "refreshPreferences re-reads" / "does not overwrite a write still in flight" — the second parks the patch forever and fires a refresh answering pre-write values; asserts the optimistic value survives (the `globalPending` guard). Correct.
- theme reader test — pure assertions. Correct.

## Bugs found

1. `L144`: `expect('vanilla' in result.current).toBe(false)` cannot fail — the test's tiers only ever set `transparent` (global is `{}`, the fileConfig was `{transparent: …}`), so `vanilla` is absent no matter what. If `loadFileConfigs` regressed and a deleted yml's keys lingered in the `files` cache, the lingering key would be `transparent`, and this assertion would still pass — the "a yml deleted outright stops contributing" behaviour is untested. Contradicts the test's own stated purpose (comment on L140). Severity: minor (test-only; the production behaviour is in fact correct). Confidence: high. Fix: assert `'transparent' in result.current` is `false` (optionally alongside `result.current` `toEqual({})`).
