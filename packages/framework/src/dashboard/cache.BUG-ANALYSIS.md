# Bug analysis: packages/framework/src/dashboard/cache.ts

## Business logic (high-level)

The read-through cache for the dashboard's slow reads (#1028), with three load-bearing behaviors (all pinned by tests):

- **Single flight** — concurrent asks for one key share one `load()`. Holds because `refresh` stores the `inflight` promise synchronously (`entries.set` at L100 runs before any await), and both call sites check for it inside an unbroken synchronous section (`cachedRead` has no await between reading the entry and deciding), so the single-threaded event loop guarantees a second caller joins rather than re-fires.
- **Stale-while-revalidate** — a known value answers immediately; when older than `ttlMs` and no refresh is running, one is fired void-and-forgotten (its rejection pre-handled by `inflight.catch(() => {})` at L102, so nothing becomes an unhandled rejection).
- **Cold-ask budget** — the first ask waits `budgetMs` via `withBudget` (a raced timeout whose timer is always cleared in `finally` — no timer leak), then reports `pending: true`; a rejection inside the budget also reads as pending (SPEC: a caller waiting on a failed fetch is told "still loading", never handed the failure).
- **Failures cache nothing** — `refresh`'s catch restores the previous good entry (dropping only the inflight marker) or deletes the entry entirely, so the next ask retries; a kept stale value keeps its old `at`, so every subsequent read re-triggers a refresh until one succeeds. Cached `undefined` is a real answer (`has` flag), distinct from "not known yet".

State-machine check: an entry with `has: false` exists only while an inflight is set (success sets `has: true`; failure with no prior value deletes), so the cold path's `entry?.inflight ?? refresh(...)` can never find a valueless, flightless entry. No double refresh is reachable through the public API alone.

The one ordering flaw found is the interaction with `invalidate` (see Bugs): deleting the entry does not detach the in-flight load, whose completion handler writes unconditionally.

Module-level `entries` map is shared across all keys/types; callers namespace keys (`gh.ts` uses NUL-separated prefixes), so cross-caller collision is a caller concern — noted, fine here.

## Functions (low-level)

- `cachedRead(key, load, options)` — hot path: return known value, fire background refresh if stale and idle. Cold path: join-or-start, wait budget, return value or pending. Defaults ttl 60s / budget 150ms / `Date.now`. Two same-tick stale readers cannot double-fire (see above). Differing options across callers of one key would race semantics, but no such caller exists. Verdict: correct.
- `invalidate(key)` — deletes the entry so the next read is fresh. Does not cancel or disown an in-flight load — see bug 1. Verdict: bug found (in combination with `refresh`).
- `clearCache()` — test seam; same disowning caveat is irrelevant across tests since keys are re-created. Correct.
- `refresh(key, load, now)` — starts `load()` first, then merges `inflight` into the existing entry (preserving a stale value while refreshing). Success handler replaces the entry (dropping `inflight`); failure handler restores-or-deletes. Both handlers key off the *current* map state at settle time, which is what makes the invalidate race possible. Verdict: bug found (see below).
- `withBudget(promise, ms)` — races value/failure against a timer; `finally` clears the timer; rejections are converted to `{done: false}` before the race so a loser promise cannot become unhandled. Verdict: correct.

## Bugs found

1. `L89` (with `invalidate` at L78): an in-flight refresh survives invalidation and re-caches a pre-invalidation answer. Scenario: a poll's stale read fires a background `ghPrView` refresh (~600ms); meanwhile the user's "Open PR" action completes and calls `forgetPr` → `invalidate(key)`; the dashboard's next read starts a fresh load and shows the new PR; then the *old* refresh (started before the PR existed) resolves and unconditionally runs `entries.set(key, { value: <no PR>, has: true, at: now() })`, overwriting the fresh answer with stale "no PR" stamped as current — the panel offers "Open PR" again for up to a full TTL (60s) even though one exists. The same window exists in the failure handler (it restores an entry that was invalidated meanwhile, resurrecting a deleted key with a stale value). This contradicts the SPEC's stated purpose of invalidation ("an action that is known to have changed something is followed by a fresh read"). Severity: minor (self-heals after the TTL; window requires an action landing inside an in-flight refresh). Confidence: medium (the race is certain from the code; how often the old load resolves after the new one is timing-dependent). Fix sketch: make the settle handlers conditional on still being the current flight — e.g. capture the promise and in both handlers check `(entries.get(key) as Entry<T> | undefined)?.inflight === inflight` before writing (an invalidated key has no entry, a superseded flight a different one), so a disowned load's result is dropped.
