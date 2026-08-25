# Bug analysis: packages/framework/src/agent-telemetry.test.ts

## Business logic (high-level)

Five synchronous cases over `emitSessionStart` and `createDriverEventHandler`. The technique
throughout is to collect emitted events into an array and assert on it — no mocks beyond a cast
`{ id: 'claude' } as unknown as Driver`, which is safe because `emitSessionStart` only reads
`driver.id`.

Behaviours pinned, against `agent-telemetry.SPEC.md` and the test SPEC:

- **The opening event** (`L18`): whole-array `deepEqual`, so it pins the exact event shape *and*
  that nothing else is emitted. Both the model-present and model-absent cases are covered, and the
  absent case is a real assertion (a `model: undefined` key would fail `deepStrictEqual` against an
  object without the key).
- **Turn-start announcement consumed, not forwarded** (`L29`): the `deepEqual` on the *whole*
  `events` array is what makes this test strong — it fails both if the `session-update` is missing
  and if the driver event were also forwarded as a `{kind:'driver'}` row. It also pins the template
  resolution (`https://example.test/{sessionId}` → `.../s1`).
- **No duplicate update when the result repeats the id** (`L35`): counts `session-update` events
  after a `session` + a `result` with the same id. Correct dedup check.
- **The hand-off anchor** (`L43`): both directions — a result with `anchorSha` emits exactly one
  `cloud-anchor`, a result without emits none.
- **A result with a fresh id still publishes** (`L58`): the pre-#1322 path, asserted with a
  whole-event `deepEqual` (`{kind:'session-update', sessionId:'s2'}` with **no** `sessionLink`,
  since this handler was built without a template) — so it also pins that no link key is invented.

Every case is synchronous with no promises, so there is no unawaited-assertion hazard. Each builds
its own `events` array and its own handler, so the closure state (`lastSessionId`, `UsageMeter`) is
never shared between cases.

Coverage gaps — all real, none of them making an existing test wrong:

- `emitSessionStart`'s link rule (a literal link published immediately, a templated one suppressed)
  is not tested at all, even though it is one of the SPEC's TL;DR bullets. The tests only exercise
  the no-link case.
- The SPEC bullet "A driver's own session URL beats the framework's template" — i.e.
  `event.sessionLink ?? resolveSessionLink(...)` on a `result` — has no test. This is the branch
  whose dedup interaction I flagged as a latent coupling in `agent-telemetry.BUG-ANALYSIS.md`; a
  test would be the natural place to pin that the real URL always wins.
- Usage folding ("Usage totals grow turn by turn": two results with usage produce a growing total)
  is untested here.
- `createAgentControls` (signal composition) and `endStopDetail` (stopped-vs-failed classification)
  have no tests in this file at all, despite being two of the seven SPEC bullets. They may be
  covered indirectly through the agent-level tests; from this file's perspective they are simply
  absent.
- `fake: true` (the fake-driver flag the SPEC calls out for the demo driver) is only ever asserted
  in its `false` form.

## Functions (low-level)

### `handler(events, sessionLink?)` (`L11`)

Test helper: builds a `createDriverEventHandler` whose `emit` pushes into the caller's array, and
passes `sessionLink` through only when given (so the "no template configured" case really has the
key absent rather than `undefined` — matching how the production callers build the options object).
Verdict: correct.

### `test('the opening session event records the model the driver was started with')` (`L18`)

Two whole-array assertions. Verdict: correct.

### `test('a session announcement emits session-update at turn start and is consumed, not forwarded')` (`L29`)

Verdict: correct — the strongest test in the file.

### `test('the result repeating the announced id does not emit a second session-update')` (`L35`)

Counts rather than deep-compares, which is the right granularity for a dedup assertion (the
`driver` row for the result is legitimately present and irrelevant). Verdict: correct.

### `test('a result carrying the hand-off anchor emits it as its own event')` (`L43`)

Uses `'a'.repeat(40)` for a realistic sha. Both directions asserted. Verdict: correct.

### `test('a result with a fresh id still emits, the pre-#1322 path unchanged')` (`L58`)

Verdict: correct.

## Bugs found

None found.
