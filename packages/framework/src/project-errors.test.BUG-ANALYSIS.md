# Bug analysis: packages/framework/src/project-errors.test.ts

## Business logic (high-level)

Covers every clause of `project-errors.test.SPEC.md`: empty listing; a recorded error carrying code/message/first-seen; re-report keeping `since` while refreshing the message (#1500's banner-age point); clear + clear-of-nothing as a no-op; a post-clear report starting a fresh clock; per-project isolation.

The `ticking()` clock advances **one second per read, before returning** (`t += 1000` then `new Date(t)`), so the first `now()` yields 10:00:01 — every expected `since` in the tests is consistent with that (first set → `:01`; in the clear test, the first `set` consumes `:01` and the post-clear `set` mints `:02`). This makes the "keeps since" and "fresh clock" assertions genuinely distinguishable: if `set` wrongly re-minted `since` on a re-report, the second call would produce `:02` and the deepEqual would fail. The tests cannot pass vacuously.

All assertions are `deepEqual` on the full listed objects (or explicit field reads), so a wrong message, a wrong timestamp, an accumulated duplicate entry, or cross-project leakage would each fail. Everything is synchronous; no missing awaits.

## Functions (low-level)

- **`ticking(start?)`** — closure clock; deterministic, no wall-clock dependency. Correct.
- **Test "re-reporting ... keeps since"** — asserts exactly one entry with the *second* message and the *first* timestamp. Correct.
- **Test "clearing removes ..."** — the leading `errors.clear(...)` before any `set` exercises the no-op branch (missing project map); then set/clear/list-empty; then the fresh-clock assertion via optional chaining (`[0]?.since`) — if the list were empty the value would be `undefined !== '...:02'` and fail. Correct.
- **Test "errors are per project"** — sets on `/repos/a`, asserts `/repos/b` empty and `/repos/a` length 1. Correct.

Coverage note (not a bug): the SPEC's "oldest first" ordering is never asserted with two codes — unavoidable while `ProjectErrorCode` has one member, since one project can hold at most one entry.

## Bugs found

None found.
