# Bug analysis: packages/framework/src/agent-view.test.ts

## Business logic (high-level)

Ten synchronous cases across the four projections. Every case builds a literal `FrameworkEvent[]`
typed as such — so the fixtures are checked against the real event union at compile time, which is
the whole point of keeping these folds out of the dashboard ("unit-tested against the real event
shapes"). No mocks, no I/O, no shared state.

Coverage against `agent-view.SPEC.md`, bullet by bullet:

- *Projection of the log* — implicitly, since every test is a pure call on an array.
- *Named, then ready* (`L6`, `L14`): the untouched case, the named case, the ready case, and rename
  (latest wins). `deepEqual` on the whole object, so an extra or missing key fails. Complete.
- *The wrapped session* (`L22`, `L34`, `L45`): merge of opening event + update, `null` before the
  session opens, workspace surviving the id announcement, and the per-leg model fold including the
  "a leg that recorded no model clears it" case — which is the assertion that pins the
  *replacement* (rather than merge) semantics of a second `session` event, the subtlest behaviour
  in the file. Well chosen.
- *Handoff arming* (`L55`, `L62`, `L72`, `L80`): silence reads as push+PR with merge off; the record
  seed; a stream event beating the seed; latest-arming-wins; merge armed; merge seeded; and a
  pre-#1382 event (no `merge` key) not disarming a seeded merge. That last one is exactly the case
  the `event.merge !== undefined` guard exists for, so the guard cannot be dropped without a
  failure. Complete.
- *Handoff outcome* (`L91`): all three outcomes, each `deepEqual`'d as a whole object — so the
  `done` case also pins that `url` is carried, and the `failed`/`skipped` cases that their payload
  fields survive. Note the `done` and `failed` fixtures carry extra event fields (`pushed`,
  `step`) that the projection deliberately drops; asserting the whole `result` object proves they
  are dropped rather than leaked.
- *Errors* (`L106`): empty list, two errors oldest-first, one with detail and one without, with an
  unrelated event interleaved to prove the filter. The whole-array `deepEqual` pins that the
  detail-less entry has *no* `detail` key. Complete.

Every assertion is synchronous and every test body runs to completion; there is no promise, timer or
`async` anywhere, so no test can pass by not executing its assertions. Fixtures are built with
spreads of previous arrays (`[...building, …]`, `[...one, …]`) rather than mutation, so no case can
corrupt another.

Gaps worth naming, none of them a defect: nothing covers a `session-update` arriving *without* a
prior `session` event (unreachable in production, as `emitSessionStart` always runs first); nothing
covers a `session-update` that lacks a link after one that had one (the "an id-only update must not
blank the link" branch of `sessionInfo`); nothing covers repeated `handoff` events (last-wins); and
nothing covers a `handoff-armed` with an explicit `merge: false` over a seeded `merge: true`.

## Functions (low-level)

### `test('agentProgress starts building … flips to ready')` (`L6`)

Three whole-object `deepEqual`s over an empty log, a named log and a ready log. Verdict: correct.

### `test('agentProgress takes the latest session name …')` (`L14`)

Verdict: correct.

### `test('sessionInfo merges the opening session with the latest session-update link')` (`L22`)

Field-by-field assertions plus the `null` case for a log with no session events. Verdict: correct.

### `test('sessionInfo keeps the workspace the run used …')` (`L34`)

The regression guard for "the update must not drop the workspace" — it would fail if
`session-update` replaced instead of merging. Verdict: correct.

### `test('sessionInfo carries the model per leg …')` (`L45`)

Three progressively longer streams; the third pins the clear-on-a-leg-without-a-model behaviour.
Verdict: correct.

### `test('a run with no handoff events reads as armed …')` (`L55`)

Verdict: correct.

### `test('handoffState seeds from the run record …')` (`L62`)

Both halves: the seed applied, and a stream event overriding it. Verdict: correct.

### `test('handoffState takes the latest arming …')` (`L72`)

Verdict: correct.

### `test('handoffState carries the merge arming, and an event without it keeps the seed')` (`L80`)

Three cases including the pre-#1382 event over a seeded merge. Verdict: correct.

### `test('handoffState carries the outcome once the handoff has run')` (`L91`)

All three outcomes. Verdict: correct.

### `test('agentErrors folds the errors the agent reported, oldest first')` (`L106`)

Verdict: correct.

## Bugs found

None found.
