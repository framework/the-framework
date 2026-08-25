# Bug analysis: packages/framework/src/dashboard-rpc/preferences.test.ts

## Business logic (high-level)

Three cases over `preferences.ts`'s two write paths, all against a fake `PreferencesStore` wired
through `provideTestContext`. Per `preferences.test.SPEC.md` the intent is narrow and explicit: a
write that cannot be stored is reported as a plain failure the dashboard can render (both for a full
save and for a partial one), and a partial save answers with the complete merged preferences.

The suite is honest about what it deliberately does *not* cover: the header comment (L17–19) records
that the not-enabled/degraded-host case is gone (D3) and that what remains worth asserting is a
store whose write fails. Nothing is tested for `onPreferences`, the project-preset pair, `onEditors`
or the Discord functions — those are thin `.catch` adapters, and the SPEC does not claim them.

The `store(over)` helper is the right shape for this: an all-working store with only the method
under test replaced, so a case cannot accidentally pass because some *other* method was the one that
blew up. Each case wires its own context immediately before the call; since #F3 the context sticks
until the next `provideTestContext`, so there is no cross-test bleed as long as every case wires one
(all three do).

Nothing here is time- or filesystem-dependent, so the cases are deterministic. Every case awaits its
RPC and asserts on the resolved value with `assert.deepEqual` (strict), so an extra field in the
result would fail rather than pass silently — worth noting, because the `{ok:true, preferences}`
shape is the whole point of case 2.

## Functions (low-level)

### `store(over)`
Builds a `PreferencesStore` whose `read` answers `{}`, `save` succeeds, and `patch` echoes its input.
The echoing `patch` default is what makes case 2's override (`{theme:'dark', ...patch}`) legible as
"the store merged something". Correct.

### Case 1 — `savePreferences` reports a store failure as a typed error
Store's `save` throws; asserts exactly `{ok:false, error:'failed to save preferences'}`. If the
`try/catch` in `savePreferences` were removed the RPC would reject and the `await` would throw out
of the test — a failure, not a silent pass. Real power. Correct.

### Case 2 — `patchPreferences` hands back what the store merged (#1148)
Store's `patch` returns `{theme:'dark', ...patch}`; asserts the RPC answers
`{ok:true, preferences:{theme:'dark', driver:'codex'}}`. This pins the one thing that distinguishes
`patchPreferences` from `savePreferences`: the merged block travels back to the caller. A regression
returning a bare `{ok:true}` (the shape `savePreferences` uses) fails here. Correct.

### Case 3 — `patchPreferences` reports a failed merge write as a typed error
Symmetric to case 1 for the patch path. Correct.

## Bugs found

1. **L22/L39/L48 (fix belongs in `packages/framework/src/dashboard-rpc/test-context.ts` L25): each
   `provideTestContext()` here spawns a real `claude -p /usage` child process.** The helper's
   default context builds `defaultQuotaSource()`, which starts a `QuotaPoller` whose `start()` polls
   immediately (`dashboard/quota.ts` L103–114, `quota-poller.ts` L108–113) and spawns the real
   `claude` binary with a non-unref'd 20 s timeout (`driver/claude-code-quota.ts` L128–131); nothing
   in the test ever stops it. These three cases need no quota at all, so running this file alone
   fires three real usage reads against the developer's rate-limited account. Severity: minor
   (test-suite side effect). Confidence: high. Fix: default `quota` in `provideTestContext` to an
   inert stub (`read` answering `{windows: [], unavailable: 'fetch-failed'}`, `boundaryFor`
   answering `undefined`, `stop` a no-op) rather than `defaultQuotaSource()`.
